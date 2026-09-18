import sys
import os
import datetime
from sqlalchemy.orm import Session

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, Base, engine
from backend import models, crud, schemas
from backend.seed_data import seed_database

def test_smart_parking_system():
    print("=== Running Smart Parking System Test Suite ===")
    
    # Ensure DB is seeded
    seed_database()
    db: Session = SessionLocal()

    try:
        # 1. Test Parking Lots & Nearest Distance Calculation
        print("\n[Test 1] Testing Nearest Parking Location Tracer...")
        user_lat = 28.4980
        user_lon = 77.0850
        lots = crud.get_parking_lots(db, user_lat=user_lat, user_lon=user_lon)
        assert len(lots) > 0, "No parking lots returned"
        assert lots[0]["distance_km"] is not None, "Distance not calculated"
        print(f"Nearest Lot: {lots[0]['name']} at {lots[0]['distance_km']} km away")

        # 2. Test Pricing Calculation (Car: ₹50/h, Bike: ₹30/h)
        print("\n[Test 2] Testing Pricing Rates...")
        car_rate = crud.calculate_rate("car", None)
        bike_rate = crud.calculate_rate("bike", None)
        assert car_rate == 50.0, f"Car rate mismatch: expected 50.0, got {car_rate}"
        assert bike_rate == 30.0, f"Bike rate mismatch: expected 30.0, got {bike_rate}"
        print(f"Verified Rates -> Car: Rs. {car_rate}/hr, Bike: Rs. {bike_rate}/hr")

        # 3. Test Pre-Booking Flow (Car for 3 hours -> ₹150)
        print("\n[Test 3] Testing Pre-booking creation...")
        test_plate = "DL09XY1122"
        now = datetime.datetime.utcnow()
        booking_data = schemas.BookingCreate(
            lot_id=1,
            vehicle_type="car",
            vehicle_number=test_plate,
            user_name="John Doe",
            user_phone="9876543210",
            start_time=now,
            duration_hours=3.0
        )
        booking = crud.create_booking(db, booking_data)
        assert booking.total_amount == 150.0, f"Expected total ₹150.0, got {booking.total_amount}"
        assert booking.booking_status == "confirmed"
        print(f"Booking created: Code={booking.booking_code}, Amount=Rs. {booking.total_amount}, QR={booking.qr_token}")

        # 4. Test ANPR Gate Entry for Pre-Booked Vehicle
        print("\n[Test 4] Testing ANPR Gate Entry (Check-In)...")
        entry_event = crud.process_gate_event(
            db=db,
            lot_id=1,
            gate_type="entry",
            plate_number=test_plate,
            vehicle_type="car"
        )
        assert entry_event["barrier_open"] is True, "Barrier should open for pre-booked vehicle"
        assert entry_event["action"] == "prebooked_checkin"
        print(f"Gate Entry Response: {entry_event['message']}")

        # 5. Test ANPR Gate Exit (Check-Out)
        print("\n[Test 5] Testing ANPR Gate Exit (Check-Out)...")
        exit_event = crud.process_gate_event(
            db=db,
            lot_id=1,
            gate_type="exit",
            plate_number=test_plate,
            vehicle_type="car"
        )
        assert exit_event["barrier_open"] is True, "Barrier should open on checkout"
        assert exit_event["action"] == "checkout_cleared"
        print(f"Gate Exit Response: {exit_event['message']}")

        # 6. Test Bike Spot Booking (Rs. 30/hr)
        print("\n[Test 6] Testing Spot Bike Check-in (Rs. 30/hr)...")
        spot_bike_plate = "KA03ZZ9988"
        spot_entry = crud.process_gate_event(
            db=db,
            lot_id=1,
            gate_type="entry",
            plate_number=spot_bike_plate,
            vehicle_type="bike"
        )
        assert spot_entry["barrier_open"] is True
        assert spot_entry["action"] == "instant_checkin"
        print(f"Spot Bike Entry: {spot_entry['message']}")

        # 7. Test Analytics
        print("\n[Test 7] Testing System Analytics...")
        analytics = crud.get_analytics(db, lot_id=1)
        print(f"Analytics Data: Revenue=Rs. {analytics['total_revenue']}, Active={analytics['active_parkings']}, Bookings={analytics['total_bookings']}")

        print("\n=== ALL TESTS PASSED SUCCESSFULLY! ===")
    finally:
        db.close()

if __name__ == "__main__":
    test_smart_parking_system()
