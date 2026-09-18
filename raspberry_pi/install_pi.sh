#!/usr/bin/env bash
# ==============================================================================
# Smart Parking System - Raspberry Pi 4B (1GB RAM) Setup Script
# Works on Raspberry Pi OS (Bullseye / Bookworm - 32-bit & 64-bit)
# ==============================================================================

set -e

echo "========================================================"
echo " Setting up Smart Parking ANPR Client on Raspberry Pi 4B "
echo "========================================================"

# 1. Update system packages
echo "[1/4] Updating APT package index..."
sudo apt update && sudo apt upgrade -y

# 2. Install camera, OpenCV and OCR dependencies
echo "[2/4] Installing system dependencies (OpenCV, Tesseract, libcamera)..."
sudo apt install -y \
    python3-pip \
    python3-dev \
    python3-opencv \
    tesseract-ocr \
    libtesseract-dev \
    libatlas-base-dev \
    libcamera-tools \
    python3-picamera2 \
    python3-rpi.gpio

# 3. Install required Python packages
echo "[3/4] Installing Python dependencies..."
pip3 install requests pillow pytesseract numpy

# 4. Enable Legacy Camera or Libcamera interface if required
echo "[4/4] Camera interface configuration..."
echo "Ensure Camera Module Rev 1.3 is connected firmly to the CSI ribbon slot (pins facing HDMI port)."

echo ""
echo "========================================================"
echo " Setup complete! "
echo " Edit config.ini with your server IP address, then run: "
echo "   python3 rpi_anpr_client.py"
echo "========================================================"
