// ANPR Scanner & Live Camera Plate Scanner Module
let webcamStream = null;

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
    container.innerHTML = `<div class="text-xs text-slate-500 text-center py-8">No gate logs recorded yet.</div>`;
    return;
  }

  container.innerHTML = logs.map(lg => {
    const isEntry = lg.gate_type === 'entry';
    const gateBadge = isEntry
      ? `<span class="bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/30"><i class="fa-solid fa-arrow-right-to-bracket mr-1"></i>ENTRY</span>`
      : `<span class="bg-amber-500/20 text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/30"><i class="fa-solid fa-arrow-right-from-bracket mr-1"></i>EXIT</span>`;

    const timeStr = new Date(lg.timestamp).toLocaleTimeString();

    return `
      <div class="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs space-x-2">
        <div class="space-y-0.5">
          <div class="flex items-center space-x-2">
            <span class="font-extrabold mono-font text-white">${lg.plate_number}</span>
            ${gateBadge}
          </div>
          <p class="text-[11px] text-slate-400">${lg.message || lg.action_taken}</p>
        </div>
        <div class="text-right">
          <span class="text-[10px] text-slate-500 mono-font block">${timeStr}</span>
          ${lg.slot_assigned ? `<span class="text-[10px] font-bold text-blue-400 mono-font">${lg.slot_assigned}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// 🎥 LIVE WEBCAM / MOBILE CAMERA SCANNER
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
      toggleBtn.innerHTML = `<i class="fa-solid fa-camera"></i><span>Start Camera</span>`;
      toggleBtn.className = "w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded-xl transition flex items-center justify-center space-x-1.5";
    }
    if (captureBtn) captureBtn.classList.add('hidden');
    showToast("Live camera scanner stopped", "info");
  } else {
    // Start Camera
    try {
      showToast("Accessing device camera...", "info");
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
        toggleBtn.innerHTML = `<i class="fa-solid fa-stop"></i><span>Stop Camera</span>`;
        toggleBtn.className = "w-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-2 rounded-xl transition flex items-center justify-center space-x-1.5";
      }
      if (captureBtn) captureBtn.classList.remove('hidden');
      showToast("Live camera active! Align vehicle number plate inside crosshairs and click Scan.", "success");
    } catch (err) {
      console.error("Webcam error:", err);
      showToast("Could not access camera: " + err.message + ". Please ensure camera permissions are allowed.", "error");
    }
  }
}

// 📸 CAPTURE FRAME FROM WEBCAM AND PROCESS VIA OCR
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
    captureBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Scanning Plate...</span>`;
  }

  try {
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert Canvas to Blob and send to ANPR backend
    canvas.toBlob(async (blob) => {
      if (!blob) {
        throw new Error("Failed to capture frame");
      }

      const formData = new FormData();
      formData.append('file', blob, 'camera_capture.jpg');
      formData.append('lot_id', window.AppState.currentLotId || 1);
      formData.append('gate_type', 'entry');
      formData.append('vehicle_type', 'car');

      try {
        const res = await fetch('/api/anpr/scan-image', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Plate not detected");
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
          captureBtn.innerHTML = `<i class="fa-solid fa-bolt"></i><span>Scan Plate Now</span>`;
        }
      }
    }, 'image/jpeg', 0.9);

  } catch (err) {
    showToast("Error capturing camera frame: " + err.message, "error");
    if (captureBtn) {
      captureBtn.disabled = false;
      captureBtn.innerHTML = `<i class="fa-solid fa-bolt"></i><span>Scan Plate Now</span>`;
    }
  }
}

// 📁 PROCESS IMAGE UPLOAD
async function processImageANPR() {
  const fileInput = document.getElementById('anprImageUpload');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast("Please select an image containing a license plate", "warning");
    return;
  }

  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append('file', file);
  formData.append('lot_id', window.AppState.currentLotId || 1);
  formData.append('gate_type', 'entry');
  formData.append('vehicle_type', 'car');

  try {
    showToast("Processing image via ANPR OCR...", "info");
    const res = await fetch('/api/anpr/scan-image', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Failed to scan plate");
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

// ⌨️ TRIGGER SIMULATED GATE
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

// 🚧 BARRIER ANIMATION & STATUS UPDATE
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
      badge.className = 'bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30 flex items-center space-x-1';
      badge.innerHTML = `<i class="fa-solid fa-lock-open"></i><span>BARRIER OPEN</span>`;
    }

    // Auto close barrier after 4.5 seconds
    setTimeout(() => {
      if (barrierArm) barrierArm.classList.remove('open');
      if (badge) {
        badge.className = 'bg-rose-500/20 text-rose-400 text-xs font-bold px-3 py-1 rounded-full border border-rose-500/30 flex items-center space-x-1';
        badge.innerHTML = `<i class="fa-solid fa-lock"></i><span>BARRIER CLOSED</span>`;
      }
    }, 4500);
  }
}
