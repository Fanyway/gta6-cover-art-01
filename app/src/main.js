// Wires the page: photos into panels, layout / grade / size pickers, live
// caption editing, drag-to-pan and zoom per panel, PNG export.
// A `?shot=` query sets up a fixed scene for a screenshot instead (shots.js).
import { drawCover, panelRects, LAYOUTS, GRADES } from './cover.js';
import { runShot } from './shots.js';

// Any error while the app runs is surfaced on the document, so a headless
// check can see it without a console listener.
window.addEventListener('error', (e) => {
  document.documentElement.dataset.error = String(e.message || e.error || 'error');
});
window.addEventListener('unhandledrejection', (e) => {
  document.documentElement.dataset.error = String((e.reason && e.reason.message) || e.reason || 'rejection');
});

const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Wide 1920 x 1080' },
};

const canvas = document.getElementById('cover');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const statusEl = document.getElementById('status');
const trayEl = document.getElementById('tray');
const zoomRange = document.getElementById('zoom');
const zoomVal = document.getElementById('zoomVal');

const state = {
  layout: 'trio',
  grade: 'sunset',
  size: '1080x1080',
  title: 'Sunset Heist',
  subtitle: 'VICE CITY • 2026',
  selectedPanel: 0,
  selectedPhoto: 0,
  photos: [], // { name, img }
  panels: [
    { photo: null, zoom: 1.15, ox: 0, oy: 0 },
    { photo: null, zoom: 1.15, ox: 0, oy: 0 },
    { photo: null, zoom: 1.15, ox: 0, oy: 0 },
  ],
};

function panelImage(i) {
  const slot = state.panels[i];
  if (slot == null || slot.photo == null) return null;
  const entry = state.photos[slot.photo];
  return entry ? entry.img : null;
}

function coverState() {
  return {
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    selectedPanel: state.selectedPanel,
    panels: state.panels.map((p, i) => ({ ...p, img: panelImage(i) })),
  };
}

function applySize() {
  const size = SIZES[state.size];
  canvas.width = size.w;
  canvas.height = size.h;
}

export function redraw() {
  applySize();
  drawCover(canvas, coverState(), { forExport: false });
  syncControls();
}

function syncControls() {
  document.querySelectorAll('#layoutBtns button').forEach((b) => {
    b.classList.toggle('on', b.dataset.layout === state.layout);
    b.setAttribute('aria-pressed', String(b.dataset.layout === state.layout));
  });
  document.querySelectorAll('#gradeBtns button').forEach((b) => {
    b.classList.toggle('on', b.dataset.grade === state.grade);
    b.setAttribute('aria-pressed', String(b.dataset.grade === state.grade));
  });
  document.querySelectorAll('#sizeBtns button').forEach((b) => {
    b.classList.toggle('on', b.dataset.size === state.size);
    b.setAttribute('aria-pressed', String(b.dataset.size === state.size));
  });
  const panel = state.panels[state.selectedPanel];
  zoomRange.value = String(panel.zoom);
  zoomVal.textContent = `${panel.zoom.toFixed(2)}x`;
  document.getElementById('panelName').textContent = `Panel ${state.selectedPanel + 1}`;
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cannot load ${url}`));
    img.src = url;
  });
}

function addPhoto(name, img) {
  state.photos.push({ name, img });
  renderTray();
  return state.photos.length - 1;
}

function renderTray() {
  trayEl.innerHTML = '';
  state.photos.forEach((entry, i) => {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'thumb' + (i === state.selectedPhoto ? ' on' : '');
    thumb.title = entry.name;
    const img = document.createElement('img');
    img.src = entry.img.src;
    img.alt = entry.name;
    thumb.appendChild(img);
    thumb.addEventListener('click', () => {
      state.selectedPhoto = i;
      state.panels[state.selectedPanel].photo = i;
      renderTray();
      redraw();
    });
    trayEl.appendChild(thumb);
  });
}

async function loadSamples() {
  const pier = await loadImage('samples/pier.jpg');
  const pierIdx = addPhoto('pier.jpg', pier);
  const blvd = await loadImage('samples/boulevard.jpg');
  const blvdIdx = addPhoto('boulevard.jpg', blvd);
  // Hero gets the pier, the side panels get the boulevard and the pier
  // again with a different crop, so the cover works out of the box.
  state.panels[0].photo = pierIdx;
  state.panels[1].photo = blvdIdx;
  state.panels[2].photo = pierIdx;
  state.panels[2].ox = 0.18;
  state.panels[2].oy = -0.08;
}

document.getElementById('photo').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  for (const file of files) {
    try {
      const img = await loadImage(URL.createObjectURL(file));
      const idx = addPhoto(file.name, img);
      state.selectedPhoto = idx;
      state.panels[state.selectedPanel].photo = idx;
    } catch {
      statusEl.textContent = `Could not read ${file.name}.`;
    }
  }
  e.target.value = '';
  renderTray();
  redraw();
});

titleInput.addEventListener('input', () => {
  state.title = titleInput.value;
  redraw();
});
subtitleInput.addEventListener('input', () => {
  state.subtitle = subtitleInput.value;
  redraw();
});

document.getElementById('layoutBtns').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-layout]');
  if (!btn || !LAYOUTS[btn.dataset.layout]) return;
  state.layout = btn.dataset.layout;
  redraw();
});
document.getElementById('gradeBtns').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-grade]');
  if (!btn || !GRADES[btn.dataset.grade]) return;
  state.grade = btn.dataset.grade;
  redraw();
});
document.getElementById('sizeBtns').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-size]');
  if (!btn || !SIZES[btn.dataset.size]) return;
  state.size = btn.dataset.size;
  redraw();
});

zoomRange.addEventListener('input', () => {
  state.panels[state.selectedPanel].zoom = Number(zoomRange.value);
  redraw();
});
document.getElementById('centerBtn').addEventListener('click', () => {
  const panel = state.panels[state.selectedPanel];
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
  redraw();
});
document.getElementById('fillAllBtn').addEventListener('click', () => {
  const idx = state.selectedPhoto;
  state.panels.forEach((panel, i) => {
    panel.photo = idx;
    panel.ox = i === 2 ? 0.18 : i === 1 ? -0.12 : 0;
    panel.oy = i === 2 ? -0.08 : 0;
  });
  redraw();
});

// Pointer: click a panel to select it, drag to pan its photo, wheel to zoom.
function panelAt(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  const x = ((clientX - box.left) / box.width) * canvas.width;
  const y = ((clientY - box.top) / box.height) * canvas.height;
  const gutter = Math.max(4, Math.round(Math.min(canvas.width, canvas.height) * 0.012));
  const rects = panelRects(state.layout, canvas.width, canvas.height, gutter);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  state.selectedPanel = i;
  const box = canvas.getBoundingClientRect();
  drag = { x: e.clientX, y: e.clientY, w: box.width, h: box.height };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const panel = state.panels[state.selectedPanel];
  const box = canvas.getBoundingClientRect();
  const rects = panelRects(state.layout, canvas.width, canvas.height, Math.max(4, Math.round(Math.min(canvas.width, canvas.height) * 0.012)));
  const r = rects[state.selectedPanel];
  panel.ox += ((e.clientX - drag.x) / box.width) * (canvas.width / r.w);
  panel.oy += ((e.clientY - drag.y) / box.height) * (canvas.height / r.h);
  drag = { x: e.clientX, y: e.clientY, w: box.width, h: box.height };
  redraw();
});
canvas.addEventListener('pointerup', () => {
  drag = null;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[state.selectedPanel];
  panel.zoom = Math.max(1, Math.min(3, panel.zoom - Math.sign(e.deltaY) * 0.1));
  redraw();
}, { passive: false });

/** Renders the export-size cover offscreen and resolves its PNG blob. */
export function exportCover() {
  const size = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off, coverState(), { forExport: true });
  return new Promise((resolve, reject) => {
    off.toBlob((blob) => {
      if (blob) resolve({ blob, w: size.w, h: size.h });
      else reject(new Error('export failed'));
    }, 'image/png');
  });
}

document.getElementById('export').addEventListener('click', async () => {
  try {
    const { blob, w, h } = await exportCover();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    statusEl.textContent = `Saved vice-cover-${w}x${h}.png (${Math.round(blob.size / 1024)} KB).`;
  } catch {
    statusEl.textContent = 'Export failed — try another photo.';
  }
});

// Public handle for the shot scenes (shots.js) and for headless checks.
window.__vice = {
  state,
  loadImage,
  loadSamples,
  redraw,
  exportCover,
  setTitle: (t) => { state.title = t; titleInput.value = t; },
  setSubtitle: (s) => { state.subtitle = s; subtitleInput.value = s; },
  setLayout: (l) => { if (LAYOUTS[l]) state.layout = l; },
  setGrade: (g) => { if (GRADES[g]) state.grade = g; },
  setSize: (s) => { if (SIZES[s]) state.size = s; },
  loadSample: async (name) => {
    const img = await loadImage(`samples/${name}.jpg`);
    return addPhoto(`${name}.jpg`, img);
  },
};

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), window.__vice);
} else {
  loadSamples().then(redraw).catch((err) => {
    document.documentElement.dataset.error = String(err.message || err);
    redraw();
  });
}
