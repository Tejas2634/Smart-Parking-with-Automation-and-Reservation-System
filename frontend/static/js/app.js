// Global App State
window.AppState = {
  currentLotId: 1,
  userLocation: null,
  ws: null,
  currentTab: 'mapTab',
  selectedSlotId: null,
  currentUserRole: 'user'
};

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  initLiveClock();
  initWebSocket();
  initLotSelector();
  initUserRole();

  // Load initial tab based on role
  const savedRole = sessionStorage.getItem('smartpark_role') || 'user';
  if (savedRole === 'admin') {
    switchTab('anprTab');
  } else {
    switchTab('mapTab');
  }
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

// Role Initialization & Management
function initUserRole() {
  const savedRole = sessionStorage.getItem('smartpark_role') || 'user';
  applyUserRole(savedRole);
}

function applyUserRole(role) {
  window.AppState.currentUserRole = role;
  sessionStorage.setItem('smartpark_role', role);

  const roleBadge = document.getElementById('roleBadge');
  const roleSubtext = document.getElementById('roleSubtext');
  const brandLogoEmblem = document.getElementById('brandLogoEmblem');
  const brandLogoIcon = document.getElementById('brandLogoIcon');
  
  const userNavDesktop = document.getElementById('userNavDesktop');
  const adminNavDesktop = document.getElementById('adminNavDesktop');
  const userNavMobile = document.getElementById('userNavMobile');
  const adminNavMobile = document.getElementById('adminNavMobile');
  const userHeroBanner = document.getElementById('userHeroBanner');
  const adminHeroBanner = document.getElementById('adminHeroBanner');
  
  const userQuickBookBtn = document.getElementById('userQuickBookBtn');
  const openAdminLoginBtn = document.getElementById('openAdminLoginBtn');
  const adminLogoutBtn = document.getElementById('adminLogoutBtn');

  if (role === 'admin') {
    if (roleBadge) {
      roleBadge.textContent = 'Admin Portal';
      roleBadge.className = 'text-[10px] uppercase font-bold tracking-widest bg-purple-500/20 text-purple-400 px-2.5 py-0.5 rounded-full border border-purple-500/30';
    }
    if (roleSubtext) {
      roleSubtext.textContent = 'Operator & Gate Barrier Control Console';
    }
    if (brandLogoEmblem) {
      brandLogoEmblem.className = 'w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25 ring-1 ring-white/20 transition-all';
    }
    if (brandLogoIcon) {
      brandLogoIcon.className = 'fa-solid fa-shield-halved text-2xl text-white';
    }

    if (userNavDesktop) {
      userNavDesktop.classList.remove('lg:flex');
      userNavDesktop.classList.add('hidden');
    }
    if (adminNavDesktop) {
      adminNavDesktop.classList.remove('hidden');
      adminNavDesktop.classList.add('lg:flex', 'flex');
    }
    if (userNavMobile) {
      userNavMobile.classList.add('hidden');
      userNavMobile.classList.remove('flex');
    }
    if (adminNavMobile) {
      adminNavMobile.classList.remove('hidden');
      adminNavMobile.classList.add('flex');
    }

    if (userHeroBanner) userHeroBanner.classList.add('hidden');
    if (adminHeroBanner) {
      adminHeroBanner.classList.remove('hidden');
      adminHeroBanner.classList.add('flex');
    }

    if (userQuickBookBtn) userQuickBookBtn.classList.add('hidden');
    if (openAdminLoginBtn) openAdminLoginBtn.classList.add('hidden');
    if (adminLogoutBtn) {
      adminLogoutBtn.classList.remove('hidden');
      adminLogoutBtn.classList.add('flex');
    }
  } else {
    if (roleBadge) {
      roleBadge.textContent = 'User Portal';
      roleBadge.className = 'text-[10px] uppercase font-bold tracking-widest bg-blue-500/20 text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-500/30';
    }
    if (roleSubtext) {
      roleSubtext.textContent = 'Jalgaon Smart Parking & Location Tracer';
    }
    if (brandLogoEmblem) {
      brandLogoEmblem.className = 'w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-blue-500/25 ring-1 ring-white/20 transition-all';
    }
    if (brandLogoIcon) {
      brandLogoIcon.className = 'fa-solid fa-square-parking text-2xl text-white';
    }

    if (userNavDesktop) {
      userNavDesktop.classList.remove('hidden');
      userNavDesktop.classList.add('lg:flex');
    }
    if (adminNavDesktop) {
      adminNavDesktop.classList.add('hidden');
      adminNavDesktop.classList.remove('lg:flex', 'flex');
    }
    if (userNavMobile) {
      userNavMobile.classList.remove('hidden');
      userNavMobile.classList.add('flex');
    }
    if (adminNavMobile) {
      adminNavMobile.classList.add('hidden');
      adminNavMobile.classList.remove('flex');
    }

    if (userHeroBanner) {
      userHeroBanner.classList.remove('hidden');
      userHeroBanner.classList.add('flex');
    }
    if (adminHeroBanner) {
      adminHeroBanner.classList.add('hidden');
      adminHeroBanner.classList.remove('flex');
    }

    if (userQuickBookBtn) {
      userQuickBookBtn.classList.remove('hidden');
      userQuickBookBtn.classList.add('sm:flex');
    }
    if (openAdminLoginBtn) {
      openAdminLoginBtn.classList.remove('hidden');
      openAdminLoginBtn.classList.add('flex');
    }
    if (adminLogoutBtn) {
      adminLogoutBtn.classList.add('hidden');
      adminLogoutBtn.classList.remove('flex');
    }
  }
}

// Modal Handlers for Operator PIN
function openAdminLoginModal() {
  const modal = document.getElementById('adminLoginModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    const input = document.getElementById('adminPasscode');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 150);
    }
  }
}

function closeAdminLoginModal() {
  const modal = document.getElementById('adminLoginModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function handleAdminLogin(event) {
  if (event) event.preventDefault();
  const input = document.getElementById('adminPasscode');
  const code = (input ? input.value : '').trim();

  if (code === '1234' || code === 'admin' || code === 'admin123') {
    closeAdminLoginModal();
    applyUserRole('admin');
    switchTab('anprTab');
    showToast('Authenticated as Operator / Administrator', 'success');
  } else {
    showToast('Invalid Operator PIN. (Default: 1234)', 'error');
  }
}

function logoutAdmin() {
  applyUserRole('user');
  switchTab('mapTab');
  showToast('Logged out of Admin Portal. Switched to Driver View.', 'info');
}

// Tab Switcher
function switchTab(tabId) {
  window.AppState.currentTab = tabId;

  // Update desktop nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const isTarget = btn.dataset.tab === tabId;
    const isAdminNav = btn.closest('#adminNavDesktop');
    const activeColor = isAdminNav ? 'text-purple-400' : 'text-blue-400';
    const activeBg = isAdminNav ? 'bg-purple-500/10' : 'bg-blue-500/10';

    if (isTarget) {
      btn.classList.add('active', activeColor, activeBg);
      btn.classList.remove('text-slate-400');
    } else {
      btn.classList.remove('active', 'text-purple-400', 'text-blue-400', 'bg-purple-500/10', 'bg-blue-500/10');
      btn.classList.add('text-slate-400');
    }
  });

  // Update mobile bottom nav buttons
  document.querySelectorAll('.mob-nav-btn').forEach(btn => {
    const isTarget = btn.dataset.tab === tabId;
    const isAdminMob = btn.closest('#adminNavMobile');
    const activeColor = isAdminMob ? 'text-purple-400' : 'text-blue-400';

    if (isTarget) {
      btn.classList.add('active', activeColor);
      btn.classList.remove('text-slate-400');
    } else {
      btn.classList.remove('active', 'text-purple-400', 'text-blue-400');
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
