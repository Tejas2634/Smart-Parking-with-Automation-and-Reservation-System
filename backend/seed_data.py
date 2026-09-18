import datetime
from sqlalchemy.orm import Session
from .database import engine, Base, SessionLocal
from . import models

def seed_database():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # Check existing lots count
        existing_count = db.query(models.ParkingLot).count()
        if existing_count >= 8:
            print("Jalgaon detailed parking hubs already seeded.")
            return

        # Clean old records to refresh with rich Jalgaon ground landmarks
        db.query(models.GateLog).delete()
        db.query(models.Booking).delete()
        db.query(models.ParkingSlot).delete()
        db.query(models.ParkingLot).delete()
        db.commit()

        print("Seeding Detailed Jalgaon, Maharashtra Grounds & Smart Parking Locations...")

        # Rich, Real-World Jalgaon Landmarks with Ground details and exact GPS
        jalgaon_grounds = [
            {
                "name": "Jalgaon Junction Railway Station Parking Ground",
                "address": "Platform 1 Circulating Area, Station Road, Jalgaon, Maharashtra 425001",
                "latitude": 21.0105,
                "longitude": 75.5683,
                "car_rate_per_hour": 50.0,
                "bike_rate_per_hour": 30.0,
                "car_capacity": 30,
                "bike_capacity": 50,
            },
            {
                "name": "Shivtirth Ground (शिवतीर्थ मैदान) Public Parking",
                "address": "Civil Lines, Near Collector Office & Zilla Parishad, Jalgaon, Maharashtra 425001",
                "latitude": 21.0089,
                "longitude": 75.5552,
                "car_rate_per_hour": 50.0,
                "bike_rate_per_hour": 30.0,
                "car_capacity": 40,
                "bike_capacity": 60,
            },
            {
                "name": "Khandesh Central Mall Multi-Level Parking",
                "address": "Opposite Railway Station, Station Road, Nehru Chowk, Jalgaon, Maharashtra 425001",
                "latitude": 21.0028,
                "longitude": 75.5601,
                "car_rate_per_hour": 50.0,
                "bike_rate_per_hour": 30.0,
                "car_capacity": 35,
                "bike_capacity": 45,
            },
            {
                "name": "Golani Commercial Complex & Basement Ground",
                "address": "Golani Market, Navi Peth, Central Commercial Area, Jalgaon, Maharashtra 425001",
                "latitude": 21.0076,
                "longitude": 75.5645,
                "car_rate_per_hour": 50.0,
                "bike_rate_per_hour": 30.0,
                "car_capacity": 25,
                "bike_capacity": 40,
            },
            {
                "name": "Old BJ Market (बी. जे. मार्केट) & Dana Bazar Ground",
                "address": "Dana Bazar, BJ Market Road, Jalgaon, Maharashtra 425001",
                "latitude": 21.0050,
                "longitude": 75.5620,
                "car_rate_per_hour": 50.0,
                "bike_rate_per_hour": 30.0,
                "car_capacity": 20,
                "bike_capacity": 30,
            },
            {
                "name": "Mehrun Lake & Garden Promenade Parking Ground",
                "address": "Mehrun Talav Ring Road, Near Shivaji Nagar, Jalgaon, Maharashtra 425003",
                "latitude": 20.9890,
                "longitude": 75.5800,
                "car_rate_per_hour": 50.0,
                "bike_rate_per_hour": 30.0,
                "car_capacity": 30,
                "bike_capacity": 50,
            },
            {
                "name": "KBC North Maharashtra University (NMU) Main Gate Parking",
                "address": "NMU Campus Entrance, Umavi Nagar, Jalgaon, Maharashtra 425001",
                "latitude": 20.9785,
                "longitude": 75.4985,
                "car_rate_per_hour": 50.0,
                "bike_rate_per_hour": 30.0,
                "car_capacity": 30,
                "bike_capacity": 60,
            },
            {
                "name": "MIDC Ajanta Road Industrial Logistic Bay",
                "address": "Sector F, Ajanta Road, MIDC Industrial Area, Jalgaon, Maharashtra 425003",
                "latitude": 20.9780,
                "longitude": 75.5820,
                "car_rate_per_hour": 50.0,
                "bike_rate_per_hour": 30.0,
                "car_capacity": 25,
                "bike_capacity": 35,
            }
        ]

        created_lots = []
        for lot_data in jalgaon_grounds:
            lot = models.ParkingLot(**lot_data)
            db.add(lot)
            db.flush()
            created_lots.append(lot)

            # Generate Car Bays (C-01 to C-N)
            for i in range(1, lot.car_capacity + 1):
                slot_num = f"C-{i:02d}"
                status = "available"
                current_plate = None
                if i == 2:
                    status = "occupied"
                    current_plate = "MH19BJ1234"
                elif i == 4:
                    status = "booked"
                    current_plate = "MH19CV9876"
                elif i == 7:
                    status = "occupied"
                    current_plate = "MH19AA4455"

                slot = models.ParkingSlot(
                    lot_id=lot.id,
                    slot_number=slot_num,
                    vehicle_type="car",
                    status=status,
                    section="Ground Deck A" if i <= 15 else "Deck B",
                    floor=1 if i <= 15 else 2,
                    current_plate=current_plate
                )
                db.add(slot)

            # Generate Bike Bays (B-01 to B-N)
            for i in range(1, lot.bike_capacity + 1):
                slot_num = f"B-{i:02d}"
                status = "available"
                current_plate = None
                if i == 1:
                    status = "occupied"
                    current_plate = "MH19EK7788"
                elif i == 3:
                    status = "booked"
                    current_plate = "MH19DZ2211"

                slot = models.ParkingSlot(
                    lot_id=lot.id,
                    slot_number=slot_num,
                    vehicle_type="bike",
                    status=status,
                    section="Bike Ground Zone 1" if i <= 20 else "Bike Zone 2",
                    floor=1,
                    current_plate=current_plate
                )
                db.add(slot)

        db.commit()

        # Seed sample confirmed booking & logs
        first_lot = created_lots[0]
        now = datetime.datetime.utcnow()

        sample_booking = models.Booking(
            booking_code="SPK-JAL01",
            lot_id=first_lot.id,
            slot_id=4,
            user_name="Aniket Patil",
            user_phone="+91 94222 12345",
            user_email="aniket.patil@example.com",
            vehicle_number="MH19CV9876",
            vehicle_type="car",
            start_time=now,
            end_time=now + datetime.timedelta(hours=2),
            duration_hours=2.0,
            hourly_rate=50.0,
            total_amount=100.0,
            payment_status="paid",
            booking_status="confirmed",
            qr_token="QR_SPK-JAL01_ACTIVE",
            created_at=now - datetime.timedelta(minutes=25)
        )
        db.add(sample_booking)

        sample_logs = [
            models.GateLog(
                lot_id=first_lot.id,
                gate_type="entry",
                plate_number="MH19BJ1234",
                vehicle_type="car",
                confidence=0.98,
                action_taken="checked_in_prebooked",
                slot_assigned="C-02",
                message="Pre-booked Jalgaon vehicle verified at Entry Gate.",
                timestamp=now - datetime.timedelta(minutes=40)
            ),
            models.GateLog(
                lot_id=first_lot.id,
                gate_type="entry",
                plate_number="MH19EK7788",
                vehicle_type="bike",
                confidence=0.95,
                action_taken="instant_entry_assigned",
                slot_assigned="B-01",
                message="Spot bike entry assigned Bay B-01 (Rate: Rs. 30/hr).",
                timestamp=now - datetime.timedelta(minutes=15)
            )
        ]
        for lg in sample_logs:
            db.add(lg)

        db.commit()
        print("Detailed Jalgaon grounds and parking hubs seeded successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
