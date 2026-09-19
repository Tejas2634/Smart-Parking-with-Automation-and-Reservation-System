// ANPR Scanner with Center ROI Cropping + Strict Indian Plate Matching (MH 19)
let webcamStream = null;

// Valid Indian State Codes
const INDIAN_STATE_CODES = [
  'MH', 'DL', 'KA', 'GJ', 'HR', 'MP', 'TS', 'AP', 'TN', 'KL', 'RJ', 'UP', 'WB', 'PB', 'CH', 'GA', 'UK', 'JH', 'OD', 'BR', 'AS'
];

// Strict Indian License Plate Regex Extractor
function extractIndianPlateRegex(rawText) {
  if (!rawText) return null;

  // Uppercase and clean special characters
  const upper = rawText.toUpperCase().replace(/[\r\n\t]/g, ' ');

  // 1. Strict Match: State Code (2 letters) + RTO (1-2 digits) + Series (1-3 letters) + Number (4 digits)
  // E.g. MH 19 BJ 1234, MH19BJ1234, DL 08 CA 9876, MH 12 AB 1234
  const strictRegex = /\b([A-Z]{2})\s*([0-9]{1,2})\s*([A-Z]{1,3})\s*([0-9]{4})\b/g;
  let match = strictRegex.exec(upper);
  if (match) {
    const state = match[1];
    if (INDIAN_STATE_CODES.includes(state)) {
      const rto = match[2].padStart(2, '0');
      const series = match[3];
      const num = match[4];
      return `${state}${rto}${series}${num}`;
    }
  }

  // 2. Compact Match without spaces
  const compactRegex = /([A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{3,4})/g;
  let compactMatches = upper.replace(/\s+/g, '').match(compactRegex);
  if (compactMatches && compactMatches.length > 0) {
    for (let candidate of compactMatches) {
      const state = candidate.slice(0, 2);
      if (INDIAN_STATE_CODES.includes(state) && candidate.length >= 8 && candidate.length <= 10) {
        return candidate;
      }
    }
  }

  // 3. Fallback: Search for MH 19 or any state code in the string
  for (let state of INDIAN_STATE_CODES) {
    const idx = upper.indexOf(state);
    if (idx !== -1) {
      const sub = upper.slice(idx).replace(/[^A-Z0-9]/g, '');
      if (sub.length >= 8 && sub.length <= 10) {
        return sub;
      }
    }
  }

  return null;
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
          facingMode: { ideal: "environment" }, // Prefer rear camera on mobile
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

// 📸 CAPTURE CENTER REGION OF INTEREST (ROI) & RUN OCR
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
    const vW = video.videoWidth || 1280;
    const vH = video.videoHeight || 720;

    // Crop ONLY the central 60% width and 35% height where the laser viewfinder box is
    const cropW = Math.round(vW * 0.65);
    const cropH = Math.round(vH * 0.35);
    const startX = Math.round((vW - cropW) / 2);
    const startY = Math.round((vH - cropH) / 2);

    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    
    // Draw cropped center box
    ctx.drawImage(video, startX, startY, cropW, cropH, 0, 0, cropW, cropH);

    // Apply High-Contrast Grayscale Preprocessing on Canvas
    const imgData = ctx.getImageData(0, 0, cropW, cropH);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const avg = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      // High contrast thresholding
      const val = avg > 120 ? Math.min(255, avg * 1.2) : Math.max(0, avg * 0.7);
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);

    let detectedPlate = "";

    // 1. Run Client-Side Tesseract OCR on Cropped ROI
    if (window.Tesseract) {
      try {
        showToast("Processing number plate characters...", "info");
        const ocrResult = await Tesseract.recognize(canvas, 'eng', {
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '
        });
        const clientText = ocrResult.data.text;
        console.log("[ROI OCR Raw Output]:", clientText);
        detectedPlate = extractIndianPlateRegex(clientText);
      } catch (e) {
        console.warn("Client OCR pass:", e);
      }
    }

    if (!detectedPlate) {
      // If OCR couldn't extract clean pattern, check manual override or prompt user
      const manualInput = document.getElementById('manualPlateInput')?.value.trim();
      if (manualInput) {
        detectedPlate = manualInput;
      }
    }

    if (!detectedPlate) {
      showToast("No clear number plate found in frame. Please align plate inside the box or enter plate below.", "warning");
      if (captureBtn) {
        captureBtn.disabled = false;
        captureBtn.innerHTML = `<i class="fa-solid fa-bolt mr-1.5"></i><span>Scan Plate Now</span>`;
      }
      return;
    }

    // Format for display (e.g. MH 19 BJ 1234)
    const formatted = formatPlateText(detectedPlate);
    showToast(`Detected Plate: ${formatted}`, "success");

    // Execute Gate Action
    await executeGateAction(detectedPlate, "entry", "car");

  } catch (err) {
    showToast("Scan error: " + err.message, "error");
  } finally {
    if (captureBtn) {
      captureBtn.disabled = false;
      captureBtn.innerHTML = `<i class="fa-solid fa-bolt mr-1.5"></i><span>Scan Plate Now</span>`;
    }
  }
}

// Format Plate: MH19BJ1234 -> MH 19 BJ 1234
function formatPlateText(plate) {
  if (!plate) return "";
  const clean = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length >= 9) {
    return `${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, -4)} ${clean.slice(-4)}`;
  }
  return clean;
}

// 📁 PROCESS IMAGE UPLOAD WITH ROI AND DUAL OCR
async function processImageANPR() {
  const fileInput = document.getElementById('anprImageUpload');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast("Please choose an image file containing a license plate", "warning");
    return;
  }

  const file = fileInput.files[0];
  showToast("Scanning vehicle image with ANPR OCR...", "info");

  let clientDetected = null;

  if (window.Tesseract) {
    try {
      const ocrResult = await Tesseract.recognize(file, 'eng');
      clientDetected = extractIndianPlateRegex(ocrResult.data.text);
      console.log("[Uploaded Image OCR Raw]:", ocrResult.data.text, "Cleaned:", clientDetected);
    } catch (e) {
      console.warn("Client file OCR pass:", e);
    }
  }

  if (!clientDetected) {
    const manualInput = document.getElementById('manualPlateInput')?.value.trim();
    if (manualInput) clientDetected = manualInput;
  }

  if (!clientDetected) {
    showToast("Could not recognize plate format (e.g. MH 19 XX 1234). Please use manual trigger below.", "warning");
    return;
  }

  await executeGateAction(clientDetected, "entry", "car");
}

// 🚀 EXECUTE GATE ACTION ON BACKEND
async function executeGateAction(plateNumber, gateType = "entry", vehicleType = "car") {
  const lotId = window.AppState.currentLotId || 1;

  const payload = {
    lot_id: lotId,
    gate_type: gateType,
    plate_number: plateNumber,
    vehicle_type: vehicleType
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
      formatted_plate: formatPlateText(data.plate_number),
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
  await executeGateAction(plate, gateType, "car");
}

// ⚡ 1-CLICK INTERACTIVE TEST PLATE SIMULATOR (Indian MH 19 Registration Numbers)
async function simulateTestPlateScan(plateNumber, vehicleType = 'car', gateType = 'entry') {
  if (typeof playAudioFx === 'function') playAudioFx('click');

  const plateInput = document.getElementById('manualPlateInput');
  if (plateInput) plateInput.value = plateNumber;

  const plateEl = document.getElementById('lastScannedPlate');
  if (plateEl) {
    plateEl.innerText = "SCANNING...";
    plateEl.classList.add('text-amber-300', 'animate-pulse');
  }

  // Visual simulation delay
  setTimeout(async () => {
    if (typeof playAudioFx === 'function') playAudioFx('scan_success');
    if (plateEl) plateEl.classList.remove('text-amber-300', 'animate-pulse');
    await executeGateAction(plateNumber, gateType, vehicleType);
  }, 400);
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
    if (typeof playAudioFx === 'function') playAudioFx('gate_open');
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
    const formattedPlate = formatPlateText(lg.plate_number);

    return `
      <div class="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs space-x-2 shadow-inner">
        <div class="space-y-0.5">
          <div class="flex items-center space-x-2">
            <span class="font-extrabold mono-font text-white">${formattedPlate}</span>
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
