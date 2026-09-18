// 2D Parking Floor Plan & Slot Visualizer Module
let currentFilter = 'all';
let allSlots = [];

async function loadCurrentSlots() {
  const grid = document.getElementById('slotsGrid');
  if (!grid) return;

  const lotId = window.AppState.currentLotId || 1;

  try {
    const res = await fetch(`/api/lots/${lotId}/slots`);
    allSlots = await res.json();
    renderSlots();
    updateSlotStats();
  } catch (err) {
    console.error("Failed to load slots:", err);
    grid.innerHTML = `<div class="col-span-full text-center text-xs text-rose-400 py-8">Failed to fetch slot occupancy.</div>`;
  }
}

function filterSlotType(type) {
  currentFilter = type;
  document.querySelectorAll('.slot-filter-btn').forEach(btn => {
    if (btn.dataset.filter === type) {
      btn.classList.add('active', 'text-blue-400', 'bg-blue-500/10');
      btn.classList.remove('text-slate-400');
    } else {
      btn.classList.remove('active', 'text-blue-400', 'bg-blue-500/10');
      btn.classList.add('text-slate-400');
    }
  });
  renderSlots();
}

function renderSlots() {
  const grid = document.getElementById('slotsGrid');
  if (!grid) return;

  const filtered = allSlots.filter(s => {
    if (currentFilter === 'all') return true;
    return s.vehicle_type === currentFilter;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center text-xs text-slate-500 py-8">No parking bays found for this filter.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(slot => {
    const isCar = slot.vehicle_type === 'car';
    const rate = isCar ? 50 : 30;
    const icon = isCar ? 'fa-car' : 'fa-motorcycle';

    let statusClass = 'bay-available';
    let statusBadge = '<span class="text-[9px] font-extrabold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">FREE</span>';
    let statusText = `₹${rate}/hr`;
    let clickHandler = `onclick="selectSlotToBook(${slot.id}, '${slot.slot_number}', '${slot.vehicle_type}')"`;
    let cursor = 'cursor-pointer';

    if (slot.status === 'booked') {
      statusClass = 'bay-booked';
      statusBadge = '<span class="text-[9px] font-extrabold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">RESERVED</span>';
      statusText = slot.current_plate ? `<span class="mono-font text-[10px] text-amber-300 font-bold">${slot.current_plate}</span>` : 'Reserved';
      clickHandler = `onclick="showToast('Bay ${slot.slot_number} is currently reserved', 'warning')"`;
    } else if (slot.status === 'occupied') {
      statusClass = 'bay-occupied';
      statusBadge = '<span class="text-[9px] font-extrabold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30">PARKED</span>';
      statusText = slot.current_plate ? `<span class="mono-font text-[10px] text-rose-300 font-bold">${slot.current_plate}</span>` : 'Occupied';
      clickHandler = `onclick="showToast('Bay ${slot.slot_number} is occupied by ${slot.current_plate || 'vehicle'}', 'warning')"`;
    }

    if (window.AppState.selectedSlotId === slot.id) {
      statusClass += ' bay-selected';
    }

    return `
      <div ${clickHandler} class="parking-bay-card ${statusClass} ${cursor} p-4 flex flex-col justify-between h-36 border shadow-lg">
        <!-- Bay number & Status badge -->
        <div class="flex items-center justify-between">
          <span class="text-base font-extrabold mono-font text-white">${slot.slot_number}</span>
          ${statusBadge}
        </div>

        <!-- Center Icon Graphic -->
        <div class="my-auto flex items-center justify-center">
          <div class="w-12 h-12 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-center text-slate-300 shadow-inner">
            <i class="fa-solid ${icon} text-lg"></i>
          </div>
        </div>

        <!-- Bottom row: Vehicle & Rate -->
        <div class="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800/80">
          <span class="text-slate-400 capitalize text-[10px] font-semibold">${slot.vehicle_type}</span>
          <span class="font-extrabold text-white">${statusText}</span>
        </div>
      </div>
    `;
  }).join('');
}

function updateSlotStats() {
  const avail = allSlots.filter(s => s.status === 'available').length;
  const booked = allSlots.filter(s => s.status === 'booked').length;
  const occ = allSlots.filter(s => s.status === 'occupied').length;
  const total = allSlots.length;

  const availEl = document.getElementById('statAvailableCount');
  const bookedEl = document.getElementById('statBookedCount');
  const occEl = document.getElementById('statOccupiedCount');
  const totalEl = document.getElementById('statTotalCount');

  if (availEl) availEl.innerText = avail;
  if (bookedEl) bookedEl.innerText = booked;
  if (occEl) occEl.innerText = occ;
  if (totalEl) totalEl.innerText = total;
}

function selectSlotToBook(slotId, slotNumber, vehicleType) {
  window.AppState.selectedSlotId = slotId;

  // Sync to pre-booking form
  const vRadios = document.querySelectorAll('input[name="vehicle_type"]');
  vRadios.forEach(r => {
    if (r.value === vehicleType) r.checked = true;
  });

  updateBookingEstimation();
  renderSlots();
  switchTab('bookingTab');
  showToast(`Selected Bay ${slotNumber}! Pre-booking details updated.`, 'success');
}
