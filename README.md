# 🅿️ SmartPark AI - Smart Parking System with Raspberry Pi 4B & ANPR

A production-grade, full-stack Smart Parking Management & Pre-Booking Platform with edge Automatic Number Plate Recognition (ANPR) integration for **Raspberry Pi 4B (1GB RAM)** and **Pi Camera Module Rev 1.3**.

---

## 🌟 Key Features

1. 📱 **Responsive Multi-Device Web Interface**: Built with modern Tailwind CSS & glassmorphism design, working on mobile phones, tablets, and desktop laptops.
2. 🗺️ **Nearest Location Tracer**: Real-time GPS location tracer with interactive Leaflet map, distance calculation, driving time estimation, and parking hub selector.
3. 💰 **Automated Dynamic Pricing**:
   - **Bike Parking**: **₹30 / hour**
   - **Car Parking**: **₹50 / hour**
4. 🅿️ **2D Interactive Parking Floor Plan**: Visual real-time bay occupancy (Available, Pre-booked, Occupied) with 1-click slot booking.
5. 🎫 **Pre-Booking & Instant QR Entry Pass**: Select dates, duration, vehicle type, and download/print verified QR passes.
6. 📷 **Edge ANPR Engine (Raspberry Pi 4B + Rev 1.3 Cam)**:
   - Low memory footprint (< 100MB) tailored for **1GB RAM Pi 4B**.
   - Automatic plate recognition and servo barrier gate triggers.
   - Entry check-in and exit check-out with automatic billing calculation.
7. 📊 **Admin & Operator Dashboard**: Revenue analytics, occupancy rates, and real-time gate audit logs.

---

## 🏗️ Project Architecture

```
smart_parking_system/
├── backend/
│   ├── database.py       # SQLite engine & session manager
│   ├── models.py         # SQLAlchemy models (Lot, Slot, Booking, GateLog)
│   ├── schemas.py        # Pydantic validation schemas
│   ├── crud.py           # Rate calculation & booking business logic
│   ├── anpr_engine.py    # Plate recognition & OCR preprocessing
│   ├── seed_data.py      # Preloaded sample hubs & slots
│   └── main.py           # FastAPI server, REST routes & WebSockets
├── frontend/
│   ├── index.html        # Responsive Single-Page Application (SPA)
│   └── static/
│       ├── css/style.css # Dark theme & glassmorphic styling
│       └── js/
│           ├── app.js    # Tab routing, WebSocket listener, toasts
│           ├── map.js    # Nearest parking location tracer & Leaflet map
│           ├── slots.js  # 2D interactive slot matrix visualizer
│           ├── booking.js# Pre-booking form & QR ticket generation
│           ├── anpr.js   # Gate barrier simulation & ANPR upload
│           └── admin.js  # Revenue analytics & KPIs
├── raspberry_pi/
│   ├── rpi_anpr_client.py  # Standalone low-memory client for Pi 4B
│   ├── config.ini          # Server endpoint & camera config
│   ├── install_pi.sh       # Dependency installer for Pi OS
│   └── README_RPI.md       # Hardware wiring & GPIO setup guide
├── requirements.txt
├── run.py                 # One-click server launcher
└── README.md
```

---

## 🚀 Getting Started

### 1. Run the Backend Server & Web UI
```bash
# In project root
python run.py
```
Open your browser at: **[http://127.0.0.1:8000](http://127.0.0.1:8000)**  
Interactive Swagger API documentation: **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**

---

### 2. Connect Raspberry Pi 4B
1. Plug the **Pi Camera Rev 1.3** into the CSI port on the Raspberry Pi 4B.
2. In the `raspberry_pi/` directory on your Pi:
   ```bash
   chmod +x install_pi.sh
   ./install_pi.sh
   ```
3. Update `config.ini` with your laptop / server IP:
   ```ini
   api_url = http://192.168.1.100:8000/api/anpr/gate-trigger
   ```
4. Start the ANPR client:
   ```bash
   python3 rpi_anpr_client.py
   ```
