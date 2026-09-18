import math
import uuid
import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_

from . import models, schemas
from .anpr_engine import clean_plate_text

# Rates configured as per system requirements:
CAR_HOURLY_RATE = 50.0  # ₹50 per hour
BIKE_HOURLY_RATE = 30.0 # ₹30 per hour

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance in kilometers between two GPS points."""
    R = 6371.0 # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)

def get_parking_lots(db: Session, user_lat: Optional[float] = None, user_lon: Optional[float] = None) -> List[dict]:
    lots = db.query(models.ParkingLot).filter(models.ParkingLot.is_active == True).all()
    results = []

    for lot in lots:
        # Count available slots
        avail_cars = db.query(models.ParkingSlot).filter(
            models.ParkingSlot.lot_id == lot.id,
            models.ParkingSlot.vehicle_type == "car",
            models.ParkingSlot.status == "available"
        ).count()

        avail_bikes = db.query(models.ParkingSlot).filter(
            models.ParkingSlot.lot_id == lot.id,
            models.ParkingSlot.vehicle_type == "bike",
            models.ParkingSlot.status == "available"
        ).count()

        dist = None
        if user_lat is not None and user_lon is not None:
            dist = haversine_distance(user_lat, user_lon, lot.latitude, lot.longitude)

        results.append({
            "id": lot.id,
            "name": lot.name,
            "address": lot.address,
            "latitude": lot.latitude,
            "longitude": lot.longitude,
            "car_rate_per_hour": lot.car_rate_per_hour,
            "bike_rate_per_hour": lot.bike_rate_per_hour,
            "car_capacity": lot.car_capacity,
            "bike_capacity": lot.bike_capacity,
            "is_active": lot.is_active,
            "distance_km": dist,
            "available_car_slots": avail_cars,
            "available_bike_slots": avail_bikes,
            "total_available_slots": avail_cars + avail_bikes
        })

    if user_lat is not None and user_lon is not None:
        results.sort(key=lambda x: x["distance_km"] if x["distance_km"] is not None else 999999)

    return results

def get_lot_by_id(db: Session, lot_id: int):
    return db.query(models.ParkingLot).filter(models.ParkingLot.id == lot_id).first()

def get_slots(db: Session, lot_id: int, vehicle_type: Optional[str] = None):
    query = db.query(models.ParkingSlot).filter(models.ParkingSlot.lot_id == lot_id)
    if vehicle_type:
        query = query.filter(models.ParkingSlot.vehicle_type == vehicle_type.lower())
    return query.order_by(models.ParkingSlot.slot_number).all()

def calculate_rate(vehicle_type: str, lot: Optional[models.ParkingLot] = None) -> float:
    vtype = vehicle_type.lower()
    if lot:
        return lot.car_rate_per_hour if vtype == "car" else lot.bike_rate_per_hour
    return CAR_HOURLY_RATE if vtype == "car" else BIKE_HOURLY_RATE

def create_booking(db: Session, data: schemas.BookingCreate) -> models.Booking:
    clean_plate = clean_plate_text(data.vehicle_number)
    lot = get_lot_by_id(db, data.lot_id)
    if not lot:
        raise ValueError("Parking Lot not found")

    v_type = data.vehicle_type.lower()
    if v_type not in ["car", "bike"]:
        raise ValueError("Vehicle type must be 'car' or 'bike'")

    # Target or auto-assign slot
    slot = None
    if data.slot_id:
        slot = db.query(models.ParkingSlot).filter(
            models.ParkingSlot.id == data.slot_id,
            models.ParkingSlot.lot_id == data.lot_id,
            models.ParkingSlot.status == "available"
        ).first()
        if not slot:
            raise ValueError("Requested parking slot is not available")
    else:
        slot = db.query(models.ParkingSlot).filter(
            models.ParkingSlot.lot_id == data.lot_id,
            models.ParkingSlot.vehicle_type == v_type,
            models.ParkingSlot.status == "available"
        ).first()
        if not slot:
            raise ValueError(f"No available {v_type} slots at this parking lot")

    rate = calculate_rate(v_type, lot)
    total_amount = round(rate * float(data.duration_hours), 2)
    end_time = data.start_time + datetime.timedelta(hours=data.duration_hours)

    booking_code = f"SPK-{uuid.uuid4().hex[:6].upper()}"
    qr_token = f"QR_{booking_code}_{uuid.uuid4().hex[:8]}"

    # Mark slot as booked
    slot.status = "booked"
    slot.current_plate = clean_plate

    booking = models.Booking(
        booking_code=booking_code,
        lot_id=lot.id,
        slot_id=slot.id,
        user_name=data.user_name,
        user_phone=data.user_phone,
        user_email=data.user_email,
        vehicle_number=clean_plate,
        vehicle_type=v_type,
        start_time=data.start_time,
        end_time=end_time,
        duration_hours=data.duration_hours,
        hourly_rate=rate,
        total_amount=total_amount,
        payment_status="paid",
        booking_status="confirmed",
        qr_token=qr_token,
        created_at=datetime.datetime.utcnow()
    )

    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking

def process_gate_event(
    db: Session,
    lot_id: int,
    gate_type: str,
    plate_number: str,
    vehicle_type: str = "car",
    confidence: float = 0.95,
    snapshot_path: Optional[str] = None
) -> dict:
    clean_plate = clean_plate_text(plate_number)
    now = datetime.datetime.utcnow()
    lot = get_lot_by_id(db, lot_id)
    if not lot:
        return {
            "success": False,
            "action": "error",
            "plate_number": clean_plate,
            "vehicle_type": vehicle_type,
            "confidence": confidence,
            "message": "Parking Lot not found",
            "barrier_open": False,
            "amount_due": 0.0,
            "timestamp": now
        }

    v_type = vehicle_type.lower() if vehicle_type else "car"

    if gate_type.lower() == "entry":
        # 1. Look for confirmed pre-booking
        booking = db.query(models.Booking).filter(
            models.Booking.lot_id == lot_id,
            models.Booking.vehicle_number == clean_plate,
            models.Booking.booking_status == "confirmed"
        ).order_by(models.Booking.id.desc()).first()

        if booking:
            # Check in pre-booked vehicle
            booking.booking_status = "checked_in"
            booking.actual_entry_time = now

            slot = db.query(models.ParkingSlot).filter(models.ParkingSlot.id == booking.slot_id).first()
            if slot:
                slot.status = "occupied"
                slot.current_plate = clean_plate

            gate_log = models.GateLog(
                lot_id=lot_id,
                gate_type="entry",
                plate_number=clean_plate,
                vehicle_type=booking.vehicle_type,
                confidence=confidence,
                action_taken="checked_in_prebooked",
                slot_assigned=slot.slot_number if slot else None,
                snapshot_path=snapshot_path,
                message=f"Pre-booked vehicle entered. Slot: {slot.slot_number if slot else 'N/A'}",
                timestamp=now
            )
            db.add(gate_log)
            db.commit()

            return {
                "success": True,
                "action": "prebooked_checkin",
                "plate_number": clean_plate,
                "vehicle_type": booking.vehicle_type,
                "confidence": confidence,
                "message": f"Welcome {booking.user_name}! Pre-booking verified. Proceed to Bay {slot.slot_number if slot else 'Assigned'}.",
                "barrier_open": True,
                "slot_number": slot.slot_number if slot else None,
                "booking_code": booking.booking_code,
                "amount_due": 0.0,
                "timestamp": now
            }
        else:
            # Instant on-spot check-in
            slot = db.query(models.ParkingSlot).filter(
                models.ParkingSlot.lot_id == lot_id,
                models.ParkingSlot.vehicle_type == v_type,
                models.ParkingSlot.status == "available"
            ).first()

            if not slot:
                # Lot full
                gate_log = models.GateLog(
                    lot_id=lot_id,
                    gate_type="entry",
                    plate_number=clean_plate,
                    vehicle_type=v_type,
                    confidence=confidence,
                    action_taken="entry_rejected_full",
                    slot_assigned=None,
                    snapshot_path=snapshot_path,
                    message=f"Entry denied. All {v_type} slots are currently full.",
                    timestamp=now
                )
                db.add(gate_log)
                db.commit()
                return {
                    "success": False,
                    "action": "lot_full",
                    "plate_number": clean_plate,
                    "vehicle_type": v_type,
                    "confidence": confidence,
                    "message": f"Sorry, parking is full for {v_type}s. Barrier remaining closed.",
                    "barrier_open": False,
                    "slot_number": None,
                    "booking_code": None,
                    "amount_due": 0.0,
                    "timestamp": now
                }

            # Create on-the-spot entry booking
            rate = calculate_rate(v_type, lot)
            slot.status = "occupied"
            slot.current_plate = clean_plate

            instant_booking_code = f"INST-{uuid.uuid4().hex[:6].upper()}"
            new_booking = models.Booking(
                booking_code=instant_booking_code,
                lot_id=lot.id,
                slot_id=slot.id,
                user_name="Spot Visitor",
                user_phone="9999999999",
                vehicle_number=clean_plate,
                vehicle_type=v_type,
                start_time=now,
                end_time=now + datetime.timedelta(hours=1),
                duration_hours=1.0,
                hourly_rate=rate,
                total_amount=rate,
                payment_status="pending",
                booking_status="checked_in",
                actual_entry_time=now,
                qr_token=f"QR_{instant_booking_code}",
                created_at=now
            )
            db.add(new_booking)

            gate_log = models.GateLog(
                lot_id=lot_id,
                gate_type="entry",
                plate_number=clean_plate,
                vehicle_type=v_type,
                confidence=confidence,
                action_taken="instant_entry_assigned",
                slot_assigned=slot.slot_number,
                snapshot_path=snapshot_path,
                message=f"Spot entry assigned to slot {slot.slot_number}. Rate: ₹{rate}/hr",
                timestamp=now
            )
            db.add(gate_log)
            db.commit()

            return {
                "success": True,
                "action": "instant_checkin",
                "plate_number": clean_plate,
                "vehicle_type": v_type,
                "confidence": confidence,
                "message": f"Spot check-in successful! Assigned Bay {slot.slot_number} (₹{rate}/hr). Gate opening.",
                "barrier_open": True,
                "slot_number": slot.slot_number,
                "booking_code": instant_booking_code,
                "amount_due": 0.0,
                "timestamp": now
            }

    else:
        # EXIT GATE LOGIC
        active_booking = db.query(models.Booking).filter(
            models.Booking.lot_id == lot_id,
            models.Booking.vehicle_number == clean_plate,
            models.Booking.booking_status == "checked_in"
        ).order_by(models.Booking.id.desc()).first()

        # If not found by status checked_in, search occupied slot
        slot = None
        if active_booking and active_booking.slot_id:
            slot = db.query(models.ParkingSlot).filter(models.ParkingSlot.id == active_booking.slot_id).first()
        else:
            slot = db.query(models.ParkingSlot).filter(
                models.ParkingSlot.lot_id == lot_id,
                models.ParkingSlot.current_plate == clean_plate
            ).first()

        amount_due = 0.0
        extra_fee = 0.0
        booking_code = None

        if active_booking:
            booking_code = active_booking.booking_code
            active_booking.actual_exit_time = now
            active_booking.booking_status = "completed"

            # Compute parked duration
            entry_time = active_booking.actual_entry_time or active_booking.start_time
            parked_seconds = (now - entry_time).total_seconds()
            parked_hours = max(0.1, parked_seconds / 3600.0)

            rate = active_booking.hourly_rate
            if active_booking.payment_status == "pending":
                # Spot booking needs full payment
                billable_hours = math.ceil(parked_hours)
                amount_due = billable_hours * rate
                active_booking.total_amount = amount_due
                active_booking.payment_status = "settled"
            else:
                # Pre-booked: check for overtime
                booked_duration = active_booking.duration_hours
                if parked_hours > booked_duration:
                    overtime = parked_hours - booked_duration
                    extra_fee = round(math.ceil(overtime) * rate, 2)
                    amount_due = extra_fee
                    active_booking.extra_charge = extra_fee

        if slot:
            slot.status = "available"
            slot.current_plate = None

        gate_log = models.GateLog(
            lot_id=lot_id,
            gate_type="exit",
            plate_number=clean_plate,
            vehicle_type=v_type,
            confidence=confidence,
            action_taken="checked_out_exit",
            slot_assigned=slot.slot_number if slot else None,
            snapshot_path=snapshot_path,
            message=f"Vehicle exited. Amount settled: ₹{amount_due}",
            timestamp=now
        )
        db.add(gate_log)
        db.commit()

        return {
            "success": True,
            "action": "checkout_cleared",
            "plate_number": clean_plate,
            "vehicle_type": v_type,
            "confidence": confidence,
            "message": f"Exit authorized for {clean_plate}. Slot released. Have a safe journey!",
            "barrier_open": True,
            "slot_number": slot.slot_number if slot else None,
            "booking_code": booking_code,
            "amount_due": amount_due,
            "timestamp": now
        }

def get_analytics(db: Session, lot_id: Optional[int] = None) -> dict:
    slot_query = db.query(models.ParkingSlot)
    booking_query = db.query(models.Booking)

    if lot_id:
        slot_query = slot_query.filter(models.ParkingSlot.lot_id == lot_id)
        booking_query = booking_query.filter(models.Booking.lot_id == lot_id)

    total_car_slots = slot_query.filter(models.ParkingSlot.vehicle_type == "car").count()
    total_bike_slots = slot_query.filter(models.ParkingSlot.vehicle_type == "bike").count()

    avail_car_slots = slot_query.filter(
        models.ParkingSlot.vehicle_type == "car",
        models.ParkingSlot.status == "available"
    ).count()

    avail_bike_slots = slot_query.filter(
        models.ParkingSlot.vehicle_type == "bike",
        models.ParkingSlot.status == "available"
    ).count()

    occupied_slots = slot_query.filter(models.ParkingSlot.status.in_(["occupied", "booked"])).count()
    active_parkings = slot_query.filter(models.ParkingSlot.status == "occupied").count()

    total_bookings = booking_query.count()
    total_rev = db.query(func.sum(models.Booking.total_amount + models.Booking.extra_charge)).scalar() or 0.0

    car_occ_rate = round(((total_car_slots - avail_car_slots) / max(1, total_car_slots)) * 100.0, 1)
    bike_occ_rate = round(((total_bike_slots - avail_bike_slots) / max(1, total_bike_slots)) * 100.0, 1)

    return {
        "total_revenue": round(float(total_rev), 2),
        "active_parkings": active_parkings,
        "total_bookings": total_bookings,
        "available_car_slots": avail_car_slots,
        "available_bike_slots": avail_bike_slots,
        "occupied_slots": occupied_slots,
        "car_occupancy_rate": car_occ_rate,
        "bike_occupancy_rate": bike_occ_rate
    }
