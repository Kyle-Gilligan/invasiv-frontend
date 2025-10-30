
const video = document.getElementById('video');
const snapButton = document.getElementById('snap');
const canvas = document.createElement('canvas');
const flash = document.getElementById('flash');
const cameraError = document.getElementById('camera-error');

let sheet, sheetBackdrop, sheetHeader, sheetGrabber, sheetCloseBtn, sheetTitleEl, sheetStatusEl, sheetBody;
let sheetState = 'closed';
let sheetLocked = false;
let dragging = false;
let dragStartY = 0;
let pointerDragging = false;
let pointerStartY = 0;

function showCameraError(msg) {
  if (!cameraError) return;
  cameraError.textContent = msg;
  cameraError.classList.remove('hidden');
}

function flashOnce() {
  if (!flash) return;
  flash.classList.add('active');
  setTimeout(() => flash.classList.remove('active'), 120);
}

function setShutterPosition() {
  const bottomNav = document.getElementById('bottomNav');
  const navHeight = bottomNav ? bottomNav.offsetHeight : 84;
  document.documentElement.style.setProperty('--bottom-nav-height', `${navHeight}px`);
}
window.addEventListener('resize', setShutterPosition);
window.addEventListener('orientationchange', setShutterPosition);

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
function onGrabEnd() {
  dragging = false;
}

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
function onPointerUp() {
  pointerDragging = false;
}

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

async function setupCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showCameraError('Camera API not supported.');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
    video.srcObject = stream;
    await new Promise((res) => {
      video.onloadedmetadata = () => { video.play().catch(()=>{}); res(); };
    });
  } catch (err) {
    console.error('Camera error:', err);
    showCameraError('Unable to access camera.');
  }
}

async function takePhoto() {
  if (!video.srcObject) return showCameraError('Camera not available.');

  flashOnce();

  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return showCameraError('Camera not ready yet.');

  canvas.width = vw;
  canvas.height = vh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, vw, vh);

  const imageBase64 = canvas.toDataURL('image/jpeg', 0.92);
  const now = new Date();
  const date = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

  let latitude = 41.8781, longitude = -87.6298;
  if (navigator.geolocation) {
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 6000, maximumAge: 0
        })
      );
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch {}
  }

  await sendImageToAPI(imageBase64, latitude, longitude, date);
}

async function sendImageToAPI(imageBase64, latitude, longitude, date) {
  try {
    const resp = await fetch('https://huge-hairs-enter.loca.lt/api/v1/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, latitude, longitude, date })
    });

    const data = resp.ok ? await resp.json() : null;
    renderSheet(data || {
      speciesName: 'Unknown Species',
      description: 'We could not process this image.',
      isInvasive: null,
      commonNames: [],
      date, latitude, longitude
    });

  } catch (err) {
    console.error('API error:', err);
    renderSheet({
      speciesName: 'Unknown Species',
      description: 'Server unavailable.',
      isInvasive: null,
      commonNames: [],
      date, latitude, longitude
    });
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

document.addEventListener('DOMContentLoaded', async () => {
  setShutterPosition();
  buildBottomSheet();
  await setupCamera();
  snapButton?.addEventListener('click', takePhoto);
});
