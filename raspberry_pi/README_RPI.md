# 🍓 Raspberry Pi 4B (1GB RAM) + Camera Module v1.3 ANPR Integration

This module connects a **Raspberry Pi 4B (1GB RAM)** and an **OmniVision OV5647 Camera Module Rev 1.3** to the **Smart Parking System**.

---

## 🛠️ Hardware Requirements & Pinout

1. **Raspberry Pi 4 Model B** (1GB / 2GB / 4GB RAM)
2. **Raspberry Pi Camera Module Rev 1.3** (5MP OV5647 sensor)
3. **15-pin FFC Ribbon Cable** (Silver contacts facing the micro-HDMI port on Pi 4B)
4. **SG90 / MG996R Servo Motor** (Physical boom barrier arm)
5. **Red & Green 5mm LEDs + 220Ω Resistors** (Entry/Exit indicators)

### GPIO Pin Mapping (BCM Mode)

| Component | Pin (BCM) | Physical Header Pin | Description |
|---|---|---|---|
| **Barrier Servo PWM** | `GPIO 18` | Pin 12 | PWM signal (50Hz) for 0° to 90° barrier lift |
| **Green LED (Open)** | `GPIO 23` | Pin 16 | Signals allowed entry / valid booking |
| **Red LED (Stop)** | `GPIO 24` | Pin 18 | Signals barrier closed / occupied lot |
| **Buzzer** | `GPIO 25` | Pin 22 | Beep confirmation on plate scan |
| **Servo Power (+5V)**| `5V` | Pin 2 / 4 | External 5V recommended for high-torque servo |
| **Ground (GND)** | `GND` | Pin 6 / 9 / 14 | Common Ground |

---

## 🚀 Step-by-Step Setup on Raspberry Pi

### 1. Connect the Camera
1. Gently pull up the plastic collar on the Pi 4B's **CAMERA (CSI)** port.
2. Insert the 15-pin ribbon cable with the **silver contact pins facing towards the micro-HDMI connectors** and blue tape facing the Ethernet port.
3. Push the collar down to lock the cable firmly.

### 2. Run the Installer
On your Raspberry Pi terminal:
```bash
cd raspberry_pi
chmod +x install_pi.sh
./install_pi.sh
```

### 3. Configure Server Connection
Open `config.ini`:
```ini
[SERVER]
api_url = http://<YOUR_LAPTOP_OR_SERVER_IP>:8000/api/anpr/gate-trigger
parking_lot_id = 1
gate_type = entry

[CAMERA]
capture_backend = opencv
camera_index = 0
frame_width = 1280
frame_height = 720
fps = 15

[GPIO]
enabled = true
servo_barrier_pin = 18
green_led_pin = 23
red_led_pin = 24
```

### 4. Start the ANPR Client
```bash
python3 rpi_anpr_client.py
```

---

## ⚡ 1GB RAM Optimizations Implemented
- **Memory Safeguard**: Frames are capped to 720p / 480p capture resolution buffers to prevent memory spikes.
- **Server Offloading**: Heavy deep learning / OCR image processing can be handled asynchronously by the backend server while the Pi acts as a lightweight edge IoT node.
- **Contour Filtering**: Only crops rectangular aspect-ratio license candidates before running OCR.
