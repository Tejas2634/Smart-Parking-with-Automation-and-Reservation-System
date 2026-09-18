// Global App State
window.AppState = {
  currentLotId: 1,
  userLocation: null,
  ws: null,
  currentTab: 'mapTab',
  selectedSlotId: null
};

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  initLiveClock();
  initWebSocket();
  initLotSelector();

  // Load initial tab
  switchTab('mapTab');
});

// Real-Time Clock
function initLiveClock() {
  const clockEl = document.getElementById('liveClock');
  setInterval(() => {
    const now = new Date();
    if (clockEl) {
      clockEl.innerText = now.toLocaleTimeString();
    }
  }, 1000);
}

// Tab Switcher
function switchTab(tabId) {
  window.AppState.currentTab = tabId;

  // Update desktop nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add('active', 'text-blue-400', 'bg-blue-500/10');
      btn.classList.remove('text-slate-400');
    } else {
      btn.classList.remove('active', 'text-blue-400', 'bg-blue-500/10');
      btn.classList.add('text-slate-400');
    }
  });

  // Update mobile bottom nav buttons
  document.querySelectorAll('.mob-nav-btn').forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add('text-blue-400');
      btn.classList.remove('text-slate-400');
    } else {
      btn.classList.remove('text-blue-400');
      btn.classList.add('text-slate-400');
    }
  });

  // Toggle Tab Sections
  document.querySelectorAll('.tab-content').forEach(sec => {
    if (sec.id === tabId) {
      sec.classList.remove('hidden');
      sec.classList.add('block');
    } else {
      sec.classList.add('hidden');
      sec.classList.remove('block');
    }
  });

  // Trigger tab-specific loaders
  if (tabId === 'mapTab') {
    if (window.map) {
      setTimeout(() => window.map.invalidateSize(), 200);
    }
    if (typeof reloadLotsMap === 'function') reloadLotsMap();
  } else if (tabId === 'slotsTab') {
    if (typeof loadCurrentSlots === 'function') loadCurrentSlots();
  } else if (tabId === 'anprTab') {
    if (typeof loadGateLogs === 'function') loadGateLogs();
  } else if (tabId === 'passesTab') {
    if (typeof lookupUserBookings === 'function') lookupUserBookings();
  } else if (tabId === 'adminTab') {
    if (typeof loadAdminAnalytics === 'function') loadAdminAnalytics();
  }
}

// Global Hub / Location Selector
function initLotSelector() {
  const select = document.getElementById('globalLotSelect');
  const bookingSelect = document.getElementById('bookingLotId');

  if (select) {
    select.addEventListener('change', (e) => {
      window.AppState.currentLotId = parseInt(e.target.value);
      if (bookingSelect) bookingSelect.value = e.target.value;

      showToast(`Switched Hub to Lot #${window.AppState.currentLotId}`, 'info');

      // Refresh current active view
      if (window.AppState.currentTab === 'slotsTab') loadCurrentSlots();
      if (window.AppState.currentTab === 'anprTab') loadGateLogs();
      if (window.AppState.currentTab === 'adminTab') loadAdminAnalytics();
    });
  }
}

// Toast Notification System
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const colorMap = {
    success: 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300 shadow-emerald-950/50',
    error: 'bg-rose-950/90 border-rose-500/50 text-rose-300 shadow-rose-950/50',
    info: 'bg-blue-950/90 border-blue-500/50 text-blue-300 shadow-blue-950/50',
    warning: 'bg-amber-950/90 border-amber-500/50 text-amber-300 shadow-amber-950/50'
  };
  const iconMap = {
    success: 'fa-solid fa-circle-check',
    error: 'fa-solid fa-triangle-exclamation',
    info: 'fa-solid fa-circle-info',
    warning: 'fa-solid fa-bell'
  };

  toast.className = `pointer-events-auto flex items-center space-x-3 px-4 py-3 rounded-2xl border text-xs font-semibold shadow-2xl backdrop-blur-md transition-all duration-300 transform translate-y-2 opacity-0 ${colorMap[type] || colorMap.info}`;
  toast.innerHTML = `
    <i class="${iconMap[type] || iconMap.info} text-sm"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  // Auto remove
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// WebSocket Connection for Real-time Hardware & Slot Sync
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/live`;

  try {
    const ws = new WebSocket(wsUrl);
    window.AppState.ws = ws;

    ws.onopen = () => {
      console.log("[WebSocket] Connected to live parking stream");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleLiveWebSocketEvent(data);
      } catch (err) {
        console.error("WS Parse Error", err);
      }
    };

    ws.onclose = () => {
      console.log("[WebSocket] Disconnected. Reconnecting in 3s...");
      setTimeout(initWebSocket, 3000);
    };
  } catch (err) {
    console.warn("WebSocket could not be established:", err);
  }
}

function handleLiveWebSocketEvent(data) {
  if (data.type === 'SLOT_UPDATED') {
    if (window.AppState.currentLotId === data.lot_id) {
      if (typeof loadCurrentSlots === 'function') loadCurrentSlots();
    }
  } else if (data.type === 'GATE_EVENT') {
    showToast(`Gate Event: ${data.event.formatted_plate} (${data.event.action})`, 'success');
    if (typeof handleGateVisualUpdate === 'function') {
      handleGateVisualUpdate(data.event);
    }
    if (window.AppState.currentTab === 'slotsTab') loadCurrentSlots();
    if (window.AppState.currentTab === 'adminTab') loadAdminAnalytics();
  }
}
