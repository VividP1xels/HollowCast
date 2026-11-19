'use strict';
/* HOLLOWCAST main menu: shown at launch, fully customizable, saved on this device. */

const HCMenu = (() => {
  const KEY = 'hollowcast.menu';
  const BUTTONS = [
    ['continue', 'Continue editing'], ['new', 'New film'], ['open', 'Open project'], ['templates', 'Start from a template'],
    ['inspo', 'Inspiration'], ['customize', 'Customize menu'], ['quit', 'Quit'],
  ];
  const DEF = {
    title: 'HOLLOWCAST', subtitle: 'analog horror editor', tagline: 'PLEASE STAND BY',
    titleColor: '#e8e8e8', accent: '#9dff8a', font: 'VT323', titleSize: 96, align: 'left',
    bg: 'live', bgImage: '', bgTint: '#000000', noise: 35, scan: 55, vignette: 75, darken: 45,
    glitchTitle: true, clock: true, ambient: true, showVersion: true,
    labels: Object.fromEntries(BUTTONS.map(([k, l]) => [k, l])),
    show: Object.fromEntries(BUTTONS.map(([k]) => [k, true])),
  };
  const SCHEMA = [
    ['Text', [['title', 'Title', 'text'], ['subtitle', 'Subtitle', 'text'], ['tagline', 'Tagline', 'text'],
      ['font', 'Font', 'font'], ['titleSize', 'Title size', 'range', 40, 160, 1], ['align', 'Layout', 'select', [['left', 'Left'], ['center', 'Center'], ['right', 'Right']]],
      ['titleColor', 'Title color', 'color'], ['accent', 'Accent color', 'color'], ['glitchTitle', 'Glitching title', 'check']]],
    ['Background', [['bg', 'Background', 'select', [['live', 'Live preview of your film'], ['static', 'TV static'], ['bars', 'Color bars'], ['image', 'Your image'], ['black', 'Black']]],
      ['bgImage', 'Background image', 'image'], ['bgTint', 'Tint', 'color'], ['darken', 'Darken', 'range', 0, 95, 1], ['noise', 'Static', 'range', 0, 100, 1],
      ['scan', 'Scanlines', 'range', 0, 100, 1], ['vignette', 'Vignette', 'range', 0, 100, 1]]],
    ['Extras', [['clock', 'VCR clock', 'check'], ['ambient', 'Ambient hum', 'check'], ['showVersion', 'Version number', 'check']]],
  ];

  let cfg = load(), hooks = {}, raf = 0, open = false, bgImg = null, amb = null;

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { ...DEF, ...s, labels: { ...DEF.labels, ...(s.labels || {}) }, show: { ...DEF.show, ...(s.show || {}) } };
    } catch (e) { return JSON.parse(JSON.stringify(DEF)); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* image may be too large */ } }

  const $ = s => document.querySelector(s);
  const root = () => $('#menu');

  function apply() {
    const m = root();
    m.style.setProperty('--m-accent', cfg.accent);
    m.style.setProperty('--m-title', cfg.titleColor);
    m.style.setProperty('--m-font', `"${cfg.font}", VT323, monospace`);
    m.style.setProperty('--m-size', cfg.titleSize + 'px');
    m.dataset.align = cfg.align;
    $('#mTitle').textContent = cfg.title;
    $('#mTitle').dataset.text = cfg.title;
    $('#mTitle').classList.toggle('glitchy', !!cfg.glitchTitle);
    $('#mSub').textContent = cfg.subtitle;
    $('#mTag').textContent = cfg.tagline;
    $('#mVersion').hidden = !cfg.showVersion;
    $('#mClock').hidden = !cfg.clock;
    const list = $('#mButtons');
    list.innerHTML = '';
    for (const [k] of BUTTONS) {
      if (!cfg.show[k]) continue;
      if (k === 'quit' && !(window.hollowcast && window.hollowcast.desktop)) continue;
      const b = document.createElement('button');
      b.className = 'm-btn';
      b.textContent = cfg.labels[k] || k;
      b.addEventListener('click', () => action(k));
      list.append(b);
    }
    bgImg = null;
    if (cfg.bgImage) { bgImg = new Image(); bgImg.src = cfg.bgImage; }
    if (open) ambient(cfg.ambient);
  }

  function action(k) {
    if (k === 'customize') { toggleCustomizer(true); return; }
    if (k === 'quit') { window.close(); return; }
    if (k === 'templates') { $('#mTemplates').hidden = !$('#mTemplates').hidden; return; }
    hide();
    hooks[k] && hooks[k]();
  }

  // ---------- background ----------
  const noiseTile = document.createElement('canvas');
  noiseTile.width = noiseTile.height = 128;
  function refreshNoise() {
    const c = noiseTile.getContext('2d'), d = c.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    c.putImageData(d, 0, 0);
  }

  function draw(now) {
    if (!open) return;
    const cv = $('#mBg'), c = cv.getContext('2d');
    const W = cv.width = Math.min(1280, innerWidth), H = cv.height = Math.round(W * innerHeight / innerWidth);
    const t = now / 1000;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    const cover = (el, w, h) => { const s = Math.max(W / w, H / h); c.drawImage(el, (W - w * s) / 2, (H - h * s) / 2, w * s, h * s); };
    if (cfg.bg === 'live' && hooks.view) cover(hooks.view(), 640, 480);
    else if (cfg.bg === 'bars' && hooks.testcard) cover(hooks.testcard(), 640, 480);
    else if (cfg.bg === 'image' && bgImg && bgImg.naturalWidth) {
      const sh = Math.sin(t * 0.7) * 3;
      c.save(); c.translate(sh, 0); cover(bgImg, bgImg.naturalWidth, bgImg.naturalHeight); c.restore();
    }
    if (cfg.bg === 'static' || cfg.noise) {
      refreshNoise();
      c.save(); c.globalAlpha = cfg.bg === 'static' ? 0.9 : cfg.noise / 250;
      for (let y = 0; y < H; y += 128) for (let x = 0; x < W; x += 128) c.drawImage(noiseTile, x, y);
      c.restore();
    }
    if (cfg.darken) { c.fillStyle = cfg.bgTint; c.globalAlpha = cfg.darken / 100; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    if (cfg.scan) { c.fillStyle = `rgba(0,0,0,${cfg.scan / 160})`; for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1); }
    // A rolling tracking bar.
    const ty = ((t * 60) % (H + 200)) - 100;
    c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(0, ty, W, 30);
    if (cfg.vignette) {
      const g = c.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, Math.hypot(W, H) / 2);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${cfg.vignette / 100})`);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    if (cfg.clock) {
      const d = new Date(), p = n => String(n).padStart(2, '0');
      $('#mClock').textContent = `PLAY ▶  ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }
    if (cfg.glitchTitle) $('#mTitle').classList.toggle('jolt', Math.random() < 0.04);
    raf = requestAnimationFrame(draw);
  }

  function ambient(on) {
    const ac = hooks.audio && hooks.audio();
    if (!ac) return;
    if (on && !amb) {
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
      o1.type = o2.type = 'sawtooth'; o1.frequency.value = 41; o2.frequency.value = 41.4; lp.frequency.value = 160; g.gain.value = 0;
      o1.connect(lp); o2.connect(lp); lp.connect(g).connect(ac.destination);
      o1.start(); o2.start(); g.gain.setTargetAtTime(0.05, ac.currentTime, 1);
      amb = { g, stop: () => { g.gain.setTargetAtTime(0, ac.currentTime, 0.2); setTimeout(() => { o1.stop(); o2.stop(); }, 1500); } };
    } else if (!on && amb) { amb.stop(); amb = null; }
  }

  function show() {
    open = true;
    root().hidden = false;
    document.querySelectorAll('header, main').forEach(el => { el.inert = true; });
    apply();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  }
  function hide() {
    open = false;
    root().hidden = true;
    toggleCustomizer(false);
    document.querySelectorAll('header, main').forEach(el => { el.inert = false; });
    cancelAnimationFrame(raf);
    ambient(false);
  }

  function toggleCustomizer(on) {
    const d = $('#mCustom');
    d.hidden = !on;
    if (!on) return;
    const box = $('#mForm');
    box.innerHTML = '';
    hooks.buildForm(box, cfg, SCHEMA, () => { save(); apply(); });
    const sub = document.createElement('div');
    sub.className = 'subhead';
    sub.textContent = 'Buttons';
    box.append(sub);
    for (const [k, def] of BUTTONS) {
      const row = document.createElement('div');
      row.className = 'row2';
      const chk = Object.assign(document.createElement('input'), { type: 'checkbox', checked: cfg.show[k] });
      const txt = Object.assign(document.createElement('input'), { type: 'text', value: cfg.labels[k], placeholder: def });
      txt.style.flex = '1';
      chk.addEventListener('change', () => { cfg.show[k] = chk.checked; if (k === 'customize' && !chk.checked) { cfg.show[k] = true; chk.checked = true; } save(); apply(); });
      txt.addEventListener('input', () => { cfg.labels[k] = txt.value || def; save(); apply(); });
      row.append(chk, txt);
      box.append(row);
    }
  }

  function init(h) {
    hooks = h;
    $('#mCustomClose').addEventListener('click', () => toggleCustomizer(false));
    $('#mReset').addEventListener('click', () => { cfg = JSON.parse(JSON.stringify(DEF)); save(); apply(); toggleCustomizer(true); });
    $('#mVersion').textContent = 'v' + (h.version || '');
    document.addEventListener('keydown', e => { if (open && e.key === 'Escape' && !$('#mCustom').hidden) toggleCustomizer(false); });
    // The menu can start its ambient hum only after a click, as browsers require.
    root().addEventListener('pointerdown', () => { if (open && cfg.ambient) ambient(true); });
    apply();
  }

  return { init, show, hide, isOpen: () => open };
})();
