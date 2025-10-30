let sheet, sheetBackdrop, sheetHeader, sheetGrabber, sheetCloseBtn, sheetTitleEl, sheetStatusEl, sheetBody;
let sheetState = 'closed';
let sheetLocked = false;
let dragging = false;
let dragStartY = 0;
let pointerDragging = false;
let pointerStartY = 0;

function buildBottomSheet() {
  sheetState = 'closed';
  sheetLocked = false;

  document.querySelectorAll('#sheetBackdrop, #speciesSheet').forEach(n => n.remove());

  sheetBackdrop = document.createElement('div');
  sheetBackdrop.id = 'sheetBackdrop';
  sheetBackdrop.className = 'sheet-backdrop';
  document.body.appendChild(sheetBackdrop);

  sheet = document.createElement('section');
  sheet.id = 'speciesSheet';
  sheet.className = 'bottom-sheet';
  sheet.setAttribute('aria-hidden', 'true');
  document.body.appendChild(sheet);

  sheetHeader = document.createElement('header');
  sheetHeader.className = 'sheet-header';
  sheet.appendChild(sheetHeader);

  sheetGrabber = document.createElement('div');
  sheetGrabber.className = 'sheet-grabber';
  sheetHeader.appendChild(sheetGrabber);

  sheetTitleEl = document.createElement('h3');
  sheetTitleEl.id = 'speciesTitle';
  sheetTitleEl.className = 'sheet-title';
  sheetTitleEl.textContent = '—';
  sheetHeader.appendChild(sheetTitleEl);

  sheetCloseBtn = document.createElement('button');
  sheetCloseBtn.className = 'sheet-close';
  sheetCloseBtn.setAttribute('aria-label', 'Close');
  sheetCloseBtn.innerHTML = '✕';
  sheetHeader.appendChild(sheetCloseBtn);

  sheetStatusEl = document.createElement('div');
  sheetStatusEl.className = 'status-pills';
  sheetHeader.appendChild(sheetStatusEl);

  sheetBody = document.createElement('div');
  sheetBody.id = 'speciesBody';
  sheetBody.className = 'sheet-body';
  sheet.appendChild(sheetBody);

  sheetBackdrop.onclick = closeSheet;
  sheetCloseBtn.onclick = closeSheet;

  sheetGrabber.addEventListener('touchstart', onGrabStart, { passive: true });
  sheetGrabber.addEventListener('touchmove', onGrabMove, { passive: true });
  sheetGrabber.addEventListener('touchend', onGrabEnd, { passive: true });

  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  sheetGrabber.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

function onGrabStart(e) {
  if (sheetLocked) return;
  dragging = true;
  dragStartY = e.touches[0].clientY;
}
function onGrabMove(e) {
  if (!dragging || sheetLocked) return;
  const dy = e.touches[0].clientY - dragStartY;
  handleDrag(dy);
}
function onGrabEnd() { dragging = false; }

function onPointerDown(e) {
  if (sheetLocked) return;
  pointerDragging = true;
  pointerStartY = e.clientY;
}
function onPointerMove(e) {
  if (!pointerDragging || sheetLocked) return;
  const dy = e.clientY - pointerStartY;
  handleDrag(dy);
}
function onPointerUp() { pointerDragging = false; }

function handleDrag(dy) {
  if (dy < -48 && sheetState === 'half') {
    openSheet('full');
    dragging = pointerDragging = false;
    return;
  }
  if (dy > 48) {
    if (sheetState === 'full') {
      openSheet('half');
    } else if (sheetState === 'half') {
      closeSheet();
    }
    dragging = pointerDragging = false;
  }
}

function openSheet(state) {
  if (sheetLocked) return;

  sheet.classList.remove('open', 'half', 'full');
  sheetBackdrop.classList.remove('open');

  void sheet.offsetWidth;

  sheet.classList.add('open', state);
  sheetBackdrop.classList.add('open');
  sheet.setAttribute('aria-hidden', 'false');
  sheetState = state;
}

function closeSheet() {
  sheet.classList.remove('open', 'half', 'full');
  sheetBackdrop.classList.remove('open');
  sheet.setAttribute('aria-hidden', 'true');
  sheetState = 'closed';
  sheetLocked = true;
}

function ensureSheetAvailable() {
  if (sheetLocked || !sheet || !sheetBody) {
    buildBottomSheet();
  }
}

function renderSheet(data) {
  ensureSheetAvailable();

  const {
    speciesName = 'Unknown Species',
    description = 'N/A',
    isInvasive = null,
    commonNames = [],
    date = '',
    latitude = '',
    longitude = ''
  } = data || {};

  sheetTitleEl.textContent = speciesName;

  let statusClass = 'unknown';
  let statusLabel = 'Unknown';
  if (isInvasive === true) { statusClass = 'invasive'; statusLabel = 'Invasive'; }
  else if (isInvasive === false) { statusClass = 'native'; statusLabel = 'Native'; }

  sheetStatusEl.innerHTML = `<span class="status-pill ${statusClass}">${statusLabel}</span>`;

  const commonHTML = Array.isArray(commonNames) && commonNames.length ? `
    <div class="section">
      <div class="section-title">COMMON NAMES</div>
      <div class="common-list">
        ${commonNames.map(n => `<div class="common-item">${n}</div>`).join('')}
      </div>
    </div>
  ` : '';

  sheetBody.innerHTML = `
    <div class="section">
      <div class="section-title">ABOUT</div>
      <p>${description}</p>
    </div>
    ${commonHTML}
    <div class="meta-line">
      ${date ? `${date} • ` : ''}${formatCoord(latitude)}, ${formatCoord(longitude)}
    </div>
  `;

  openSheet('half');
}

function formatCoord(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(4) : String(val || '');
}

async function initMap() {
  let lat = 41.8781, lng = -87.6298, zoom = 7;

  try {
    const user_location = await fetch("https://ipapi.co/json/").then(r => r.json());
    if (user_location?.latitude && user_location?.longitude) {
      lat = user_location.latitude;
      lng = user_location.longitude;
      zoom = 12;
    }
  } catch {}

  const map = L.map('map').setView([lat, lng], zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  try {
  const results = await fetch("https://huge-hairs-enter.loca.lt/api/v1/results", {
    headers: { 
      'Bypass-Tunnel-Reminder': 'true'
    }
  }).then(j => j.json());
  
  results.forEach(item => {
    const marker = L.marker([item.latitude, item.longitude]).addTo(map);
    marker.on('click', () => renderSheet(item));
  });
} catch (err) {
  console.error('Failed to load map data:', err);
}
}

document.addEventListener('DOMContentLoaded', () => {
  buildBottomSheet();
  initMap();
});

// JavaScript logic to expand the minimized drawer on tap
const bottomSheet = document.querySelector('.bottom-sheet');

if (bottomSheet) {
  const grabber = document.querySelector('.sheet-grabber'); // Renamed variable to avoid conflict

  if (grabber) {
    grabber.addEventListener('click', () => {
      bottomSheet.classList.toggle('open-full'); // Toggles the full expansion class
    });
  }
}
