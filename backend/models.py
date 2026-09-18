import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text, Boolean
from sqlalchemy.orm import relationship
from .database import Base

class ParkingLot(Base):
    __tablename__ = "parking_lots"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    address = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    car_rate_per_hour = Column(Float, default=50.0)
    bike_rate_per_hour = Column(Float, default=30.0)
    car_capacity = Column(Integer, default=20)
    bike_capacity = Column(Integer, default=30)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    slots = relationship("ParkingSlot", back_populates="lot", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="lot")
    gate_logs = relationship("GateLog", back_populates="lot")


class ParkingSlot(Base):
    __tablename__ = "parking_slots"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False)
    slot_number = Column(String(20), nullable=False)   # e.g., "C-01", "B-05"
    vehicle_type = Column(String(10), nullable=False)  # "car" or "bike"
    status = Column(String(20), default="available")   # "available", "booked", "occupied", "maintenance"
    section = Column(String(20), default="A")          # "Ground A", "Upper Deck", etc.
    floor = Column(Integer, default=1)
    current_plate = Column(String(30), nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    lot = relationship("ParkingLot", back_populates="slots")
    bookings = relationship("Booking", back_populates="slot")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    booking_code = Column(String(32), unique=True, index=True, nullable=False) # e.g. "SPK-98321"
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False)
    slot_id = Column(Integer, ForeignKey("parking_slots.id"), nullable=True)
    user_name = Column(String(100), nullable=False)
    user_phone = Column(String(20), nullable=False)
    user_email = Column(String(100), nullable=True)
    vehicle_number = Column(String(30), index=True, nullable=False)
    vehicle_type = Column(String(10), nullable=False)  # "car" or "bike"
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    duration_hours = Column(Float, nullable=False)
    hourly_rate = Column(Float, nullable=False)       # 50.0 for car, 30.0 for bike
    total_amount = Column(Float, nullable=False)
    payment_status = Column(String(20), default="paid") # "paid", "pending", "settled"
    booking_status = Column(String(20), default="confirmed") # "confirmed", "checked_in", "completed", "cancelled"
    actual_entry_time = Column(DateTime, nullable=True)
    actual_exit_time = Column(DateTime, nullable=True)
    extra_charge = Column(Float, default=0.0)
    qr_token = Column(String(64), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    lot = relationship("ParkingLot", back_populates="bookings")
    slot = relationship("ParkingSlot", back_populates="bookings")


class GateLog(Base):
    __tablename__ = "gate_logs"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False)
    gate_type = Column(String(10), nullable=False)      # "entry" or "exit"
    plate_number = Column(String(30), nullable=False)
    vehicle_type = Column(String(10), default="car")
    confidence = Column(Float, default=0.95)
    action_taken = Column(String(50), nullable=False)   # "checked_in", "checked_out", "unregistered_entry", "barrier_raised"
    slot_assigned = Column(String(20), nullable=True)
    snapshot_path = Column(String(255), nullable=True)
    message = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    lot = relationship("ParkingLot", back_populates="gate_logs")
