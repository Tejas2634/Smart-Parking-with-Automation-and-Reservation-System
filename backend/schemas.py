import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

# --- Parking Lot Schemas ---
class ParkingLotBase(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    car_rate_per_hour: float = 50.0
    bike_rate_per_hour: float = 30.0
    car_capacity: int = 20
    bike_capacity: int = 30

class ParkingLotOut(ParkingLotBase):
    id: int
    is_active: bool
    distance_km: Optional[float] = None
    available_car_slots: Optional[int] = 0
    available_bike_slots: Optional[int] = 0
    total_available_slots: Optional[int] = 0

    class Config:
        from_attributes = True

# --- Parking Slot Schemas ---
class ParkingSlotBase(BaseModel):
    slot_number: str
    vehicle_type: str
    section: str = "A"
    floor: int = 1

class ParkingSlotOut(ParkingSlotBase):
    id: int
    lot_id: int
    status: str
    current_plate: Optional[str] = None
    updated_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True

# --- Booking Schemas ---
class BookingCreate(BaseModel):
    lot_id: int
    vehicle_type: str = Field(..., description="'car' or 'bike'")
    vehicle_number: str
    user_name: str
    user_phone: str
    user_email: Optional[str] = None
    start_time: datetime.datetime
    duration_hours: float = Field(..., gt=0)
    slot_id: Optional[int] = None

class BookingOut(BaseModel):
    id: int
    booking_code: str
    lot_id: int
    slot_id: Optional[int]
    slot_number: Optional[str] = None
    lot_name: Optional[str] = None
    user_name: str
    user_phone: str
    user_email: Optional[str]
    vehicle_number: str
    vehicle_type: str
    start_time: datetime.datetime
    end_time: datetime.datetime
    duration_hours: float
    hourly_rate: float
    total_amount: float
    payment_status: str
    booking_status: str
    actual_entry_time: Optional[datetime.datetime] = None
    actual_exit_time: Optional[datetime.datetime] = None
    extra_charge: float = 0.0
    qr_token: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# --- ANPR & Gate Schemas ---
class ANPRScanRequest(BaseModel):
    lot_id: int
    gate_type: str = "entry" # "entry" or "exit"
    plate_number: Optional[str] = None
    image_base64: Optional[str] = None
    vehicle_type: Optional[str] = "car"

class GateEventResponse(BaseModel):
    success: bool
    action: str
    plate_number: str
    vehicle_type: str
    confidence: float
    message: str
    barrier_open: bool
    slot_number: Optional[str] = None
    booking_code: Optional[str] = None
    amount_due: float = 0.0
    timestamp: datetime.datetime

class GateLogOut(BaseModel):
    id: int
    lot_id: int
    gate_type: str
    plate_number: str
    vehicle_type: str
    confidence: float
    action_taken: str
    slot_assigned: Optional[str] = None
    message: Optional[str] = None
    timestamp: datetime.datetime

    class Config:
        from_attributes = True

class AnalyticsOut(BaseModel):
    total_revenue: float
    active_parkings: int
    total_bookings: int
    available_car_slots: int
    available_bike_slots: int
    occupied_slots: int
    car_occupancy_rate: float
    bike_occupancy_rate: float
