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
  initSoundToggle();

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

// =========================================================================
// 🔊 INTERACTIVE WEB AUDIO API SYNTHESIZER (No External Files Required)
// =========================================================================
let audioCtx = null;
let soundFxEnabled = localStorage.getItem('smartpark_sound_enabled') !== 'false';

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function initSoundToggle() {
  updateSoundToggleButton();
}

function toggleSoundFx() {
  soundFxEnabled = !soundFxEnabled;
  localStorage.setItem('smartpark_sound_enabled', soundFxEnabled);
  updateSoundToggleButton();
  if (soundFxEnabled) {
    playAudioFx('click');
    showToast('Sound Effects: Enabled 🔊', 'info');
  } else {
    showToast('Sound Effects: Muted 🔇', 'info');
  }
}

function updateSoundToggleButton() {
  const btn = document.getElementById('soundToggleBtn');
  if (btn) {
    btn.innerHTML = soundFxEnabled 
      ? '<i class="fa-solid fa-volume-high text-emerald-400"></i><span class="hidden sm:inline text-[11px] font-bold text-slate-300">Sound ON</span>'
      : '<i class="fa-solid fa-volume-xmark text-slate-500"></i><span class="hidden sm:inline text-[11px] font-bold text-slate-500">Muted</span>';
  }
}

function playAudioFx(type) {
  if (!soundFxEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'scan_success') {
      [880, 1320, 1760].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        gain.gain.setValueAtTime(0.12, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.1);
      });
    } else if (type === 'book_success') {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        gain.gain.setValueAtTime(0.15, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.35);
      });
    } else if (type === 'gate_open') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.22);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'error') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    }
  } catch (e) {
    console.warn("Audio FX error", e);
  }
}

// =========================================================================
// 🎉 INTERACTIVE CONFETTI CELEBRATION PHYSICS
// =========================================================================
function triggerConfetti() {
  const canvas = document.createElement('canvas');
  canvas.id = 'confettiCanvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#38bdf8', '#ffffff'];

  for (let i = 0; i < 90; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 250,
      y: canvas.height / 2 - 120,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 1.2) * 13 - 3,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      alpha: 1,
      gravity: 0.32
    });
  }

  let animationFrame;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.rotationSpeed;
      p.alpha -= 0.009;

      if (p.alpha > 0) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    });

    if (alive) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(animationFrame);
      canvas.remove();
    }
  }

  animate();
}
