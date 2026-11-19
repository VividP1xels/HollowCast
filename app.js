'use strict';
/* HOLLOWCAST: analog horror tape editor. Runs entirely in the browser. */

const W = 640, H = 480;
const $ = s => document.querySelector(s);
const STORE_KEY = 'hollowcast.project.v1';

// ---------- parameter schema (drives the UI, presets and saving) ----------
const PARAMS = [
  // Framing
  { id: 'fit', group: 'Framing', label: 'Framing', type: 'select', def: 'cover', options: [['cover', 'Fill (crop)'], ['contain', 'Fit (letterbox)']] },
  { id: 'zoom', group: 'Framing', label: 'Slow creep zoom', type: 'range', min: 0, max: 100, def: 0 },
  { id: 'cardText', group: 'Framing', label: 'Test card text', type: 'text', def: 'PLEASE STAND BY' },

  // Signal
  { id: 'noise', group: 'Signal', label: 'Static', type: 'range', min: 0, max: 100, def: 22 },
  { id: 'scan', group: 'Signal', label: 'Scanlines', type: 'range', min: 0, max: 100, def: 35 },
  { id: 'chroma', group: 'Signal', label: 'Chroma shift', type: 'range', min: 0, max: 15, def: 3 },
  { id: 'bleed', group: 'Signal', label: 'Color bleed', type: 'range', min: 0, max: 4, step: 0.1, def: 0.8 },
  { id: 'ring', group: 'Signal', label: 'Edge ringing', type: 'range', min: 0, max: 100, def: 25 },
  { id: 'ghost', group: 'Signal', label: 'Ghosting', type: 'range', min: 0, max: 90, def: 0 },
  { id: 'wobble', group: 'Signal', label: 'Line wobble', type: 'range', min: 0, max: 20, def: 2 },
  { id: 'jitter', group: 'Signal', label: 'Frame jitter', type: 'range', min: 0, max: 10, def: 1 },
  { id: 'tracking', group: 'Signal', label: 'Tracking error', type: 'range', min: 0, max: 100, def: 25 },
  { id: 'headswitch', group: 'Signal', label: 'Head-switch', type: 'range', min: 0, max: 100, def: 60 },
  { id: 'dropouts', group: 'Signal', label: 'Dropouts', type: 'range', min: 0, max: 100, def: 15 },
  { id: 'roll', group: 'Signal', label: 'Vertical roll', type: 'range', min: 0, max: 100, def: 0 },
  { id: 'glitch', group: 'Signal', label: 'Random glitches', type: 'range', min: 0, max: 100, def: 10 },

  // VFX
  { id: 'mirror', group: 'VFX', label: 'Mirror', type: 'select', def: 'none', options: [['none', 'None'], ['h', 'Left ↔ right'], ['v', 'Top ↕ bottom'], ['quad', 'Four-way']] },
  { id: 'pixelate', group: 'VFX', label: 'Pixelate', type: 'range', min: 0, max: 24, def: 0 },
  { id: 'feedback', group: 'VFX', label: 'Video feedback', type: 'range', min: 0, max: 95, def: 0 },
  { id: 'fbZoom', group: 'VFX', label: 'Feedback zoom', type: 'range', min: -20, max: 20, def: 6 },
  { id: 'fbSpin', group: 'VFX', label: 'Feedback spin', type: 'range', min: -10, max: 10, def: 0 },
  { id: 'datamosh', group: 'VFX', label: 'Datamosh', type: 'range', min: 0, max: 100, def: 0 },
  { id: 'invert', group: 'VFX', label: 'Invert flashes', type: 'range', min: 0, max: 100, def: 0 },

  // Color
  { id: 'sat', group: 'Color', label: 'Saturation', type: 'range', min: 0, max: 200, def: 65 },
  { id: 'contrast', group: 'Color', label: 'Contrast', type: 'range', min: 50, max: 200, def: 115 },
  { id: 'bright', group: 'Color', label: 'Brightness', type: 'range', min: 30, max: 200, def: 95 },
  { id: 'tint', group: 'Color', label: 'Tint', type: 'select', def: 'none', options: [['none', 'None'], ['green', 'Sick green'], ['amber', 'Amber'], ['blue', 'Cold blue'], ['red', 'Blood red'], ['mono', 'Monochrome'], ['thermal', 'Thermal camera']] },
  { id: 'tintAmt', group: 'Color', label: 'Tint amount', type: 'range', min: 0, max: 100, def: 50 },
  { id: 'crush', group: 'Color', label: 'Bit crush', type: 'range', min: 0, max: 6, def: 0 },
  { id: 'vignette', group: 'Color', label: 'Vignette', type: 'range', min: 0, max: 100, def: 55 },

  // Overlays
  { id: 'osd', group: 'Overlays', label: 'Deck display', type: 'select', def: 'PLAY', options: [['none', 'None'], ['PLAY', 'PLAY ▶'], ['REC', 'REC ●'], ['PAUSE', 'PAUSE ❚❚'], ['STOP', 'STOP ■']] },
  { id: 'osdBlink', group: 'Overlays', label: 'Blink display', type: 'check', def: true },
  { id: 'camText', group: 'Overlays', label: 'Corner label', type: 'text', def: '' },
  { id: 'dateText', group: 'Overlays', label: 'Date stamp', type: 'text', def: 'OCT. 31 1987' },
  { id: 'timecode', group: 'Overlays', label: 'Running clock', type: 'check', def: true },
  { id: 'tcStart', group: 'Overlays', label: 'Clock starts at', type: 'text', def: '03:14:00' },
  { id: 'crawlOn', group: 'Overlays', label: 'Text crawl', type: 'check', def: false },
  { id: 'crawlText', group: 'Overlays', label: 'Crawl text', type: 'textarea', def: 'THIS IS NOT A TEST. REMAIN INDOORS. DO NOT LOOK AT THE SKY. DO NOT ANSWER THE DOOR FOR ANYONE, INCLUDING FAMILY.' },
  { id: 'crawlSpeed', group: 'Overlays', label: 'Crawl speed', type: 'range', min: 1, max: 10, def: 4 },
  { id: 'titleOn', group: 'Overlays', label: 'Title card', type: 'check', def: false },
  { id: 'titleText', group: 'Overlays', label: 'Title text', type: 'textarea', def: 'THE FOLLOWING FOOTAGE\nWAS RECOVERED\nIN 1994' },
  { id: 'titleBg', group: 'Overlays', label: 'Title background', type: 'select', def: 'black', options: [['none', 'Over footage'], ['black', 'Black'], ['blue', 'Broadcast blue']] },
  { id: 'titleType', group: 'Overlays', label: 'Typewriter title', type: 'check', def: false },
  { id: 'subText', group: 'Overlays', label: 'Subliminal text', type: 'text', def: 'IT SEES YOU' },
  { id: 'subRate', group: 'Overlays', label: 'Subliminal rate', type: 'range', min: 0, max: 100, def: 0 },

  // Audio
  { id: 'vol', group: 'Audio', label: 'Source volume', type: 'range', min: 0, max: 100, def: 80 },
  { id: 'staticVol', group: 'Audio', label: 'Tape hiss', type: 'range', min: 0, max: 100, def: 15 },
  { id: 'humVol', group: 'Audio', label: 'Mains hum', type: 'range', min: 0, max: 100, def: 10 },
  { id: 'drone', group: 'Audio', label: 'Low drone', type: 'range', min: 0, max: 100, def: 0 },
  { id: 'tone', group: 'Audio', label: '1 kHz test tone', type: 'check', def: false },
  { id: 'toneVol', group: 'Audio', label: 'Tone volume', type: 'range', min: 0, max: 100, def: 20 },
  { id: 'flutter', group: 'Audio', label: 'Wow & flutter', type: 'range', min: 0, max: 100, def: 20 },
];

const DEFAULTS = Object.fromEntries(PARAMS.map(p => [p.id, p.def]));
const TEXT_IDS = new Set(PARAMS.filter(p => p.type === 'text' || p.type === 'textarea').map(p => p.id));
const AUDIO_IDS = new Set(['vol', 'staticVol', 'humVol', 'drone', 'tone', 'toneVol']);

const ZERO_LOOK = {
  noise: 0, scan: 0, chroma: 0, bleed: 0, ring: 0, ghost: 0, wobble: 0, jitter: 0, tracking: 0, headswitch: 0,
  dropouts: 0, roll: 0, glitch: 0, mirror: 'none', pixelate: 0, feedback: 0, datamosh: 0, invert: 0, sat: 100, contrast: 100, bright: 100, tint: 'none', crush: 0, vignette: 0,
  staticVol: 0, humVol: 0, drone: 0, tone: false, flutter: 0,
};

// Presets reset the look and sound, and keep the scene's text unless they name it.
const PRESETS = {
  'Found tape': {},
  'Rotted tape': {
    noise: 55, scan: 45, chroma: 7, bleed: 1.6, ring: 50, ghost: 30, wobble: 8, jitter: 4, tracking: 80,
    headswitch: 90, dropouts: 60, glitch: 45, sat: 40, contrast: 125, bright: 85, tint: 'green', tintAmt: 30,
    vignette: 75, staticVol: 35, humVol: 15, flutter: 70, drone: 20,
  },
  'Emergency broadcast': {
    noise: 10, scan: 30, chroma: 2, bleed: 0.5, ring: 30, wobble: 1, jitter: 0, tracking: 5, headswitch: 15,
    dropouts: 4, glitch: 4, sat: 95, contrast: 125, bright: 92, tint: 'none', vignette: 30,
    osd: 'none', timecode: false, crawlOn: true, titleOn: true, titleBg: 'blue',
    staticVol: 8, humVol: 6, tone: true, toneVol: 15, flutter: 5,
  },
  'Surveillance': {
    noise: 30, scan: 50, chroma: 1, bleed: 0.4, ring: 10, wobble: 0.5, jitter: 0, tracking: 0, headswitch: 30,
    dropouts: 8, glitch: 6, sat: 0, contrast: 140, bright: 100, tint: 'mono', tintAmt: 100, crush: 2,
    vignette: 45, osd: 'REC', osdBlink: true, timecode: true, camText: 'CAM 03',
    staticVol: 10, humVol: 20, flutter: 0, drone: 0,
  },
  'Night shift': {
    noise: 40, scan: 40, chroma: 3, bleed: 1.2, ring: 35, ghost: 45, wobble: 3, jitter: 1, tracking: 30,
    headswitch: 60, dropouts: 20, glitch: 15, sat: 30, contrast: 150, bright: 65, tint: 'blue', tintAmt: 55,
    vignette: 90, zoom: 40, subRate: 15, staticVol: 20, humVol: 8, drone: 45, flutter: 30,
  },
  'Clean': { ...ZERO_LOOK, osd: 'none', timecode: false, dateText: '' },
};

function lookOf(name) {
  const o = {};
  for (const p of PARAMS) if (!TEXT_IDS.has(p.id)) o[p.id] = p.def;
  return Object.assign(o, PRESETS[name] || {});
}
const makeParams = (preset, over = {}) => ({ ...DEFAULTS, ...lookOf(preset), ...over });

// ---------- project model ----------
let uidN = 0;
const uid = () => 's' + Date.now().toString(36) + (uidN++).toString(36);

function makeScene(o = {}) {
  return {
    id: uid(), name: 'Scene', src: 'testcard', inPt: 0, outPt: null, dur: 5,
    trans: 'cut', fadeOut: false, script: '', scriptOn: true, ...o,
    params: { ...DEFAULTS, ...(o.params || {}) },
  };
}

function demoScenes() {
  return [
    makeScene({
      name: 'Cold open', src: 'black', dur: 7, trans: 'fade',
      params: makeParams('Found tape', {
        titleOn: true, titleType: true, titleBg: 'black', osd: 'none',
        titleText: 'THE FOLLOWING FOOTAGE\nWAS RECOVERED FROM\nA HOUSE IN MARROW COUNTY',
      }),
    }),
    makeScene({
      name: 'Bars', src: 'testcard', dur: 4, trans: 'static',
      params: makeParams('Found tape', { tone: true, osd: 'none', timecode: false, dateText: '' }),
    }),
    makeScene({
      name: 'Hallway', src: 'black', dur: 13, trans: 'glitch',
      script: SCRIPT_EXAMPLES['The figure approaches'],
      params: makeParams('Night shift', { osd: 'REC', camText: 'CAM 02', subRate: 6, zoom: 0 }),
    }),
    makeScene({
      name: 'Alert', src: 'black', dur: 12, trans: 'roll', fadeOut: true,
      params: makeParams('Emergency broadcast', { titleText: 'EMERGENCY ALERT\nSYSTEM', subRate: 12 }),
    }),
  ];
}

const project = { scenes: [], loop: false };
let sel = 0;
let P = null; // params of the active scene

function serialize() {
  return {
    app: 'hollowcast', v: 1, loop: project.loop, sel,
    scenes: project.scenes.map(({ thumb, ...s }) => s),
  };
}

function loadProject(data) {
  const scenes = Array.isArray(data && data.scenes) ? data.scenes : [];
  project.scenes = scenes.map(s => makeScene({ ...s, id: s.id || uid() }));
  if (!project.scenes.length) project.scenes = demoScenes();
  project.loop = !!(data && data.loop);
  sel = Math.min(Math.max(0, (data && data.sel) | 0), project.scenes.length - 1);
}

let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(serialize())); } catch (e) { /* storage unavailable */ }
  }, 400);
}

// ---------- undo ----------
const undoStack = [], redoStack = [];
let lastSnap = null;

function snapshot() { return JSON.stringify(serialize()); }
function checkpoint() {
  if (lastSnap) {
    undoStack.push(lastSnap);
    if (undoStack.length > 60) undoStack.shift();
    redoStack.length = 0;
  }
  lastSnap = snapshot();
  save();
}
function restore(json) {
  const wasPlaying = prog.playing;
  pause();
  loadProject(JSON.parse(json));
  lastSnap = json;
  enterScene(sel, 0, true);
  renderAll();
  if (wasPlaying) play();
  save();
}
function undo() {
  if (!undoStack.length) return flashStatus('Nothing to undo');
  redoStack.push(snapshot());
  restore(undoStack.pop());
}
function redo() {
  if (!redoStack.length) return flashStatus('Nothing to redo');
  undoStack.push(snapshot());
  restore(redoStack.pop());
}

// ---------- canvases ----------
const view = $('#view');
const vctx = view.getContext('2d');
const buf = document.createElement('canvas');
buf.width = W; buf.height = H;
const bctx = buf.getContext('2d', { willReadFrequently: true });
const testcard = document.createElement('canvas');
testcard.width = W; testcard.height = H;
const thumbCanvas = document.createElement('canvas');
thumbCanvas.width = 128; thumbCanvas.height = 96;

const outImg = vctx.createImageData(W, H);
for (let i = 3; i < outImg.data.length; i += 4) outImg.data[i] = 255;

const NOISE_N = 1 << 18, NMASK = NOISE_N - 1;
const noiseTab = new Float32Array(NOISE_N);
for (let i = 0; i < NOISE_N; i++) noiseTab[i] = Math.random() * 2 - 1;

const vigMap = new Float32Array(W * H);
let vigFor = -1;
function buildVignette() {
  if (vigFor === P.vignette) return;
  vigFor = P.vignette;
  const k = P.vignette / 100;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
      const d = Math.min(1, (dx * dx + dy * dy) / 2);
      vigMap[y * W + x] = 1 - k * Math.pow(d, 1.4) * 1.6;
    }
  }
}

let cardFor = null;
function buildTestcard(force) {
  const t = (P.cardText || '').trim();
  if (!force && cardFor === t) return;
  cardFor = t;
  const c = testcard.getContext('2d');
  const bw = W / 7, top = H * 0.67;
  ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0']
    .forEach((col, i) => { c.fillStyle = col; c.fillRect(Math.floor(i * bw), 0, Math.ceil(bw), top); });
  ['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0']
    .forEach((col, i) => { c.fillStyle = col; c.fillRect(Math.floor(i * bw), top, Math.ceil(bw), H * 0.08); });
  const y2 = top + H * 0.08, h2 = H - y2;
  c.fillStyle = '#131313'; c.fillRect(0, y2, W, h2);
  c.fillStyle = '#00214c'; c.fillRect(0, y2, bw * 1.25, h2);
  c.fillStyle = '#ffffff'; c.fillRect(bw * 1.25, y2, bw * 1.25, h2);
  c.fillStyle = '#32006a'; c.fillRect(bw * 2.5, y2, bw * 1.25, h2);
  c.fillStyle = '#090909'; c.fillRect(bw * 5, y2, bw / 3, h2);
  c.fillStyle = '#1d1d1d'; c.fillRect(bw * 5 + bw * 2 / 3, y2, bw / 3, h2);
  if (t) {
    c.font = '44px VT323, monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(t).width + 48;
    c.fillStyle = '#000'; c.fillRect((W - w) / 2, H * 0.33 - 32, w, 64);
    c.fillStyle = '#fff'; c.fillText(t, W / 2, H * 0.33 + 2);
  }
}

// ---------- media bin ----------
const media = new Map(); // file name -> { name, kind, url, el, node }

function addModel(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      media.set(file.name, { name: file.name, kind: 'model', mesh: HC3D.parseOBJ(fr.result) });
      flashStatus(`Model ready: use model('${file.name}') in a script`);
      renderBin();
    } catch (e) {
      flashStatus('Could not read model: ' + e.message);
    }
  };
  fr.readAsText(file);
}

function addMedia(file) {
  const name = file.name;
  const old = media.get(name);
  if (old && old.url) { if (old.kind === 'video') old.el.pause(); URL.revokeObjectURL(old.url); }
  const url = URL.createObjectURL(file);
  let m;
  if (file.type.startsWith('image/')) {
    const el = new Image();
    el.onload = () => renderTimeline();
    el.src = url;
    m = { name, kind: 'image', url, el };
  } else {
    const el = document.createElement('video');
    el.playsInline = true;
    el.preload = 'auto';
    el.src = url;
    el.addEventListener('loadedmetadata', () => { renderTimeline(); syncInspector(); });
    m = { name, kind: 'video', url, el };
  }
  media.set(name, m);
  connectMedia(m);
  return m;
}

function addFiles(fileList) {
  const files = [...fileList].filter(f => /^(video|image)\//.test(f.type));
  const json = [...fileList].find(f => f.name.endsWith('.json'));
  if (json) { openProjectFile(json); return; }
  [...fileList].filter(f => /\.obj$/i.test(f.name)).forEach(addModel);
  if (!files.length) return;
  let added = 0;
  for (const f of files) {
    const key = 'm:' + f.name;
    const linked = project.scenes.some(s => s.src === key);
    addMedia(f);
    if (!linked) {
      // Replace an untouched starter scene, otherwise append.
      const s = makeScene({
        name: f.name.replace(/\.[^.]+$/, '').slice(0, 24), src: key,
        dur: f.type.startsWith('image/') ? 6 : 5, trans: 'static',
        params: { ...P },
      });
      s.params.titleOn = false;
      project.scenes.splice(sel + 1, 0, s);
      sel++;
      added++;
    }
  }
  checkpoint();
  enterScene(sel, 0, true);
  renderAll();
  flashStatus(added ? `Added ${added} scene${added > 1 ? 's' : ''}` : 'Relinked media');
}

function resolve(s) {
  if (s.src.startsWith('m:')) {
    const m = media.get(s.src.slice(2));
    return m && m.kind !== 'model' ? m : { kind: 'offline', name: s.src.slice(2) };
  }
  return { kind: s.src };
}

function sceneDur(s) {
  const r = resolve(s);
  if (r.kind === 'video') {
    const d = r.el.duration;
    if (!isFinite(d)) return Math.max(0.5, s.dur);
    const out = s.outPt != null ? Math.min(s.outPt, d) : d;
    return Math.max(0.1, out - Math.min(s.inPt, d - 0.1));
  }
  return Math.max(0.5, +s.dur || 5);
}
const totalDur = () => project.scenes.reduce((a, s) => a + sceneDur(s), 0);
function sceneStart(i) {
  let t = 0;
  for (let k = 0; k < i; k++) t += sceneDur(project.scenes[k]);
  return t;
}

// ---------- webcam ----------
const camVideo = document.createElement('video');
camVideo.playsInline = true;
camVideo.muted = true;
let camStream = null, camStarting = false;

async function startCam() {
  if (camStream || camStarting) return;
  camStarting = true;
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
    camVideo.srcObject = camStream;
    await camVideo.play();
  } catch (e) {
    flashStatus('Webcam unavailable: ' + e.message);
  }
  camStarting = false;
}
function stopCam() {
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
}

// ---------- game / screen capture ----------
const screenVideo = document.createElement('video');
screenVideo.playsInline = true;
screenVideo.muted = true;
let screenStream = null, screenAudioNode = null;

function pickDesktopSource() {
  // In the desktop app, show our own window picker. Browsers show their own.
  if (!window.hollowcast || !window.hollowcast.listSources) return Promise.resolve(true);
  return window.hollowcast.listSources().then(list => new Promise(resolve => {
    const dlg = $('#picker'), grid = $('#pickerGrid');
    grid.innerHTML = '';
    list.forEach(src => {
      const b = document.createElement('button');
      b.className = 'src';
      const im = new Image();
      im.src = src.thumb;
      const cap = document.createElement('span');
      cap.textContent = src.name;
      b.append(im, cap);
      b.addEventListener('click', async () => { await window.hollowcast.chooseSource(src.id); dlg.close(); resolve(true); });
      grid.append(b);
    });
    $('#pickerCancel').onclick = () => { dlg.close(); resolve(false); };
    dlg.showModal();
  }));
}

async function startScreen() {
  if (screenStream) return true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    flashStatus('Screen capture is not supported here');
    return false;
  }
  try {
    if (!(await pickDesktopSource())) return false;
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
    screenVideo.srcObject = screenStream;
    await screenVideo.play();
    initAudio();
    if (ac && screenStream.getAudioTracks().length) {
      // Game audio goes to the recording only, so it never loops back into the capture.
      screenAudioNode = ac.createMediaStreamSource(screenStream);
      screenAudioNode.connect(recGain);
    }
    screenStream.getVideoTracks()[0].addEventListener('ended', stopScreen);
    flashStatus('Capture connected');
    return true;
  } catch (e) {
    flashStatus('Capture cancelled');
    return false;
  }
}

function stopScreen() {
  if (screenAudioNode) { screenAudioNode.disconnect(); screenAudioNode = null; }
  if (screenStream) { screenStream.getTracks().forEach(t => t.stop()); screenStream = null; }
}

// ---------- audio ----------
let ac = null, recDest, recGain, videoGain, noiseGain, humGain, toneGain, droneGain, burstGain;

function connectMedia(m) {
  if (ac && m.kind === 'video' && !m.node) {
    m.node = ac.createMediaElementSource(m.el);
    m.node.connect(videoGain);
  }
}

function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  const master = ac.createGain();
  master.connect(ac.destination);
  recDest = ac.createMediaStreamDestination();
  master.connect(recDest);
  recGain = ac.createGain();
  recGain.connect(recDest);

  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 6500;
  lp.connect(master);
  videoGain = ac.createGain();
  videoGain.connect(lp);

  const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const ns = ac.createBufferSource();
  ns.buffer = nb; ns.loop = true;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 3500; bp.Q.value = 0.4;
  noiseGain = ac.createGain();
  ns.connect(bp).connect(noiseGain).connect(master);
  burstGain = ac.createGain(); burstGain.gain.value = 0;
  ns.connect(burstGain).connect(master);
  ns.start();

  const hum = ac.createOscillator();
  hum.type = 'sawtooth'; hum.frequency.value = 60;
  const hl = ac.createBiquadFilter();
  hl.type = 'lowpass'; hl.frequency.value = 260;
  humGain = ac.createGain();
  hum.connect(hl).connect(humGain).connect(master);
  hum.start();

  droneGain = ac.createGain();
  const dl = ac.createBiquadFilter();
  dl.type = 'lowpass'; dl.frequency.value = 180;
  dl.connect(droneGain).connect(master);
  [41.2, 41.7, 61.8].forEach(f => {
    const o = ac.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = f;
    o.connect(dl); o.start();
  });

  const tone = ac.createOscillator();
  tone.frequency.value = 1000;
  toneGain = ac.createGain(); toneGain.gain.value = 0;
  tone.connect(toneGain).connect(master);
  tone.start();

  media.forEach(connectMedia);
  applyAudio();
}

function applyAudio() {
  if (!ac) return;
  const t = ac.currentTime, sq = v => (v / 100) ** 2;
  videoGain.gain.setTargetAtTime(P.vol / 100, t, 0.05);
  recGain.gain.setTargetAtTime(P.vol / 100, t, 0.05);
  noiseGain.gain.setTargetAtTime(sq(P.staticVol) * 0.5, t, 0.05);
  humGain.gain.setTargetAtTime(sq(P.humVol) * 0.25, t, 0.05);
  droneGain.gain.setTargetAtTime(sq(P.drone) * 0.35, t, 0.1);
  toneGain.gain.setTargetAtTime(P.tone ? sq(P.toneVol) * 0.3 : 0, t, 0.02);
}

function audioBurst(level, secs) {
  if (!ac) return;
  const t = ac.currentTime;
  burstGain.gain.cancelScheduledValues(t);
  burstGain.gain.setValueAtTime(level, t);
  burstGain.gain.exponentialRampToValueAtTime(0.0001, t + secs);
}

window.addEventListener('pointerdown', initAudio, { once: true });
window.addEventListener('keydown', initAudio, { once: true });

// ---------- glitch and subliminal state ----------
let glitchFrames = 0, glitchSwap = false, subFrames = 0;
const glitchRows = new Float32Array(H);
let trackPos = -100, rollPos = 0;

function triggerGlitch(big) {
  glitchFrames = (big ? 14 : 6) + (Math.random() * 16 | 0);
  glitchSwap = Math.random() < 0.3;
  glitchRows.fill(0);
  const blocks = (big ? 5 : 2) + (Math.random() * 6 | 0);
  for (let b = 0; b < blocks; b++) {
    const start = Math.random() * H | 0, len = 4 + Math.random() * 70 | 0;
    const off = (Math.random() - 0.5) * 320;
    for (let y = start; y < Math.min(H, start + len); y++) glitchRows[y] = off;
  }
  audioBurst(0.35, glitchFrames / 30);
}

// ---------- playback engine ----------
const prog = { playing: false, idx: 0, t: 0 };
let curVideo = null;
let exporting = false;
const cur = () => project.scenes[prog.idx];

function enterScene(i, t = 0, force) {
  i = Math.min(Math.max(0, i), project.scenes.length - 1);
  const s = project.scenes[i], r = resolve(s);
  const changed = force || prog.idx !== i || P !== s.params;
  prog.idx = i;
  prog.t = Math.max(0, t);

  const v = r.kind === 'video' ? r.el : null;
  if (curVideo && curVideo !== v) curVideo.pause();
  curVideo = v;
  if (v) {
    v.loop = false;
    try { v.currentTime = Math.max(0, s.inPt + prog.t); } catch (e) { /* not ready yet */ }
    if (prog.playing) v.play().catch(() => {}); else v.pause();
  }
  if (r.kind === 'webcam') startCam(); else stopCam();

  if (prog.t < 0.05) resetSceneState(s);
  if (changed) {
    P = s.params;
    sel = i;
    buildVignette();
    buildTestcard();
    applyAudio();
    syncControls();
    syncInspector();
    syncScriptPanel();
    renderTimeline();
  }
}

function onSceneEnter(s) {
  resetSceneState(s);
  if (s.trans === 'glitch') triggerGlitch(true);
  if (s.trans === 'static') audioBurst(0.5, 0.6);
}

function play() {
  initAudio();
  if (!project.scenes.length) return;
  const last = project.scenes.length - 1;
  if (prog.idx === last && prog.t >= sceneDur(cur()) - 0.05) enterScene(0, 0);
  prog.playing = true;
  if (curVideo) curVideo.play().catch(() => {});
  if (prog.t < 0.05) onSceneEnter(cur());
}

function pause() {
  prog.playing = false;
  if (curVideo) curVideo.pause();
}

const togglePlay = () => (prog.playing ? pause() : play());

function seekProgram(T) {
  const sc = project.scenes;
  let acc = 0;
  for (let i = 0; i < sc.length; i++) {
    const d = sceneDur(sc[i]);
    if (T < acc + d || i === sc.length - 1) { enterScene(i, Math.min(T - acc, d)); return; }
    acc += d;
  }
}

function advance(dt) {
  if (!prog.playing) return;
  const s = cur();
  const d = sceneDur(s);
  if (curVideo) prog.t = Math.max(0, curVideo.currentTime - s.inPt);
  else prog.t += dt;
  if (prog.t >= d || (curVideo && curVideo.ended)) {
    if (prog.idx + 1 < project.scenes.length) { enterScene(prog.idx + 1, 0); onSceneEnter(cur()); }
    else if (exporting) finishExport();
    else if (project.loop) { enterScene(0, 0); onSceneEnter(cur()); }
    else { pause(); prog.t = d; }
  }
}

// ---------- drawing ----------
const FONT = 'VT323, monospace';

function txt(c, s, x, y, color = '#f2f2f2') {
  c.fillStyle = 'rgba(0,0,0,0.65)';
  c.fillText(s, x + 2, y + 2);
  c.fillStyle = color;
  c.fillText(s, x, y);
}

function parseClock(s) {
  const m = String(s || '').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+(m[3] || 0)) : 0;
}

function fmtClock(sec) {
  sec = Math.floor(sec) % 86400;
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  const ampm = h < 12 ? 'AM' : 'PM', h12 = h % 12 || 12;
  return `${ampm} ${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fitDraw(el, sw, sh, a) {
  if (!sw || !sh) return;
  let s = P.fit === 'contain' ? Math.min(W / sw, H / sh) : Math.max(W / sw, H / sh);
  s *= 1 + (P.zoom / 100) * 0.35 * Math.min(1, a / 30);
  const dw = sw * s, dh = sh * s;
  bctx.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function drawSource(r, a) {
  bctx.save();
  bctx.filter = 'none';
  bctx.fillStyle = '#000';
  bctx.fillRect(0, 0, W, H);
  bctx.filter = `blur(${P.bleed}px) saturate(${P.sat}%) contrast(${P.contrast}%) brightness(${P.bright}%)`;
  if (r.kind === 'testcard') fitDraw(testcard, W, H, a);
  else if (r.kind === 'webcam' && camVideo.readyState >= 2) fitDraw(camVideo, camVideo.videoWidth, camVideo.videoHeight, a);
  else if (r.kind === 'video' && r.el.readyState >= 2) fitDraw(r.el, r.el.videoWidth, r.el.videoHeight, a);
  else if (r.kind === 'image' && r.el.complete && r.el.naturalWidth) fitDraw(r.el, r.el.naturalWidth, r.el.naturalHeight, a);
  else if (r.kind === 'screen' && screenVideo.readyState >= 2) fitDraw(screenVideo, screenVideo.videoWidth, screenVideo.videoHeight, a);
  bctx.restore();
  applySourceVfx();
}

const pixCanvas = document.createElement('canvas');
function applySourceVfx() {
  const c = bctx;
  c.save();
  c.filter = 'none';
  if (P.feedback > 0) {
    // Feed the last finished frame back in, slightly zoomed and turned.
    const z = P.fbZoom;
    c.globalAlpha = P.feedback / 100;
    c.translate(W / 2, H / 2);
    c.rotate(P.fbSpin * 0.004);
    c.globalCompositeOperation = 'lighten';
    c.drawImage(view, -W / 2 - z, -H / 2 - z * 0.75, W + z * 2, H + z * 1.5);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }
  if (P.mirror === 'h' || P.mirror === 'quad') {
    c.setTransform(-1, 0, 0, 1, W, 0);
    c.drawImage(buf, 0, 0, W / 2, H, 0, 0, W / 2, H);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
  if (P.mirror === 'v' || P.mirror === 'quad') {
    c.setTransform(1, 0, 0, -1, 0, H);
    c.drawImage(buf, 0, 0, W, H / 2, 0, 0, W, H / 2);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
  if (P.pixelate >= 2) {
    const k = P.pixelate | 0;
    pixCanvas.width = Math.max(1, W / k | 0);
    pixCanvas.height = Math.max(1, H / k | 0);
    pixCanvas.getContext('2d').drawImage(buf, 0, 0, pixCanvas.width, pixCanvas.height);
    c.imageSmoothingEnabled = false;
    c.drawImage(pixCanvas, 0, 0, W, H);
    c.imageSmoothingEnabled = true;
  }
  c.restore();
}

// Overlays are burned in before the tape damage, like a camcorder date stamp.
function drawOverlays(r, t, a) {
  const c = bctx;
  c.save();
  c.filter = 'none';
  c.textBaseline = 'top';
  c.textAlign = 'left';

  if (r.kind === 'screen' && !screenStream) {
    c.font = `34px ${FONT}`;
    c.textAlign = 'center';
    txt(c, 'NO SIGNAL', W / 2, H / 2 - 30, '#ff3b30');
    c.font = `24px ${FONT}`;
    txt(c, 'click 🎮 Game capture to connect a game window', W / 2, H / 2 + 10, '#9a9a9a');
    c.textAlign = 'left';
  }
  if (r.kind === 'offline') {
    c.font = `40px ${FONT}`;
    c.textAlign = 'center';
    txt(c, 'MEDIA OFFLINE', W / 2, H / 2 - 40, '#ff3b30');
    c.font = `26px ${FONT}`;
    txt(c, r.name.slice(0, 40), W / 2, H / 2 + 4);
    txt(c, 'add this file again to relink it', W / 2, H / 2 + 34, '#9a9a9a');
    c.textAlign = 'left';
  }

  if (P.titleOn && P.titleBg !== 'none') {
    c.fillStyle = P.titleBg === 'blue' ? '#0a1fa6' : '#000';
    c.fillRect(0, 0, W, H);
  }

  const blinkOn = !P.osdBlink || Math.floor(t * 1.25) % 2 === 0;
  if (P.osd !== 'none' && !P.titleOn) {
    c.font = `36px ${FONT}`;
    txt(c, P.osd, 36, 26);
    const ix = 36 + c.measureText(P.osd).width + 14, iy = 30;
    if (blinkOn) {
      c.fillStyle = P.osd === 'REC' ? '#ff2a1f' : '#f2f2f2';
      c.beginPath();
      if (P.osd === 'PLAY') { c.moveTo(ix, iy); c.lineTo(ix + 20, iy + 12); c.lineTo(ix, iy + 24); c.closePath(); c.fill(); }
      else if (P.osd === 'REC') { c.arc(ix + 11, iy + 12, 10, 0, Math.PI * 2); c.fill(); }
      else if (P.osd === 'PAUSE') { c.fillRect(ix, iy, 7, 24); c.fillRect(ix + 13, iy, 7, 24); }
      else if (P.osd === 'STOP') { c.fillRect(ix, iy + 1, 22, 22); }
    }
  }

  if (P.camText && !P.titleOn) {
    c.font = `36px ${FONT}`;
    c.textAlign = 'right';
    txt(c, P.camText, W - 36, 26);
    c.textAlign = 'left';
  }

  if (!P.titleOn) {
    c.font = `32px ${FONT}`;
    if (P.timecode) txt(c, fmtClock(parseClock(P.tcStart) + a), 36, H - 92);
    if (P.dateText) txt(c, P.dateText, 36, H - 62);
  }

  if (P.titleOn) {
    let text = String(P.titleText || '');
    let cursor = false;
    if (P.titleType) {
      const n = Math.floor(a * 16);
      cursor = n < text.length || Math.floor(t * 2) % 2 === 0;
      text = text.slice(0, n);
    }
    const lines = text.split('\n');
    const all = String(P.titleText || '').split('\n');
    c.font = `46px ${FONT}`;
    const lh = 50, y0 = H / 2 - (all.length * lh) / 2;
    lines.forEach((ln, i) => {
      const full = all[i] || ln;
      const x = W / 2 - c.measureText(full).width / 2;
      txt(c, ln, x, y0 + i * lh);
      if (cursor && i === lines.length - 1) {
        c.fillStyle = '#f2f2f2';
        c.fillRect(x + c.measureText(ln).width + 4, y0 + i * lh + 6, 18, 34);
      }
    });
  }

  if (P.crawlOn && P.crawlText) {
    const y = P.titleOn ? H - 96 : H - 150, bh = 44;
    c.fillStyle = 'rgba(0,0,0,0.85)';
    c.fillRect(0, y, W, bh);
    c.fillStyle = '#c4141a';
    c.fillRect(0, y, W, 3); c.fillRect(0, y + bh - 3, W, 3);
    c.font = `36px ${FONT}`;
    const msg = String(P.crawlText).replace(/\s+/g, ' ') + '     ';
    const tw = c.measureText(msg).width;
    const x = W - ((a * P.crawlSpeed * 30) % (tw + W));
    txt(c, msg, x, y + 6);
  }

  if (subFrames > 0 && P.subText) {
    const inv = Math.random() < 0.5;
    c.fillStyle = inv ? '#e8e8e8' : '#000';
    c.fillRect(0, 0, W, H);
    c.font = `96px ${FONT}`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = inv ? '#000' : '#d0101a';
    c.fillText(P.subText, W / 2, H / 2);
  }
  c.restore();
}

const TINTS = {
  green: [0.55, 1.15, 0.6], amber: [1.2, 0.85, 0.4], blue: [0.5, 0.8, 1.3],
  red: [1.35, 0.45, 0.4], mono: [1, 1, 1],
};

// Thermal palette: black, purple, red, orange, yellow, white.
const THERMAL = new Uint8Array(256 * 3);
(() => {
  const stops = [[0, 0, 0, 10], [60, 70, 0, 120], [120, 200, 0, 60], [170, 255, 110, 0], [215, 255, 220, 30], [255, 255, 255, 255]];
  for (let i = 0; i < 256; i++) {
    let k = 0;
    while (k < stops.length - 2 && i > stops[k + 1][0]) k++;
    const [a, ...ca] = stops[k], [b, ...cb] = stops[k + 1];
    const f = (i - a) / (b - a);
    for (let j = 0; j < 3; j++) THERMAL[i * 3 + j] = ca[j] + (cb[j] - ca[j]) * f;
  }
})();
const moshRows = new Int16Array(H * 2);

function processFrame(t, fx) {
  const s = bctx.getImageData(0, 0, W, H).data;
  const d = outImg.data;
  const g = glitchFrames > 0;

  const chroma = (P.chroma + (g ? 6 : 0)) | 0;
  const noiseAmp = P.noise * 1.4;
  const scanMul = 1 - (P.scan / 100) * 0.6;
  const wob = P.wobble;
  const track = Math.min(100, P.tracking + (g ? 70 : 0));
  const jitterX = (Math.random() - 0.5) * P.jitter * 2;
  const jitterY = Math.random() < P.jitter * 0.03 ? (Math.random() * P.jitter * 0.8) | 0 : 0;
  const hsRows = P.headswitch > 0 ? (4 + P.headswitch * 0.1) | 0 : 0;
  const thermal = P.tint === 'thermal';
  const inv = P.invert > 0 && Math.random() < P.invert * 0.002;
  moshRows.fill(-1);
  if (P.datamosh > 0) {
    // Freeze random macroblocks so the previous frame smears through.
    const n = (P.datamosh / 6) | 0;
    for (let k = 0; k < n; k++) {
      const by = (Math.random() * H / 16 | 0) * 16, bx = (Math.random() * W / 16 | 0) * 16;
      const bw = 16 * (1 + (Math.random() * 6 | 0)), bhh = 16 * (1 + (Math.random() * 3 | 0));
      for (let yy = by; yy < Math.min(H, by + bhh); yy++) { moshRows[yy * 2] = bx; moshRows[yy * 2 + 1] = bx + bw; }
    }
  }
  const tint = TINTS[P.tint];
  const tintK = tint ? (P.tint === 'mono' ? Math.max(P.tintAmt, 1) : P.tintAmt) / 100 : 0;
  const [tr, tg, tb] = tint || [1, 1, 1];
  const mask = 0xff & ~((1 << (P.crush | 0)) - 1);
  const swap = g && glitchSwap;
  const ringK = (P.ring / 100) * 0.9;
  const ghost = P.ghost / 100;
  const sm = fx.staticMix, fade = fx.fade;

  rollPos = (rollPos + P.roll * 0.12 + (g && Math.random() < 0.3 ? Math.random() * 60 : 0)) % H;
  const roll = ((rollPos + jitterY + fx.roll) | 0) % H;

  if (track > 0) {
    trackPos += 0.8 + track * 0.04;
    if (trackPos > H + 80) trackPos = -80 - Math.random() * H * 2 * (1 - track / 100);
  }
  const bh = 4 + track * 0.35;

  let ni = (Math.random() * NOISE_N) | 0;
  for (let y = 0; y < H; y++) {
    let sy = y + roll;
    if (sy >= H) sy -= H;
    const inRollBar = roll > 0 && Math.abs(y - (H - roll)) < 6;

    let off = jitterX;
    if (wob) off += Math.sin(y * 0.045 + t * 2.3) * wob * 0.5 + Math.sin(y * 0.31 + t * 11) * wob * 0.12;

    let lineNoise = 0;
    if (track > 0) {
      const dy = y - trackPos;
      if (dy > -bh && dy < bh) {
        const k = 1 - Math.abs(dy) / bh;
        off += (noiseTab[(ni + y * 7) & NMASK] * 0.5 + 0.6) * track * 0.5 * k;
        lineNoise = k * track * 1.2;
      }
    }
    if (y >= H - hsRows) {
      const k = (y - (H - hsRows)) / hsRows;
      off += k * P.headswitch * 0.6 + noiseTab[(ni + y * 13) & NMASK] * 6;
      lineNoise += k * 45;
    }
    if (g) off += glitchRows[y];

    let dropStart = -1, dropEnd = -1;
    if (P.dropouts && Math.random() < P.dropouts * 0.0004) {
      dropStart = (Math.random() * W) | 0;
      dropEnd = dropStart + 8 + ((Math.random() * 120) | 0);
    }

    const offi = Math.round(off);
    const rb = sy * W, ob = y * W;
    const lineMul = ((y & 1) ? scanMul : 1) * fade;
    ni = (ni + ((Math.random() * 4096) | 0)) & NMASK;
    const nAmp = noiseAmp + lineNoise;
    const ms = moshRows[y * 2], me = moshRows[y * 2 + 1];

    for (let x = 0; x < W; x++) {
      const o = (ob + x) * 4;
      if (inRollBar) { d[o] = d[o + 1] = d[o + 2] = 0; continue; }
      if (x >= ms && x < me) continue;
      const nv = noiseTab[ni]; ni = (ni + 1) & NMASK;
      const gx = x - offi;
      let r, gg, b;
      if (gx < 0 || gx >= W) {
        r = gg = b = 8;
      } else {
        let rx = gx + chroma, bx = gx - chroma;
        if (rx >= W) rx = W - 1;
        if (bx < 0) bx = 0;
        r = s[(rb + rx) * 4]; gg = s[(rb + gx) * 4 + 1]; b = s[(rb + bx) * 4 + 2];
        if (ringK) {
          const gp = gx >= 2 ? s[(rb + gx - 2) * 4 + 1] : gg;
          const h = (gg - gp) * ringK;
          r += h; gg += h; b += h;
        }
      }
      if (swap) { const tmp = r; r = b; b = tmp; }

      let n = nv * nAmp;
      if (lineNoise && nv > 0.9) n += lineNoise * 2.5;
      r += n; gg += n; b += n;

      if (thermal) {
        let l = (r * 0.299 + gg * 0.587 + b * 0.114) | 0;
        l = l < 0 ? 0 : l > 255 ? 255 : l;
        const k = P.tintAmt / 100;
        r += (THERMAL[l * 3] - r) * k; gg += (THERMAL[l * 3 + 1] - gg) * k; b += (THERMAL[l * 3 + 2] - b) * k;
      } else if (tintK) {
        const l = r * 0.299 + gg * 0.587 + b * 0.114;
        r += (l * tr - r) * tintK; gg += (l * tg - gg) * tintK; b += (l * tb - b) * tintK;
      }
      if (inv) { r = 255 - r; gg = 255 - gg; b = 255 - b; }
      if (x >= dropStart && x < dropEnd) { r = gg = b = 215 + nv * 40; }
      if (sm) {
        const sv = 128 + noiseTab[(ni * 3) & NMASK] * 127;
        r += (sv - r) * sm; gg += (sv - gg) * sm; b += (sv - b) * sm;
      }

      const m = vigMap[ob + x] * lineMul;
      r *= m; gg *= m; b *= m;
      if (ghost) { r += (d[o] - r) * ghost; gg += (d[o + 1] - gg) * ghost; b += (d[o + 2] - b) * ghost; }
      if (mask !== 0xff) {
        r = (r < 0 ? 0 : r > 255 ? 255 : r) & mask;
        gg = (gg < 0 ? 0 : gg > 255 ? 255 : gg) & mask;
        b = (b < 0 ? 0 : b > 255 ? 255 : b) & mask;
      }
      d[o] = r; d[o + 1] = gg; d[o + 2] = b;
    }
  }
  vctx.putImageData(outImg, 0, 0);
}

function transitionFx(s, a) {
  const fx = { staticMix: 0, fade: 1, roll: 0 };
  if (s.trans === 'static' && a < 0.6) fx.staticMix = 1 - a / 0.6;
  if (s.trans === 'fade' && a < 1) fx.fade = a;
  if (s.trans === 'roll' && a < 0.8) fx.roll = ((1 - a / 0.8) ** 2) * H * 1.5;
  if (s.fadeOut) {
    const rem = sceneDur(s) - a;
    if (rem < 1) fx.fade = Math.min(fx.fade, Math.max(0, rem));
  }
  return fx;
}

// ---------- scripting ----------
const sceneState = new Map();
let overrides = {}, postFns = [], frameNo = 0, lastScriptErr = '';
const scriptErrEl = () => $('#scriptErr');

function resetSceneState(s) { sceneState.set(s.id, {}); }

const api = {
  ctx: bctx, W, H, t: 0, T: 0, dt: 0, frame: 0, state: {}, scene: null,
  rand: Math.random, noise: HCNoise, PI: Math.PI,
  lerp: (a, b, k) => a + (b - a) * k,
  clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
  map: (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c),
  text(str, x, y, o = {}) {
    const c = bctx;
    c.save();
    c.font = `${o.size || 40}px ${o.font || 'VT323, monospace'}`;
    c.textAlign = o.align || 'left';
    c.textBaseline = o.baseline || 'middle';
    c.fillStyle = o.color || '#f2f2f2';
    c.globalAlpha = o.alpha ?? 1;
    c.fillText(String(str), x, y);
    c.restore();
  },
  image(name) { const m = media.get(name); return m && (m.kind === 'image' || m.kind === 'video') ? m.el : null; },
  drawImage(name, x = 0, y = 0, w, h, o = {}) {
    const el = api.image(name);
    if (!el) return;
    bctx.save();
    bctx.globalAlpha = o.alpha ?? 1;
    if (o.blend) bctx.globalCompositeOperation = o.blend;
    bctx.drawImage(el, x, y, w ?? (el.naturalWidth || el.videoWidth), h ?? (el.naturalHeight || el.videoHeight));
    bctx.restore();
  },
  cube: HC3D.cube, sphere: HC3D.sphere, torus: HC3D.torus, pyramid: HC3D.pyramid,
  plane: HC3D.plane, figure: HC3D.figure, box: HC3D.box, merge: HC3D.merge,
  model(name) { const m = media.get(name); return m && m.kind === 'model' ? m.mesh : null; },
  render3d(m, o) { HC3D.render(bctx, m, o); },
  glitch: () => triggerGlitch(),
  flash: () => { subFrames = 2; },
  burst: (level = 0.4, secs = 0.3) => audioBurst(level, secs),
  set(id, v) { if (id in DEFAULTS) overrides[id] = v; },
  after(fn) { if (typeof fn === 'function') postFns.push(fn); },
  every(sec) {
    const key = '__every' + sec, n = Math.floor(api.t / sec);
    const st = api.state, prev = st[key];
    st[key] = n;
    return prev !== undefined && prev !== n;
  },
};

function runScript(s, t, a, dt) {
  overrides = {};
  postFns = [];
  if (!s.scriptOn || !s.script || !s.script.trim()) { showScriptErr(''); return; }
  const c = HCScript.compile(s.script);
  if (c.err) { showScriptErr(c.err.message); return; }
  if (!sceneState.has(s.id)) resetSceneState(s);
  Object.assign(api, { t: a, T: t, dt, frame: frameNo, state: sceneState.get(s.id), scene: s });
  bctx.save();
  try {
    c.fn(api);
    showScriptErr('');
  } catch (e) {
    showScriptErr(e.message);
  }
  bctx.restore();
}

function showScriptErr(msg) {
  if (msg === lastScriptErr) return;
  lastScriptErr = msg;
  const el = scriptErrEl();
  if (el) { el.textContent = msg ? '⚠ ' + msg : ''; el.hidden = !msg; }
}

// ---------- main loop ----------
const t0 = performance.now();
let lastNow = t0, lastFlutter = 0, lastThumb = 0;

function frame(now) {
  const t = (now - t0) / 1000;
  const dt = Math.min(0.1, (now - lastNow) / 1000);
  lastNow = now;

  advance(dt);
  const s = cur();
  const r = resolve(s);
  const a = prog.t;

  if (glitchFrames > 0) glitchFrames--;
  else if (Math.random() < P.glitch * 0.0006) triggerGlitch();
  if (subFrames > 0) subFrames--;
  else if (P.subText && P.subRate > 0 && Math.random() < P.subRate * 0.0003) subFrames = 2;

  frameNo++;
  drawSource(r, a);
  runScript(s, t, a, dt);
  // Script overrides last one frame: apply them, render, then put the real values back.
  const saved = {};
  for (const k in overrides) { saved[k] = P[k]; P[k] = overrides[k]; }
  drawOverlays(r, t, a);
  processFrame(t, transitionFx(s, a));
  for (const k in saved) P[k] = saved[k];
  if (postFns.length) {
    for (const fn of postFns) {
      vctx.save();
      try { fn(vctx); } catch (e) { showScriptErr(e.message); }
      vctx.restore();
    }
  }

  if (curVideo && prog.playing && now - lastFlutter > 120) {
    lastFlutter = now;
    const w = (Math.sin(t * 1.7) * 0.6 + Math.sin(t * 5.3) * 0.4) * P.flutter * 0.0004;
    try { curVideo.preservesPitch = false; curVideo.playbackRate = 1 + w; } catch (e) { /* ignore */ }
  }
  if (now - lastThumb > 600) { lastThumb = now; updateThumb(s); }
  updateTransport();
  requestAnimationFrame(frame);
}

// ---------- transport ----------
const seek = $('#seek'), timeEl = $('#time'), playBtn = $('#playBtn');
let seeking = false;
const fmt = s => isFinite(s) ? `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}` : '--:--';

function updateTransport() {
  const total = totalDur();
  const T = sceneStart(prog.idx) + prog.t;
  if (!seeking) seek.value = total ? (T / total) * 1000 : 0;
  timeEl.textContent = `${fmt(T)} / ${fmt(total)}`;
  playBtn.textContent = prog.playing ? '❚❚' : '▶';
  const el = document.querySelector(`.clip[data-id="${cur().id}"]`);
  if (el) el.style.setProperty('--p', Math.min(1, prog.t / sceneDur(cur())));
}

seek.addEventListener('input', () => { seeking = true; seekProgram((seek.value / 1000) * totalDur()); });
seek.addEventListener('change', () => { seeking = false; });
playBtn.addEventListener('click', togglePlay);
$('#startBtn').addEventListener('click', () => enterScene(0, 0));

// ---------- recording and export ----------
let rec = null, chunks = [];
const recBtn = $('#recBtn'), statusEl = $('#status');
let statusTimer = 0;

function flashStatus(msg) {
  statusEl.classList.remove('on');
  statusEl.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { if (!rec) statusEl.textContent = ''; }, 4000);
}

function stamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

function startRec() {
  if (rec) return;
  if (!window.MediaRecorder || !view.captureStream) { flashStatus('Recording is not supported in this browser'); return; }
  initAudio();
  const tracks = [...view.captureStream(30).getVideoTracks()];
  if (recDest) tracks.push(...recDest.stream.getAudioTracks());
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    .find(m => MediaRecorder.isTypeSupported(m)) || '';
  rec = new MediaRecorder(new MediaStream(tracks), mime ? { mimeType: mime, videoBitsPerSecond: 8e6 } : {});
  chunks = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    const type = rec.mimeType || 'video/webm';
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    download(new Blob(chunks, { type }), `hollowcast-${stamp()}.${ext}`);
    rec = null;
    recBtn.classList.remove('on');
    recBtn.textContent = '● Record';
    flashStatus('Saved');
  };
  rec.start(250);
  recBtn.classList.add('on');
  recBtn.textContent = '■ Stop';
  statusEl.textContent = exporting ? 'EXPORTING (keep this tab visible)' : 'REC';
  statusEl.classList.add('on');
}

function stopRec() {
  exporting = false;
  if (rec && rec.state !== 'inactive') rec.stop();
}

function finishExport() {
  pause();
  stopRec();
}

async function exportFilm() {
  if (rec) return;
  initAudio();
  pause();
  exporting = true;
  enterScene(0, 0);
  if (curVideo) {
    await Promise.race([
      new Promise(r => curVideo.addEventListener('seeked', r, { once: true })),
      new Promise(r => setTimeout(r, 1000)),
    ]);
  }
  startRec();
  play();
}

function snapshotPng() {
  view.toBlob(b => b && download(b, `hollowcast-${stamp()}.png`), 'image/png');
}

recBtn.addEventListener('click', () => (rec ? stopRec() : startRec()));
$('#exportBtn').addEventListener('click', exportFilm);
$('#snapBtn').addEventListener('click', snapshotPng);
$('#glitchBtn').addEventListener('click', () => triggerGlitch());
$('#flashBtn').addEventListener('click', () => { subFrames = 2; });

// ---------- timeline ----------
const TRANS_ICON = { cut: '│', fade: '◐', static: '░', roll: '↕', glitch: '⚡' };
let dragFrom = -1;

function updateThumb(s) {
  try {
    const c = thumbCanvas.getContext('2d');
    c.drawImage(view, 0, 0, thumbCanvas.width, thumbCanvas.height);
    s.thumb = thumbCanvas.toDataURL('image/jpeg', 0.6);
    const el = document.querySelector(`.clip[data-id="${s.id}"]`);
    if (el) el.style.backgroundImage = `url(${s.thumb})`;
  } catch (e) { /* tainted or unavailable */ }
}

function renderTimeline() {
  const tl = $('#tl');
  tl.innerHTML = '';
  project.scenes.forEach((s, i) => {
    const d = sceneDur(s);
    const b = document.createElement('div');
    b.className = 'clip' + (i === sel ? ' sel' : '') + (resolve(s).kind === 'offline' ? ' offline' : '');
    b.dataset.id = s.id;
    b.draggable = true;
    b.style.flexGrow = d;
    if (s.thumb) b.style.backgroundImage = `url(${s.thumb})`;
    b.title = `${s.name}: ${d.toFixed(1)}s, ${s.trans} in. Drag to reorder.`;
    const head = document.createElement('div');
    head.className = 'ch';
    head.innerHTML = `<span class="ci"></span><span class="ct"></span>`;
    head.querySelector('.ci').textContent = `${i + 1} ${TRANS_ICON[s.trans] || ''}`;
    head.querySelector('.ct').textContent = `${d.toFixed(1)}s`;
    const name = document.createElement('div');
    name.className = 'cn';
    name.textContent = s.name;
    b.append(head, name);
    b.addEventListener('click', () => enterScene(i, 0));
    b.addEventListener('dragstart', e => { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.id); });
    b.addEventListener('dragover', e => { if (dragFrom >= 0) { e.preventDefault(); b.classList.add('over'); } });
    b.addEventListener('dragleave', () => b.classList.remove('over'));
    b.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      b.classList.remove('over');
      if (dragFrom < 0 || dragFrom === i) return;
      moveScene(dragFrom, i);
      dragFrom = -1;
    });
    b.addEventListener('dragend', () => { dragFrom = -1; });
    tl.append(b);
  });
}

function moveScene(from, to) {
  const sc = project.scenes;
  const curId = cur().id;
  const [s] = sc.splice(from, 1);
  sc.splice(to, 0, s);
  const ni = sc.findIndex(x => x.id === curId);
  prog.idx = ni; sel = ni;
  checkpoint();
  renderTimeline();
  syncInspector();
}

function addScene() {
  const s = makeScene({ name: 'Scene', src: 'black', dur: 5, params: { ...P } });
  project.scenes.splice(sel + 1, 0, s);
  checkpoint();
  enterScene(sel + 1, 0);
}
function dupScene() {
  const { thumb, ...c } = cur();
  const s = makeScene({ ...JSON.parse(JSON.stringify(c)), id: uid(), name: c.name + ' copy' });
  project.scenes.splice(sel + 1, 0, s);
  checkpoint();
  enterScene(sel + 1, 0);
}
function delScene() {
  if (project.scenes.length <= 1) return flashStatus('A film needs at least one scene');
  pause();
  project.scenes.splice(sel, 1);
  checkpoint();
  enterScene(Math.min(sel, project.scenes.length - 1), 0, true);
}
function splitScene() {
  const s = cur();
  const d = sceneDur(s), at = prog.t;
  if (at < 0.2 || at > d - 0.2) return flashStatus('Move the playhead inside the scene to split it');
  pause();
  const { thumb, ...c } = s;
  const b = makeScene({ ...JSON.parse(JSON.stringify(c)), id: uid(), name: s.name + ' (b)', trans: 'cut' });
  if (resolve(s).kind === 'video') {
    const cutAt = s.inPt + at;
    b.inPt = cutAt;
    b.outPt = s.outPt;
    s.outPt = cutAt;
  } else {
    b.dur = +(d - at).toFixed(2);
    s.dur = +at.toFixed(2);
  }
  s.fadeOut = false;
  project.scenes.splice(sel + 1, 0, b);
  checkpoint();
  enterScene(sel + 1, 0);
}

$('#addScene').addEventListener('click', addScene);
$('#dupScene').addEventListener('click', dupScene);
$('#delScene').addEventListener('click', delScene);
$('#splitScene').addEventListener('click', splitScene);
$('#loopChk').addEventListener('change', e => { project.loop = e.target.checked; checkpoint(); });

// ---------- scene inspector ----------
const ins = {
  idx: $('#insIdx'), name: $('#sName'), src: $('#sSrc'), dur: $('#sDur'), rowDur: $('#rowDur'),
  rowTrim: $('#rowTrim'), inPt: $('#sIn'), outPt: $('#sOut'), trans: $('#sTrans'), fadeOut: $('#sFadeOut'),
};

function sourceOptions() {
  const opts = [['testcard', 'Test card (color bars)'], ['black', 'Black'], ['webcam', 'Webcam (live)'], ['screen', 'Game / screen capture (live)']];
  const names = new Set([...media.values()].filter(m => m.kind !== 'model').map(m => m.name));
  project.scenes.forEach(s => { if (s.src.startsWith('m:')) names.add(s.src.slice(2)); });
  names.forEach(n => opts.push(['m:' + n, (media.has(n) ? (media.get(n).kind === 'video' ? '▶ ' : '▣ ') : '✕ OFFLINE ') + n]));
  return opts;
}

function syncInspector() {
  const s = cur();
  if (!s) return;
  ins.idx.textContent = `${prog.idx + 1} / ${project.scenes.length}`;
  if (document.activeElement !== ins.name) ins.name.value = s.name;
  ins.src.innerHTML = '';
  for (const [v, l] of sourceOptions()) ins.src.append(new Option(l, v));
  ins.src.value = s.src;
  const r = resolve(s);
  const isVid = r.kind === 'video';
  ins.rowDur.hidden = isVid;
  ins.rowTrim.hidden = !isVid;
  if (document.activeElement !== ins.dur) ins.dur.value = s.dur;
  if (isVid) {
    const d = r.el.duration;
    if (document.activeElement !== ins.inPt) ins.inPt.value = (+s.inPt).toFixed(1);
    if (document.activeElement !== ins.outPt) ins.outPt.value = s.outPt != null ? (+s.outPt).toFixed(1) : (isFinite(d) ? d.toFixed(1) : '');
  }
  ins.trans.value = s.trans;
  ins.fadeOut.checked = !!s.fadeOut;
  $('#loopChk').checked = project.loop;
  renderBin();
}

ins.name.addEventListener('input', () => { cur().name = ins.name.value; renderTimeline(); save(); });
ins.name.addEventListener('change', checkpoint);
ins.src.addEventListener('change', async () => {
  const s = cur();
  if (ins.src.value === 'screen' && !(await startScreen())) { ins.src.value = s.src; return; }
  s.src = ins.src.value;
  s.inPt = 0; s.outPt = null;
  checkpoint();
  enterScene(prog.idx, 0, true);
});
ins.dur.addEventListener('change', () => {
  cur().dur = Math.max(0.5, parseFloat(ins.dur.value) || 5);
  checkpoint(); renderTimeline();
});
ins.inPt.addEventListener('change', () => {
  const s = cur();
  s.inPt = Math.max(0, parseFloat(ins.inPt.value) || 0);
  if (s.outPt != null && s.outPt <= s.inPt) s.outPt = null;
  checkpoint(); enterScene(prog.idx, 0, true);
});
ins.outPt.addEventListener('change', () => {
  const s = cur();
  const v = parseFloat(ins.outPt.value);
  s.outPt = isFinite(v) && v > s.inPt ? v : null;
  checkpoint(); enterScene(prog.idx, 0, true);
});
$('#setIn').addEventListener('click', () => {
  const s = cur();
  if (!curVideo) return;
  s.inPt = +curVideo.currentTime.toFixed(2);
  if (s.outPt != null && s.outPt <= s.inPt) s.outPt = null;
  checkpoint(); enterScene(prog.idx, 0, true);
});
$('#setOut').addEventListener('click', () => {
  const s = cur();
  if (!curVideo) return;
  const v = +curVideo.currentTime.toFixed(2);
  if (v > s.inPt + 0.1) s.outPt = v;
  checkpoint(); syncInspector(); renderTimeline();
});
ins.trans.addEventListener('change', () => { cur().trans = ins.trans.value; checkpoint(); renderTimeline(); });
ins.fadeOut.addEventListener('change', () => { cur().fadeOut = ins.fadeOut.checked; checkpoint(); });

function renderBin() {
  const bin = $('#bin');
  bin.innerHTML = '';
  const opts = sourceOptions();
  for (const [v, l] of opts) {
    const b = document.createElement('button');
    b.className = 'chip' + (v === cur().src ? ' active' : '') + (l.startsWith('✕') ? ' offline' : '');
    b.textContent = l.replace(' (color bars)', '').replace(' (live)', '').replace('Game / screen capture', '🎮 Game capture');
    b.title = l.startsWith('✕') ? 'Missing: add this file again to relink' : 'Use this as the current scene\'s source';
    b.addEventListener('click', async () => {
      const s = cur();
      if (v === 'screen' && !(await startScreen())) return;
      if (s.src === v) return;
      s.src = v; s.inPt = 0; s.outPt = null;
      checkpoint();
      enterScene(prog.idx, 0, true);
    });
    bin.append(b);
  }
  for (const m of media.values()) {
    if (m.kind !== 'model') continue;
    const b = document.createElement('button');
    b.className = 'chip model';
    b.textContent = '◆ ' + m.name;
    b.title = 'Click to add this 3D model to the scene script';
    b.addEventListener('click', () => {
      const s = cur();
      s.script = (s.script ? s.script + '\n\n' : '') +
        `render3d(model('${m.name}'), { ry: t * 0.5, color: '#bbbbbb', scale: 1 });`;
      s.scriptOn = true;
      checkpoint();
      syncScriptPanel();
    });
    bin.append(b);
  }
}

// ---------- parameter controls ----------
const controlEls = {};

function readInput(p, el) {
  if (p.type === 'range') return parseFloat(el.value);
  if (p.type === 'check') return el.checked;
  return el.value;
}

function writeInput(p) {
  const el = controlEls[p.id];
  if (!el || document.activeElement === el && p.type !== 'range') return;
  if (p.type === 'check') el.checked = !!P[p.id];
  else el.value = P[p.id];
  if (el._val) el._val.textContent = P[p.id];
}
const syncControls = () => PARAMS.forEach(writeInput);

function onParamChange(id) {
  if (id === 'vignette') buildVignette();
  if (id === 'cardText') buildTestcard();
  if (AUDIO_IDS.has(id)) applyAudio();
  save();
}

function buildControls() {
  const root = $('#controls');
  const groups = {};
  for (const p of PARAMS) {
    if (!groups[p.group]) {
      const det = document.createElement('details');
      det.className = 'group';
      det.open = p.group === 'Signal' || p.group === 'Overlays';
      const sum = document.createElement('summary');
      sum.textContent = p.group.toUpperCase();
      det.append(sum);
      root.append(det);
      groups[p.group] = det;
    }
    const row = document.createElement('label');
    row.className = 'row ' + p.type;
    const name = document.createElement('span');
    name.textContent = p.label;
    row.append(name);

    let el;
    if (p.type === 'range') {
      el = Object.assign(document.createElement('input'), { type: 'range', min: p.min, max: p.max, step: p.step || 1 });
    } else if (p.type === 'select') {
      el = document.createElement('select');
      for (const [v, l] of p.options) el.append(new Option(l, v));
    } else if (p.type === 'check') {
      el = Object.assign(document.createElement('input'), { type: 'checkbox' });
    } else if (p.type === 'textarea') {
      el = document.createElement('textarea');
      el.rows = 3;
    } else {
      el = Object.assign(document.createElement('input'), { type: 'text' });
    }
    row.append(el);
    if (p.type === 'range') {
      el._val = document.createElement('span');
      el._val.className = 'val';
      row.append(el._val);
    }
    el.addEventListener('input', () => {
      P[p.id] = readInput(p, el);
      if (el._val) el._val.textContent = P[p.id];
      onParamChange(p.id);
    });
    el.addEventListener('change', checkpoint);
    controlEls[p.id] = el;
    groups[p.group].append(row);
  }
}

function applyPreset(name) {
  Object.assign(P, lookOf(name));
  vigFor = -1;
  buildVignette();
  buildTestcard(true);
  applyAudio();
  syncControls();
  checkpoint();
  document.querySelectorAll('#presets button').forEach(b => b.classList.toggle('active', b.textContent === name));
}

function buildPresets() {
  const root = $('#presets');
  for (const name of Object.keys(PRESETS)) {
    const b = document.createElement('button');
    b.textContent = name;
    b.addEventListener('click', () => applyPreset(name));
    root.append(b);
  }
}

$('#lookAllBtn').addEventListener('click', () => {
  const look = {};
  for (const p of PARAMS) if (!TEXT_IDS.has(p.id) && p.group !== 'Overlays') look[p.id] = P[p.id];
  project.scenes.forEach(s => Object.assign(s.params, look));
  checkpoint();
  flashStatus('Copied this look to every scene');
});

$('#resetSceneBtn').addEventListener('click', () => {
  Object.assign(P, DEFAULTS);
  vigFor = -1;
  buildVignette();
  buildTestcard(true);
  applyAudio();
  syncControls();
  checkpoint();
});

// ---------- project files ----------
$('#newBtn').addEventListener('click', () => {
  if (!confirm('Start a new film? The current timeline will be replaced (you can still undo).')) return;
  pause();
  undoStack.push(snapshot());
  project.scenes = [makeScene({ name: 'Scene', src: 'testcard', dur: 5 })];
  project.loop = false;
  sel = 0;
  lastSnap = snapshot();
  enterScene(0, 0, true);
  renderAll();
  save();
});

$('#saveBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
  download(blob, `hollowcast-project-${stamp()}.json`);
  flashStatus('Project saved. Media files are not included: keep them next to it.');
});

function openProjectFile(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const data = JSON.parse(fr.result);
      if (!data || !Array.isArray(data.scenes)) throw new Error('not a HOLLOWCAST project');
      pause();
      undoStack.push(snapshot());
      loadProject(data);
      lastSnap = snapshot();
      enterScene(sel, 0, true);
      renderAll();
      save();
      flashStatus('Project opened. Add its media files to relink them.');
    } catch (e) {
      flashStatus('Could not open project: ' + e.message);
    }
  };
  fr.readAsText(file);
}

$('#openFile').addEventListener('change', e => { if (e.target.files[0]) openProjectFile(e.target.files[0]); e.target.value = ''; });
$('#file').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });

const drop = $('#drop');
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
  if (dragFrom >= 0) return;
  e.preventDefault();
  drop.classList.add('dragging');
}));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('dragging'); }));
drop.addEventListener('drop', e => { if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

// ---------- script panel ----------
const codeEl = $('#code'), scriptOnEl = $('#scriptOn'), exampleEl = $('#examples');
for (const name of Object.keys(SCRIPT_EXAMPLES)) exampleEl.append(new Option(name, name));
$('#scriptHelp').textContent = SCRIPT_HELP;

function syncScriptPanel() {
  const s = cur();
  if (!s) return;
  if (document.activeElement !== codeEl) codeEl.value = s.script || '';
  scriptOnEl.checked = s.scriptOn !== false;
}
codeEl.addEventListener('input', () => { cur().script = codeEl.value; save(); });
codeEl.addEventListener('change', checkpoint);
codeEl.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const a = codeEl.selectionStart;
    codeEl.setRangeText('  ', a, codeEl.selectionEnd, 'end');
    cur().script = codeEl.value;
  }
});
scriptOnEl.addEventListener('change', () => { cur().scriptOn = scriptOnEl.checked; checkpoint(); });
$('#insertExample').addEventListener('click', () => {
  const name = exampleEl.value;
  if (!name) return;
  const s = cur();
  s.script = SCRIPT_EXAMPLES[name];
  s.scriptOn = true;
  resetSceneState(s);
  checkpoint();
  syncScriptPanel();
});

// ---------- keyboard ----------
window.addEventListener('keydown', e => {
  if (e.target.matches('input[type=text], input[type=number], textarea, select')) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); dupScene(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (k === ' ') { e.preventDefault(); togglePlay(); }
  else if (k === 'g') triggerGlitch();
  else if (k === 'f') subFrames = 2;
  else if (k === 'r') (rec ? stopRec() : startRec());
  else if (k === 's') snapshotPng();
  else if (k === 'b') splitScene();
  else if (k === 'home') enterScene(0, 0);
  else if (k === 'arrowleft') { e.preventDefault(); enterScene(prog.t > 0.5 ? prog.idx : prog.idx - 1, 0); }
  else if (k === 'arrowright') { e.preventDefault(); enterScene(prog.idx + 1, 0); }
});

// ---------- boot ----------
function renderAll() {
  renderTimeline();
  syncInspector();
  syncControls();
  syncScriptPanel();
}

(function boot() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { /* ignore */ }
  loadProject(data || { scenes: demoScenes() });
  buildControls();
  buildPresets();
  P = project.scenes[sel].params;
  enterScene(sel, 0, true);
  renderAll();
  lastSnap = snapshot();
  if (document.fonts) document.fonts.load('44px VT323').then(() => buildTestcard(true)).catch(() => {});
  requestAnimationFrame(frame);
})();
