// Admin and System Analytics Module

async function loadAdminAnalytics() {
  const lotId = window.AppState.currentLotId || 1;

  try {
    const res = await fetch(`/api/analytics?lot_id=${lotId}`);
    const data = await res.json();
    renderAnalytics(data);
  } catch (err) {
    console.error("Failed to load analytics:", err);
  }
}

function renderAnalytics(data) {
  const revEl = document.getElementById('admRevenue');
  const activeEl = document.getElementById('admActiveVehicles');
  const carRateEl = document.getElementById('admCarRate');
  const bikeRateEl = document.getElementById('admBikeRate');
  const carAvailEl = document.getElementById('admCarAvail');
  const bikeAvailEl = document.getElementById('admBikeAvail');

  if (revEl) revEl.innerText = `₹${data.total_revenue.toFixed(2)}`;
  if (activeEl) activeEl.innerText = data.active_parkings;
  if (carRateEl) carRateEl.innerText = `${data.car_occupancy_rate}%`;
  if (bikeRateEl) bikeRateEl.innerText = `${data.bike_occupancy_rate}%`;

  if (carAvailEl) carAvailEl.innerText = `${data.available_car_slots} free car bays`;
  if (bikeAvailEl) bikeAvailEl.innerText = `${data.available_bike_slots} free bike bays`;
}
