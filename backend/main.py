import os
import io
import json
import base64
import datetime
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
import qrcode

from .database import engine, Base, get_db, SessionLocal
from . import models, schemas, crud
from .anpr_engine import extract_plate_from_image_bytes, clean_plate_text, format_plate_display
from .seed_data import seed_database

# Create DB tables
Base.metadata.create_all(bind=engine)
# Seed initial data
seed_database()

app = FastAPI(
    title="Smart Parking System API",
    description="IoT Smart Parking with Raspberry Pi 4B ANPR & Location Tracer",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSocket connections for real-time slot and ANPR event broadcasting
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

# --- API ENDPOINTS ---

@app.get("/api/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.datetime.utcnow().isoformat()}

# 1. PARKING LOTS & LOCATION TRACER
@app.get("/api/lots", response_model=List[schemas.ParkingLotOut])
def list_parking_lots(
    lat: Optional[float] = Query(None, description="User Latitude for nearest location calculation"),
    lon: Optional[float] = Query(None, description="User Longitude for nearest location calculation"),
    db: Session = Depends(get_db)
):
    lots = crud.get_parking_lots(db, user_lat=lat, user_lon=lon)
    return lots

@app.get("/api/lots/{lot_id}")
def get_lot_detail(lot_id: int, db: Session = Depends(get_db)):
    lot = crud.get_lot_by_id(db, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Parking Lot not found")
    
    # Enrich with slot stats
    slots = crud.get_slots(db, lot_id)
    avail_car = sum(1 for s in slots if s.vehicle_type == "car" and s.status == "available")
    avail_bike = sum(1 for s in slots if s.vehicle_type == "bike" and s.status == "available")
    
    return {
        "id": lot.id,
        "name": lot.name,
        "address": lot.address,
        "latitude": lot.latitude,
        "longitude": lot.longitude,
        "car_rate_per_hour": lot.car_rate_per_hour,
        "bike_rate_per_hour": lot.bike_rate_per_hour,
        "car_capacity": lot.car_capacity,
        "bike_capacity": lot.bike_capacity,
        "available_car_slots": avail_car,
        "available_bike_slots": avail_bike,
        "total_slots": len(slots)
    }

# 2. SLOTS GRID
@app.get("/api/lots/{lot_id}/slots", response_model=List[schemas.ParkingSlotOut])
def get_lot_slots(
    lot_id: int,
    vehicle_type: Optional[str] = Query(None, description="Filter by 'car' or 'bike'"),
    db: Session = Depends(get_db)
):
    slots = crud.get_slots(db, lot_id=lot_id, vehicle_type=vehicle_type)
    return slots

# 3. PRE-BOOKING & RESERVATIONS
@app.post("/api/bookings", response_model=schemas.BookingOut)
async def make_booking(booking_in: schemas.BookingCreate, db: Session = Depends(get_db)):
    try:
        booking = crud.create_booking(db, booking_in)
        
        # Broadcast real-time slot update via WebSocket
        slot = db.query(models.ParkingSlot).filter(models.ParkingSlot.id == booking.slot_id).first()
        lot = db.query(models.ParkingLot).filter(models.ParkingLot.id == booking.lot_id).first()
        
        await manager.broadcast({
            "type": "SLOT_UPDATED",
            "lot_id": booking.lot_id,
            "slot_id": booking.slot_id,
            "slot_number": slot.slot_number if slot else None,
            "vehicle_type": booking.vehicle_type,
            "status": "booked",
            "current_plate": booking.vehicle_number
        })

        # Enrich response
        res = schemas.BookingOut.from_orm(booking)
        res.slot_number = slot.slot_number if slot else None
        res.lot_name = lot.name if lot else None
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@app.get("/api/bookings/my", response_model=List[schemas.BookingOut])
def get_user_bookings(phone: Optional[str] = None, plate: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Booking)
    if phone:
        query = query.filter(models.Booking.user_phone == phone)
    if plate:
        query = query.filter(models.Booking.vehicle_number == clean_plate_text(plate))
    
    bookings = query.order_by(models.Booking.id.desc()).limit(20).all()
    results = []
    for b in bookings:
        item = schemas.BookingOut.from_orm(b)
        if b.slot:
            item.slot_number = b.slot.slot_number
        if b.lot:
            item.lot_name = b.lot.name
        results.append(item)
    return results

@app.get("/api/bookings/{booking_code}/qr")
def get_booking_qr(booking_code: str, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.booking_code == booking_code).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    qr_payload = {
        "booking_code": booking.booking_code,
        "plate": booking.vehicle_number,
        "type": booking.vehicle_type,
        "lot_id": booking.lot_id,
        "slot": booking.slot.slot_number if booking.slot else "TBD",
        "qr_token": booking.qr_token
    }

    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(json.dumps(qr_payload))
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")

# 4. ANPR SCANNER & RASPBERRY PI INTEGRATION ENDPOINTS
@app.post("/api/anpr/scan-image")
async def scan_plate_image(
    lot_id: int = Form(1),
    gate_type: str = Form("entry"),
    vehicle_type: str = Form("car"),
    file: Optional[UploadFile] = File(None),
    plate_override: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    detected_plate = ""
    confidence = 0.95

    if plate_override and plate_override.strip():
        detected_plate = clean_plate_text(plate_override.strip())
    elif file:
        contents = await file.read()
        res = extract_plate_from_image_bytes(contents)
        if res.get("detected") and res.get("plate"):
            detected_plate = res["plate"]
            confidence = res.get("confidence", 0.90)

    if not detected_plate:
        # Fallback if image has no readable plate characters
        raise HTTPException(status_code=422, detail="No valid license plate could be extracted. Please ensure plate is clearly visible or enter plate number.")

    # Process gate entry/exit with this plate
    event_result = crud.process_gate_event(
        db=db,
        lot_id=lot_id,
        gate_type=gate_type,
        plate_number=detected_plate,
        vehicle_type=vehicle_type,
        confidence=confidence
    )

    # Broadcast event to Web UI dashboard & live visualizer
    await manager.broadcast({
        "type": "GATE_EVENT",
        "event": {
            "lot_id": lot_id,
            "gate_type": gate_type,
            "plate_number": detected_plate,
            "formatted_plate": format_plate_display(detected_plate),
            "vehicle_type": vehicle_type,
            "barrier_open": event_result["barrier_open"],
            "action": event_result["action"],
            "slot_number": event_result.get("slot_number"),
            "message": event_result["message"],
            "timestamp": event_result["timestamp"].isoformat()
        }
    })

    return event_result

@app.post("/api/anpr/gate-trigger", response_model=schemas.GateEventResponse)
async def raspberry_pi_gate_trigger(
    data: schemas.ANPRScanRequest,
    db: Session = Depends(get_db)
):
    """
    Direct REST API endpoint called by Raspberry Pi 4B edge client.
    Can accept base64 image from Pi Camera v1.3 or pre-extracted plate string.
    """
    plate = data.plate_number or ""
    confidence = 0.96

    if not plate and data.image_base64:
        img_bytes = base64.b64decode(data.image_base64)
        scan_res = extract_plate_from_image_bytes(img_bytes)
        if scan_res.get("detected"):
            plate = scan_res["plate"]
            confidence = scan_res.get("confidence", 0.92)

    if not plate:
        raise HTTPException(status_code=400, detail="Plate number or decodable image is required")

    result = crud.process_gate_event(
        db=db,
        lot_id=data.lot_id,
        gate_type=data.gate_type,
        plate_number=plate,
        vehicle_type=data.vehicle_type or "car",
        confidence=confidence
    )

    # Broadcast event to all connected dashboards
    await manager.broadcast({
        "type": "GATE_EVENT",
        "event": {
            "lot_id": data.lot_id,
            "gate_type": data.gate_type,
            "plate_number": result["plate_number"],
            "formatted_plate": format_plate_display(result["plate_number"]),
            "vehicle_type": result["vehicle_type"],
            "barrier_open": result["barrier_open"],
            "action": result["action"],
            "slot_number": result.get("slot_number"),
            "message": result["message"],
            "timestamp": result["timestamp"].isoformat()
        }
    })

    return result

# 5. ADMIN & ANALYTICS
@app.get("/api/analytics", response_model=schemas.AnalyticsOut)
def get_system_analytics(lot_id: Optional[int] = None, db: Session = Depends(get_db)):
    return crud.get_analytics(db, lot_id)

@app.get("/api/gate-logs", response_model=List[schemas.GateLogOut])
def get_gate_logs(lot_id: Optional[int] = None, limit: int = 30, db: Session = Depends(get_db)):
    query = db.query(models.GateLog)
    if lot_id:
        query = query.filter(models.GateLog.lot_id == lot_id)
    return query.order_by(models.GateLog.id.desc()).limit(limit).all()

# 6. DOWNLOAD PROJECT ZIP
@app.get("/api/download/zip")
def download_project_zip():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    zip_path = os.path.join(base_dir, "smart_parking_system.zip")
    if not os.path.exists(zip_path):
        import zipfile
        exclude_dirs = {'.git', '__pycache__', '.pytest_cache', '.idea', '.vscode'}
        exclude_files = {'cloudflared.exe', 'smart_parking_system.zip'}
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(base_dir):
                dirs[:] = [d for d in dirs if d not in exclude_dirs]
                for file in files:
                    if file in exclude_files or file.endswith('.pyc'):
                        continue
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, base_dir)
                    zf.write(full_path, os.path.join('smart_parking_system', rel_path))
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename="smart_parking_system.zip"
    )

# WEBSOCKET FOR REAL-TIME SYNC
@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep alive
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

# STATIC FRONTEND MOUNTING
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=os.path.join(FRONTEND_DIR, "static")), name="static")

    @app.get("/")
    def serve_frontend_index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
