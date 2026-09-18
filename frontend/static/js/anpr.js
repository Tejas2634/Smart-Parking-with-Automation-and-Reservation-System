// ANPR Scanner with Dual-Engine (Client-Side Tesseract.js + Server OpenCV)
let webcamStream = null;
let tesseractWorker = null;

// Initialize Tesseract.js worker in background
document.addEventListener('DOMContentLoaded', () => {
  initClientOCR();
});

async function initClientOCR() {
  if (window.Tesseract) {
    try {
      console.log("[OCR] Pre-warming client OCR engine...");
    } catch (e) {
      console.warn("Client OCR init note:", e);
    }
  }
}

// Regex matching Indian vehicle plates (e.g. MH19BJ1234, DL08CA9876, MH 19 CV 9876)
function extractIndianPlateRegex(rawText) {
  if (!rawText) return null;

  // Clean characters
  const upper = rawText.toUpperCase();

  // Pattern 1: Strict state code + RTO + Series + 4 digits
  const strictPattern = /([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{1,3}\s*[0-9]{3,4})/g;
  const matches = upper.match(strictPattern);
  if (matches && matches.length > 0) {
    return matches[0].replace(/[^A-Z0-9]/g, '');
  }

  // Pattern 2: Any 8 to 10 alphanumeric block starting with state code letters
  const alphanumeric = upper.replace(/[^A-Z0-9]/g, '');
  if (alphanumeric.length >= 8 && alphanumeric.length <= 11) {
    return alphanumeric;
  }

  return alphanumeric.length >= 4 ? alphanumeric : null;
}

// 🎥 LIVE CAMERA SCANNER (Mobile & Laptop WebCam)
async function toggleLiveWebcamScanner() {
  const video = document.getElementById('liveWebcamVideo');
  const container = document.getElementById('webcamContainer');
  const barrierGraphic = document.getElementById('barrierGraphicContainer');
  const toggleBtn = document.getElementById('toggleWebcamBtn');
  const captureBtn = document.getElementById('captureWebcamBtn');

  if (webcamStream) {
    // Stop camera
    webcamStream.getTracks().forEach(t => t.stop());
    webcamStream = null;
    if (video) video.srcObject = null;
    if (container) container.classList.add('hidden');
    if (barrierGraphic) barrierGraphic.classList.remove('hidden');

    if (toggleBtn) {
      toggleBtn.innerHTML = `<i class="fa-solid fa-camera mr-1.5"></i><span>Start Camera</span>`;
      toggleBtn.className = "w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-xl transition flex items-center justify-center shadow-lg shadow-emerald-600/20";
    }
    if (captureBtn) captureBtn.classList.add('hidden');
    showToast("Camera stopped", "info");
  } else {
    // Start Camera
    try {
      showToast("Starting device camera...", "info");
      const constraints = {
        video: {
          facingMode: { ideal: "environment" }, // Prefer back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (video) {
        video.srcObject = webcamStream;
        await video.play();
      }

      if (container) container.classList.remove('hidden');
      if (barrierGraphic) barrierGraphic.classList.add('hidden');

      if (toggleBtn) {
        toggleBtn.innerHTML = `<i class="fa-solid fa-stop mr-1.5"></i><span>Stop Camera</span>`;
        toggleBtn.className = "w-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-2.5 rounded-xl transition flex items-center justify-center shadow-lg shadow-rose-600/20";
      }
      if (captureBtn) captureBtn.classList.remove('hidden');
      showToast("Live camera active! Align vehicle number plate inside frame and tap Scan.", "success");
    } catch (err) {
      console.error("Camera error:", err);
      showToast("Camera access error: " + err.message + ". Please grant camera permission.", "error");
    }
  }
}

// 📸 CAPTURE FRAME FROM CAMERA AND RUN DUAL OCR (Client + Server)
async function captureAndScanPlate() {
  const video = document.getElementById('liveWebcamVideo');
  const canvas = document.getElementById('liveWebcamCanvas');
  const captureBtn = document.getElementById('captureWebcamBtn');

  if (!video || !webcamStream) {
    showToast("Please start camera first", "warning");
    return;
  }

  if (captureBtn) {
    captureBtn.disabled = true;
    captureBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i><span>Scanning Plate...</span>`;
  }

  try {
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    
    // Draw raw image
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    let detectedPlate = "";

    // 1. Run Client-Side Tesseract.js OCR
    if (window.Tesseract) {
      try {
        showToast("Analyzing license plate characters...", "info");
        const ocrResult = await Tesseract.recognize(canvas, 'eng', {
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '
        });
        const clientText = ocrResult.data.text;
        console.log("[Client OCR Raw Output]:", clientText);
        detectedPlate = extractIndianPlateRegex(clientText);
      } catch (e) {
        console.warn("Client OCR fallback to server:", e);
      }
    }

    // 2. Transmit to Server API
    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      if (blob) formData.append('file', blob, 'capture.jpg');
      formData.append('lot_id', window.AppState.currentLotId || 1);
      formData.append('gate_type', 'entry');
      formData.append('vehicle_type', 'car');
      if (detectedPlate) {
        formData.append('plate_override', detectedPlate);
      }

      try {
        const res = await fetch('/api/anpr/scan-image', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Plate not detected. Please hold plate closer or enter manually.");
        }

        handleGateVisualUpdate({
          plate_number: data.plate_number,
          formatted_plate: data.plate_number,
          barrier_open: data.barrier_open,
          action: data.action,
          message: data.message
        });

        showToast(data.message, data.barrier_open ? "success" : "warning");
        loadGateLogs();
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        if (captureBtn) {
          captureBtn.disabled = false;
          captureBtn.innerHTML = `<i class="fa-solid fa-bolt mr-1.5"></i><span>Scan Plate Now</span>`;
        }
      }
    }, 'image/jpeg', 0.92);

  } catch (err) {
    showToast("Scan error: " + err.message, "error");
    if (captureBtn) {
      captureBtn.disabled = false;
      captureBtn.innerHTML = `<i class="fa-solid fa-bolt mr-1.5"></i><span>Scan Plate Now</span>`;
    }
  }
}

// 📁 PROCESS IMAGE UPLOAD WITH DUAL OCR
async function processImageANPR() {
  const fileInput = document.getElementById('anprImageUpload');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast("Please choose an image file containing a license plate", "warning");
    return;
  }

  const file = fileInput.files[0];
  showToast("Scanning vehicle image with Dual OCR...", "info");

  let clientDetected = null;

  // Run Client-Side OCR first
  if (window.Tesseract) {
    try {
      const ocrResult = await Tesseract.recognize(file, 'eng');
      clientDetected = extractIndianPlateRegex(ocrResult.data.text);
      console.log("[Client File OCR]:", ocrResult.data.text, "Extracted:", clientDetected);
    } catch (e) {
      console.warn("Client file OCR pass:", e);
    }
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('lot_id', window.AppState.currentLotId || 1);
  formData.append('gate_type', 'entry');
  formData.append('vehicle_type', 'car');
  if (clientDetected) {
    formData.append('plate_override', clientDetected);
  }

  try {
    const res = await fetch('/api/anpr/scan-image', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Could not recognize plate. Please ensure plate is clearly visible.");
    }

    handleGateVisualUpdate({
      plate_number: data.plate_number,
      formatted_plate: data.plate_number,
      barrier_open: data.barrier_open,
      action: data.action,
      message: data.message
    });

    showToast(data.message, data.barrier_open ? "success" : "warning");
    loadGateLogs();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ⌨️ DIRECT SIMULATION TRIGGER
async function triggerSimulatedGate(gateType) {
  const input = document.getElementById('manualPlateInput');
  const plate = input?.value.trim() || (gateType === 'entry' ? 'MH19CV9876' : 'MH19BJ1234');
  const lotId = window.AppState.currentLotId || 1;

  const payload = {
    lot_id: lotId,
    gate_type: gateType,
    plate_number: plate,
    vehicle_type: 'car'
  };

  try {
    const res = await fetch('/api/anpr/gate-trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Gate trigger failed");
    }

    handleGateVisualUpdate({
      plate_number: data.plate_number,
      formatted_plate: data.plate_number,
      barrier_open: data.barrier_open,
      action: data.action,
      message: data.message
    });

    showToast(data.message, data.barrier_open ? "success" : "warning");
    loadGateLogs();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// 🚧 BARRIER ARM ANIMATION & GATE STATUS UPDATE
function handleGateVisualUpdate(event) {
  const plateEl = document.getElementById('lastScannedPlate');
  const statusEl = document.getElementById('scanResultStatus');
  const barrierArm = document.getElementById('barrierArm');
  const badge = document.getElementById('gateStatusBadge');

  if (plateEl) plateEl.innerText = event.formatted_plate || event.plate_number;
  if (statusEl) statusEl.innerText = event.action;

  if (event.barrier_open) {
    if (barrierArm) barrierArm.classList.add('open');
    if (badge) {
      badge.className = 'bg-emerald-500/20 text-emerald-400 text-xs font-extrabold px-3.5 py-1 rounded-full border border-emerald-500/30 flex items-center space-x-1.5';
      badge.innerHTML = `<i class="fa-solid fa-lock-open"></i><span>BARRIER OPEN</span>`;
    }

    // Auto close barrier after 4.5 seconds
    setTimeout(() => {
      if (barrierArm) barrierArm.classList.remove('open');
      if (badge) {
        badge.className = 'bg-rose-500/20 text-rose-400 text-xs font-extrabold px-3.5 py-1 rounded-full border border-rose-500/30 flex items-center space-x-1.5';
        badge.innerHTML = `<i class="fa-solid fa-lock"></i><span>BARRIER CLOSED</span>`;
      }
    }, 4500);
  }
}

// LOAD GATE LOGS
async function loadGateLogs() {
  const container = document.getElementById('gateLogsContainer');
  if (!container) return;

  const lotId = window.AppState.currentLotId || 1;
  try {
    const res = await fetch(`/api/gate-logs?lot_id=${lotId}&limit=20`);
    const logs = await res.json();
    renderGateLogs(logs);
  } catch (err) {
    console.error("Failed to load gate logs:", err);
  }
}

function renderGateLogs(logs) {
  const container = document.getElementById('gateLogsContainer');
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-500 text-center py-8">No gate events logged yet.</div>`;
    return;
  }

  container.innerHTML = logs.map(lg => {
    const isEntry = lg.gate_type === 'entry';
    const gateBadge = isEntry
      ? `<span class="bg-emerald-500/20 text-emerald-400 text-[9px] font-extrabold px-2 py-0.5 rounded-md border border-emerald-500/30"><i class="fa-solid fa-arrow-right-to-bracket mr-1"></i>ENTRY</span>`
      : `<span class="bg-amber-500/20 text-amber-400 text-[9px] font-extrabold px-2 py-0.5 rounded-md border border-amber-500/30"><i class="fa-solid fa-arrow-right-from-bracket mr-1"></i>EXIT</span>`;

    const timeStr = new Date(lg.timestamp).toLocaleTimeString();

    return `
      <div class="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs space-x-2 shadow-inner">
        <div class="space-y-0.5">
          <div class="flex items-center space-x-2">
            <span class="font-extrabold mono-font text-white">${lg.plate_number}</span>
            ${gateBadge}
          </div>
          <p class="text-[11px] text-slate-400">${lg.message || lg.action_taken}</p>
        </div>
        <div class="text-right">
          <span class="text-[10px] text-slate-500 mono-font block">${timeStr}</span>
          ${lg.slot_assigned ? `<span class="text-[10px] font-extrabold text-blue-400 mono-font">${lg.slot_assigned}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}
