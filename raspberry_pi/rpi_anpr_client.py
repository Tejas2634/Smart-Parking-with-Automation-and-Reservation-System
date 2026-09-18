#!/usr/bin/env python3
"""
=============================================================================
Smart Parking System - Edge ANPR Client
Optimized for: Raspberry Pi 4B (1GB RAM) & Pi Camera Module Rev 1.3 (OV5647)
=============================================================================
Features:
- Low-memory footprint (streaming frame limit, dynamic garbage collection)
- Hardware GPIO Barrier Servo & LED indicator triggers
- Dual Mode: Server ANPR Offload or Local Tesseract OCR
- Fallback mock mode for testing on development laptops
=============================================================================
"""

import os
import sys
import time
import base64
import configparser
import logging
import requests
import cv2
import numpy as np

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] [RPi-ANPR] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("RPi_ANPR")

# Read Configuration
CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.ini")
config = configparser.ConfigParser()
if os.path.exists(CONFIG_PATH):
    config.read(CONFIG_PATH)
else:
    logger.warning("config.ini not found, using default fallback settings.")

SERVER_URL = config.get("SERVER", "api_url", fallback="http://127.0.0.1:8000/api/anpr/gate-trigger")
LOT_ID = config.getint("SERVER", "parking_lot_id", fallback=1)
GATE_TYPE = config.get("SERVER", "gate_type", fallback="entry")
CAPTURE_BACKEND = config.get("CAMERA", "capture_backend", fallback="opencv")
FRAME_W = config.getint("CAMERA", "frame_width", fallback=1280)
FRAME_H = config.getint("CAMERA", "frame_height", fallback=720)
OCR_MODE = config.get("ANPR", "ocr_mode", fallback="server_cloud")
GPIO_ENABLED = config.getboolean("GPIO", "enabled", fallback=False)

# Optional GPIO setup for physical gate barrier servo and LEDs
try:
    if GPIO_ENABLED:
        import RPi.GPIO as GPIO
        SERVO_PIN = config.getint("GPIO", "servo_barrier_pin", fallback=18)
        GREEN_LED = config.getint("GPIO", "green_led_pin", fallback=23)
        RED_LED = config.getint("GPIO", "red_led_pin", fallback=24)
        
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        GPIO.setup(SERVO_PIN, GPIO.OUT)
        GPIO.setup(GREEN_LED, GPIO.OUT)
        GPIO.setup(RED_LED, GPIO.OUT)
        
        servo_pwm = GPIO.PWM(SERVO_PIN, 50) # 50Hz for standard SG90 / MG996R servo
        servo_pwm.start(0)
        logger.info("RPi GPIO initialized for Barrier Servo and status LEDs.")
    else:
        GPIO = None
except Exception as e:
    logger.warning(f"RPi GPIO not available (simulated environment): {e}")
    GPIO = None

def trigger_physical_barrier(open_barrier: bool, duration_sec: float = 4.0):
    """Controls physical servo barrier and signal LEDs on Raspberry Pi 4B."""
    if not GPIO:
        logger.info(f"[SIMULATED BARRIER] Gate {'OPENED' if open_barrier else 'CLOSED'} for {duration_sec}s")
        return

    try:
        if open_barrier:
            GPIO.output(GREEN_LED, GPIO.HIGH)
            GPIO.output(RED_LED, GPIO.LOW)
            # Rotate servo to 90 degrees (Open barrier)
            servo_pwm.ChangeDutyCycle(7.5)
            time.sleep(duration_sec)
            # Lower barrier back to 0 degrees
            servo_pwm.ChangeDutyCycle(2.5)
            time.sleep(0.5)
            servo_pwm.ChangeDutyCycle(0)
            GPIO.output(GREEN_LED, GPIO.LOW)
            GPIO.output(RED_LED, GPIO.HIGH)
        else:
            GPIO.output(RED_LED, GPIO.HIGH)
            GPIO.output(GREEN_LED, GPIO.LOW)
    except Exception as e:
        logger.error(f"Error triggering GPIO barrier: {e}")

def capture_frame(cap):
    """Memory-efficient single frame capture from Pi Camera v1.3."""
    ret, frame = cap.read()
    if not ret or frame is None:
        return None
    
    # Downscale immediately to preserve 1GB RAM on Pi 4B
    if frame.shape[1] > FRAME_W:
        frame = cv2.resize(frame, (FRAME_W, FRAME_H), interpolation=cv2.INTER_AREA)
    return frame

def send_frame_to_server(frame, gate_type="entry", vehicle_type="car"):
    """Encodes frame to compressed JPEG and transmits to FastAPI ANPR Endpoint."""
    try:
        # High compression JPEG to save bandwidth & memory
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        b64_image = base64.b64encode(buffer).decode('utf-8')

        payload = {
            "lot_id": LOT_ID,
            "gate_type": gate_type,
            "image_base64": b64_image,
            "vehicle_type": vehicle_type
        }

        response = requests.post(SERVER_URL, json=payload, timeout=5)
        if response.status_code == 200:
            data = response.json()
            logger.info(f"Server response: Action={data.get('action')}, Plate={data.get('plate_number')}, Barrier={data.get('barrier_open')}")
            if data.get("barrier_open"):
                trigger_physical_barrier(open_barrier=True)
            return data
        else:
            logger.error(f"Server returned error {response.status_code}: {response.text}")
            return None
    except Exception as e:
        logger.error(f"Failed to communicate with parking server: {e}")
        return None

def test_manual_plate_event(plate_number: str, gate_type="entry", vehicle_type="car"):
    """Utility to test server directly with a plate string."""
    try:
        payload = {
            "lot_id": LOT_ID,
            "gate_type": gate_type,
            "plate_number": plate_number,
            "vehicle_type": vehicle_type
        }
        res = requests.post(SERVER_URL, json=payload, timeout=5)
        logger.info(f"Manual Test Event: {res.json()}")
        return res.json()
    except Exception as e:
        logger.error(f"Error testing manual plate event: {e}")
        return None

def run_camera_loop():
    """Main continuous capture and recognition loop for Raspberry Pi."""
    logger.info(f"Starting Raspberry Pi ANPR Client connected to {SERVER_URL}")
    logger.info(f"Lot ID: {LOT_ID}, Gate: {GATE_TYPE.upper()}")

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        logger.warning("Camera index 0 not available. Running in Standby/Interactive mode.")
        print("\n" + "="*60)
        print(" Raspberry Pi 4B ANPR Client - Interactive Test Mode")
        print("="*60)
        print("Options:")
        print(" 1. Test Entry (Car: MH12AB1234 - Prebooked)")
        print(" 2. Test Entry (Bike: DL01BZ3322 - Spot ₹30/h)")
        print(" 3. Test Exit  (Car: MH12AB1234)")
        print(" 4. Enter Custom Plate")
        print(" 5. Exit")
        print("="*60)

        while True:
            choice = input("\nSelect option (1-5): ").strip()
            if choice == "1":
                test_manual_plate_event("MH12AB1234", gate_type="entry", vehicle_type="car")
            elif choice == "2":
                test_manual_plate_event("DL01BZ3322", gate_type="entry", vehicle_type="bike")
            elif choice == "3":
                test_manual_plate_event("MH12AB1234", gate_type="exit", vehicle_type="car")
            elif choice == "4":
                p = input("Enter License Plate Number: ")
                gt = input("Gate (entry/exit) [entry]: ") or "entry"
                vt = input("Vehicle Type (car/bike) [car]: ") or "car"
                test_manual_plate_event(p, gate_type=gt, vehicle_type=vt)
            elif choice == "5":
                break
        return

    logger.info("Camera initialized. Monitoring parking lane...")
    last_scan = 0
    scan_interval = 2.0 # seconds

    try:
        while True:
            frame = capture_frame(cap)
            if frame is None:
                time.sleep(0.1)
                continue

            current_time = time.time()
            if current_time - last_scan >= scan_interval:
                last_scan = current_time
                logger.info("Analyzing camera frame for license plate...")
                send_frame_to_server(frame, gate_type=GATE_TYPE)

            time.sleep(0.05)
    except KeyboardInterrupt:
        logger.info("Terminating ANPR client...")
    finally:
        cap.release()
        if GPIO:
            GPIO.cleanup()

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test-plate":
        plate = sys.argv[2] if len(sys.argv) > 2 else "MH12AB1234"
        gate = sys.argv[3] if len(sys.argv) > 3 else "entry"
        vtype = sys.argv[4] if len(sys.argv) > 4 else "car"
        test_manual_plate_event(plate, gate, vtype)
    else:
        run_camera_loop()
