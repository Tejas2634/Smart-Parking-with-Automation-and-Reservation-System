// Pre-Booking and Digital Pass Module with Human Interactive UX

document.addEventListener('DOMContentLoaded', () => {
  initBookingDefaults();
  initPlateAutoFormatter();
  updateBookingEstimation();
});

function initBookingDefaults() {
  const timeInput = document.getElementById('bookingStartTime');
  if (timeInput) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    timeInput.value = now.toISOString().slice(0, 16);
  }
}

// Auto-formats input into MH 19 AB 1234
function initPlateAutoFormatter() {
  const plateInput = document.getElementById('bookingPlate');
  if (!plateInput) return;

  plateInput.addEventListener('input', (e) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (val.length > 10) val = val.slice(0, 10);
    e.target.value = val;
  });
}

// Quick Duration Pills (1h, 2h, 4h, 8h)
function setQuickDuration(hours) {
  const slider = document.getElementById('bookingDuration');
  if (slider) {
    slider.value = hours;
    updateBookingEstimation();
    showToast(`Set duration to ${hours} Hour${hours > 1 ? 's' : ''}`, 'info');
  }
}

function updateBookingEstimation() {
  const vType = document.querySelector('input[name="vehicle_type"]:checked')?.value || 'car';
  const duration = parseFloat(document.getElementById('bookingDuration')?.value || 2);

  const rate = vType === 'car' ? 50 : 30; // ₹50 car, ₹30 bike
  const total = (rate * duration).toFixed(2);

  const durationDisplay = document.getElementById('durationDisplay');
  const calcRateText = document.getElementById('calcRateText');
  const calcDurationText = document.getElementById('calcDurationText');
  const calcTotalAmount = document.getElementById('calcTotalAmount');

  if (durationDisplay) durationDisplay.innerText = `${duration} Hour${duration > 1 ? 's' : ''}`;
  if (calcRateText) calcRateText.innerText = `₹${rate} / hr (${vType.toUpperCase()})`;
  if (calcDurationText) calcDurationText.innerText = `${duration} Hour${duration > 1 ? 's' : ''}`;
  if (calcTotalAmount) calcTotalAmount.innerText = `₹${total}`;
}

async function handlePreBooking(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('submitBookingBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i><span>Confirming & Generating QR Ticket...</span>`;
  }

  const lotId = parseInt(document.getElementById('bookingLotId').value);
  const vehicleType = document.querySelector('input[name="vehicle_type"]:checked').value;
  const vehicleNumber = document.getElementById('bookingPlate').value.trim();
  const userName = document.getElementById('bookingName').value.trim();
  const userPhone = document.getElementById('bookingPhone').value.trim();
  const userEmail = document.getElementById('bookingEmail').value.trim() || null;
  const startTime = new Date(document.getElementById('bookingStartTime').value).toISOString();
  const durationHours = parseFloat(document.getElementById('bookingDuration').value);
  const slotId = window.AppState.selectedSlotId || null;

  const payload = {
    lot_id: lotId,
    vehicle_type: vehicleType,
    vehicle_number: vehicleNumber,
    user_name: userName,
    user_phone: userPhone,
    user_email: userEmail,
    start_time: startTime,
    duration_hours: durationHours,
    slot_id: slotId
  };

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to complete booking');
    }

    showToast(`Slot Reserved Successfully! Pass: ${data.booking_code}`, 'success');
    openQRModal(data);
    window.AppState.selectedSlotId = null;
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-ticket mr-2"></i><span>Confirm Reservation & Generate QR Ticket</span>`;
    }
  }
}

// Digital QR Pass Modal Controls
function openQRModal(booking) {
  const modal = document.getElementById('qrModal');
  const img = document.getElementById('modalQrImg');
  const code = document.getElementById('modalPassCode');
  const slot = document.getElementById('modalAssignedSlot');
  const plate = document.getElementById('modalPlate');
  const amount = document.getElementById('modalAmount');

  if (img) img.src = `/api/bookings/${booking.booking_code}/qr`;
  if (code) code.innerText = booking.booking_code;
  if (slot) slot.innerText = booking.slot_number || 'Bay Auto-Assigned';
  if (plate) plate.innerText = booking.vehicle_number;
  if (amount) amount.innerText = `₹${booking.total_amount.toFixed(2)}`;

  if (modal) modal.classList.remove('hidden');
}

function closeQRModal() {
  const modal = document.getElementById('qrModal');
  if (modal) modal.classList.add('hidden');
}

function printPass() {
  window.print();
}

// Lookup Passes for "My Passes" Tab
async function lookupUserBookings() {
  const input = document.getElementById('passLookupInput');
  const container = document.getElementById('passesListContainer');
  if (!container) return;

  const query = input?.value.trim() || '';
  let url = '/api/bookings/my';
  if (query) {
    if (/^[0-9+]+$/.test(query)) {
      url += `?phone=${encodeURIComponent(query)}`;
    } else {
      url += `?plate=${encodeURIComponent(query)}`;
    }
  }

  try {
    const res = await fetch(url);
    const bookings = await res.json();

    if (bookings.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12 human-glass rounded-3xl border border-slate-800 space-y-3">
          <div class="w-14 h-14 rounded-2xl bg-slate-800/80 mx-auto flex items-center justify-center text-slate-500 text-2xl">
            <i class="fa-solid fa-ticket"></i>
          </div>
          <h4 class="text-sm font-bold text-white">No active bookings found</h4>
          <p class="text-xs text-slate-400">Pre-book your guaranteed parking slot in Jalgaon in 30 seconds!</p>
          <button onclick="switchTab('bookingTab')" class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold px-5 py-2.5 rounded-2xl shadow-lg shadow-blue-500/20 transition">Reserve a Bay</button>
        </div>
      `;
      return;
    }

    container.innerHTML = bookings.map(b => {
      const statusColor = b.booking_status === 'confirmed' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                          b.booking_status === 'checked_in' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                          'text-slate-400 bg-slate-800 border-slate-700';

      return `
        <div class="ticket-pass-card p-5 shadow-2xl space-y-3 relative overflow-hidden">
          <div class="flex justify-between items-start">
            <div>
              <span class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Pass Code</span>
              <h4 class="text-lg font-extrabold mono-font text-blue-400">${b.booking_code}</h4>
            </div>
            <span class="text-[10px] font-extrabold px-2.5 py-1 rounded-full border uppercase ${statusColor}">
              ${b.booking_status}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-3 py-2.5 border-y border-slate-800/80 text-xs">
            <div>
              <span class="text-slate-400 block text-[10px]">Vehicle</span>
              <span class="font-extrabold text-white mono-font">${b.vehicle_number}</span>
              <span class="text-[10px] text-slate-400 capitalize block">${b.vehicle_type} (₹${b.hourly_rate}/h)</span>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px]">Assigned Bay</span>
              <span class="font-extrabold text-emerald-400 mono-font text-sm">${b.slot_number || 'Bay Auto'}</span>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px]">Booked Duration</span>
              <span class="font-medium text-white">${b.duration_hours} Hours</span>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px]">Total Paid</span>
              <span class="font-extrabold text-emerald-400 mono-font">₹${b.total_amount.toFixed(2)}</span>
            </div>
          </div>

          <div class="flex items-center space-x-2 pt-1">
            <button onclick="openQRModal(${JSON.stringify(b).replace(/"/g, '&quot;')})" class="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2.5 rounded-2xl border border-slate-700 transition flex items-center justify-center space-x-1.5">
              <i class="fa-solid fa-qrcode"></i>
              <span>View QR Pass</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error("Failed to load user bookings:", err);
  }
}
