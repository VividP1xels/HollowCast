'use strict';
/* HOLLOWCAST effect library: 45 effect families, 24 tuned variants each (1,080 effects).
   Every variant has its own seeded parameters, so "Drowned Kaleidoscope" and
   "Feral Kaleidoscope" really are different. Effects run on the frame before tape damage. */

const HCFX = (() => {
  const W = 640, H = 480;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const orig = mk(), octx = orig.getContext('2d', { willReadFrequently: true });

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const lum = (d, i) => d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

  const PALETTES = [
    ['#000000', '#3b0000', '#a00000', '#ff4a2a', '#ffe0c0'],
    ['#020a02', '#0f3d12', '#2f8f2f', '#9dff8a', '#f0fff0'],
    ['#00000a', '#0a1a4a', '#2a5ab0', '#8ac8ff', '#ffffff'],
    ['#0d0221', '#541388', '#d90368', '#f1e9da', '#2e294e'],
    ['#000000', '#404040', '#808080', '#c0c0c0', '#ffffff'],
    ['#1b1b1b', '#5c4a2e', '#a88a5a', '#e8d8b0', '#fff8e8'],
    ['#000000', '#00ffff', '#ff00ff', '#ffff00', '#ffffff'],
    ['#050505', '#2b1d0e', '#8c3b0c', '#e0a030', '#fff4c0'],
    ['#000000', '#1a0f2e', '#5a1f5e', '#c04080', '#ffd0e0'],
    ['#001010', '#004848', '#00a0a0', '#80ffe0', '#f0fff8'],
  ];
  const DUO = [['#000000', '#ff2020'], ['#001a00', '#9dff8a'], ['#0a0a30', '#f0e0a0'], ['#200010', '#00ffd0'], ['#000000', '#ffffff'], ['#2a0000', '#ffd0a0'], ['#000018', '#a0c0ff'], ['#101010', '#ff8a00']];
  const ADJ = ['Hollow', 'Drowned', 'Rotten', 'Feral', 'Choking', 'Static', 'Weeping', 'Buried', 'Crawling', 'Hungry',
    'Sleepless', 'Faceless', 'Burning', 'Frozen', 'Bleeding', 'Whispering', 'Forgotten', 'Wrong', 'Broken', 'Twitching',
    'Distant', 'Endless', 'Silent', 'Screaming'];

  // Noise texture for static patches.
  const noiseTex = document.createElement('canvas');
  noiseTex.width = noiseTex.height = 256;
  {
    const nc = noiseTex.getContext('2d'), id = nc.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    nc.putImageData(id, 0, 0);
  }

  const mapCache = new Map();
  function remap(e, key, build) {
    let m = mapCache.get(key);
    if (!m) {
      m = new Int32Array(W * H);
      build(m);
      mapCache.set(key, m);
      if (mapCache.size > 24) mapCache.delete(mapCache.keys().next().value);
    }
    const img = e.c.getImageData(0, 0, W, H), s = img.data, out = e.c.createImageData(W, H), d = out.data;
    for (let i = 0; i < W * H; i++) {
      const j = m[i] * 4, o = i * 4;
      d[o] = s[j]; d[o + 1] = s[j + 1]; d[o + 2] = s[j + 2]; d[o + 3] = 255;
    }
    e.c.putImageData(out, 0, 0);
  }
  const clampI = (v, a, b) => (v < a ? a : v > b ? b : v);

  function black(c) { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); }

  const FAMILIES = [
    // ---------- distort ----------
    { key: 'kaleido', name: 'Kaleidoscope', cat: 'Distort',
      make: (r, k) => ({ n: 3 + Math.floor(r() * 10), spin: (r() - 0.5) * (0.2 + k * 2), zoom: 1 + r() * k * 1.5 }),
      run(e) {
        const { c, p, t } = e, a = Math.PI * 2 / p.n, R = Math.hypot(W, H);
        black(c);
        for (let i = 0; i < p.n; i++) {
          c.save(); c.translate(W / 2, H / 2); c.rotate(i * a + t * p.spin);
          if (i % 2) c.scale(1, -1);
          c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, -a / 2 - 0.01, a / 2 + 0.01); c.closePath(); c.clip();
          c.scale(p.zoom, p.zoom); c.drawImage(orig, -W / 2, -H / 2); c.restore();
        }
      } },
    { key: 'tile', name: 'Tile Repeat', cat: 'Distort',
      make: (r, k) => ({ g: 2 + Math.floor(r() * 5), sx: (r() - 0.5) * 120 * k, sy: (r() - 0.5) * 120 * k }),
      run(e) {
        const { c, p, t } = e, cw = W / p.g, ch = H / p.g;
        const ox = ((t * p.sx) % cw + cw) % cw, oy = ((t * p.sy) % ch + ch) % ch;
        for (let y = -1; y <= p.g; y++) for (let x = -1; x <= p.g; x++) c.drawImage(orig, x * cw + ox, y * ch + oy, cw, ch);
      } },
    { key: 'waveh', name: 'Ripple', cat: 'Distort',
      make: (r, k) => ({ amp: 4 + k * 70, f: 0.01 + r() * 0.08, sp: 1 + r() * 8 }),
      run(e) {
        const { c, p, t } = e; black(c);
        for (let y = 0; y < H; y += 3) c.drawImage(orig, 0, y, W, 3, Math.sin(y * p.f + t * p.sp) * p.amp, y, W, 3);
      } },
    { key: 'wavev', name: 'Melt', cat: 'Distort',
      make: (r, k) => ({ amp: 4 + k * 80, f: 0.01 + r() * 0.06, sp: 0.5 + r() * 5 }),
      run(e) {
        const { c, p, t } = e; black(c);
        for (let x = 0; x < W; x += 3) c.drawImage(orig, x, 0, 3, H, x, Math.max(0, Math.sin(x * p.f + t * p.sp)) * p.amp, 3, H);
      } },
    { key: 'haze', name: 'Heat Haze', cat: 'Distort',
      make: (r, k) => ({ amp: 1 + k * 10, sc: 0.02 + r() * 0.1, sp: 1 + r() * 4 }),
      run(e) {
        const { c, p, t } = e; black(c);
        for (let y = 0; y < H; y += 2) c.drawImage(orig, 0, y, W, 2, (HCNoise(y * p.sc, t * p.sp) - 0.5) * 2 * p.amp, y, W, 2);
      } },
    { key: 'bulge', name: 'Fisheye', cat: 'Distort',
      make: (r, k) => ({ s: (r() < 0.3 ? -1 : 1) * (0.2 + k * 1.3) }),
      run(e) {
        const s = e.p.s;
        remap(e, 'bulge' + s.toFixed(3), m => {
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const nx = (x - W / 2) / (W / 2), ny = (y - H / 2) / (H / 2), r = Math.hypot(nx, ny);
            const f = r > 0 ? Math.pow(r, 1 + s) / r : 1;
            const sx = clampI(Math.round(W / 2 + nx * f * W / 2), 0, W - 1), sy = clampI(Math.round(H / 2 + ny * f * H / 2), 0, H - 1);
            m[y * W + x] = sy * W + sx;
          }
        });
      } },
    { key: 'swirl', name: 'Vortex', cat: 'Distort',
      make: (r, k) => ({ a: (r() < 0.5 ? -1 : 1) * (1 + k * 9), rad: 0.4 + r() * 0.7 }),
      run(e) {
        const { a, rad } = e.p;
        remap(e, 'swirl' + a.toFixed(2) + rad.toFixed(2), m => {
          const R = rad * H;
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const dx = x - W / 2, dy = y - H / 2, r = Math.hypot(dx, dy);
            let sx = x, sy = y;
            if (r < R) { const th = a * (1 - r / R) ** 2, cs = Math.cos(th), sn = Math.sin(th); sx = W / 2 + dx * cs - dy * sn; sy = H / 2 + dx * sn + dy * cs; }
            m[y * W + x] = clampI(sy | 0, 0, H - 1) * W + clampI(sx | 0, 0, W - 1);
          }
        });
      } },
    { key: 'polar', name: 'Polar Void', cat: 'Distort',
      make: (r, k) => ({ rep: 1 + Math.floor(r() * 3 * (0.3 + k)), inv: r() < 0.5 }),
      run(e) {
        const { rep, inv } = e.p;
        remap(e, 'polar' + rep + inv, m => {
          const R = Math.hypot(W, H) / 2;
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const dx = x - W / 2, dy = y - H / 2;
            const ang = (Math.atan2(dy, dx) / (Math.PI * 2) + 0.5) * rep % 1;
            let rr = Math.hypot(dx, dy) / R; if (inv) rr = 1 - rr;
            m[y * W + x] = clampI((rr * H) | 0, 0, H - 1) * W + clampI((ang * W) | 0, 0, W - 1);
          }
        });
      } },
    { key: 'tunnel', name: 'Tunnel', cat: 'Distort',
      make: (r, k) => ({ n: 4 + Math.floor(k * 10), sc: 0.7 + r() * 0.2, spin: (r() - 0.5) * k }),
      run(e) {
        const { c, p, t } = e;
        for (let i = 1; i < p.n; i++) {
          const s = Math.pow(p.sc, i);
          c.save(); c.translate(W / 2, H / 2); c.rotate(i * p.spin * Math.sin(t)); c.globalAlpha = 0.9;
          c.drawImage(orig, -W * s / 2, -H * s / 2, W * s, H * s); c.restore();
        }
      } },
    { key: 'split', name: 'Splitting Seam', cat: 'Distort',
      make: (r, k) => ({ amp: 10 + k * 120, sp: 0.5 + r() * 4, v: r() < 0.4 }),
      run(e) {
        const { c, p, t } = e, o = Math.abs(Math.sin(t * p.sp)) * p.amp; black(c);
        if (p.v) { c.drawImage(orig, 0, 0, W, H / 2, 0, -o, W, H / 2); c.drawImage(orig, 0, H / 2, W, H / 2, 0, H / 2 + o, W, H / 2); }
        else { c.drawImage(orig, 0, 0, W / 2, H, -o, 0, W / 2, H); c.drawImage(orig, W / 2, 0, W / 2, H, W / 2 + o, 0, W / 2, H); }
      } },
    { key: 'shake', name: 'Earthquake', cat: 'Distort',
      make: (r, k) => ({ amp: 2 + k * 30, rot: r() * k * 0.08 }),
      run(e) {
        const { c, p } = e; black(c);
        c.save(); c.translate(W / 2 + (Math.random() - 0.5) * p.amp, H / 2 + (Math.random() - 0.5) * p.amp);
        c.rotate((Math.random() - 0.5) * p.rot); c.drawImage(orig, -W / 2, -H / 2); c.restore();
      } },

    // ---------- glitch ----------
    { key: 'shuffle', name: 'Block Shuffle', cat: 'Glitch',
      make: (r, k) => ({ n: 3 + Math.floor(k * 30), bs: 16 + Math.floor(r() * 80), hold: 1 + Math.floor(r() * 8) }),
      run(e) {
        const { c, p, state } = e;
        if (!state.blocks || --state.left <= 0) {
          state.left = p.hold;
          state.blocks = Array.from({ length: p.n }, () => [Math.random() * W, Math.random() * H, Math.random() * W, Math.random() * H]);
        }
        for (const [sx, sy, dx, dy] of state.blocks) c.drawImage(orig, sx, sy, p.bs, p.bs, dx, dy, p.bs, p.bs);
      } },
    { key: 'interlace', name: 'Torn Fields', cat: 'Glitch',
      make: (r, k) => ({ dx: 3 + k * 50, jit: r() < 0.5 }),
      run(e) {
        const { c, p } = e, dx = p.jit ? (Math.random() - 0.5) * 2 * p.dx : p.dx;
        for (let y = 0; y < H; y += 4) c.drawImage(orig, 0, y, W, 2, dx, y, W, 2);
      } },
    { key: 'flip', name: 'Flip Flicker', cat: 'Glitch',
      make: (r, k) => ({ ch: 0.02 + k * 0.25, mode: Math.floor(r() * 3) }),
      run(e) {
        const { c, p } = e;
        if (Math.random() > p.ch) return;
        c.save();
        if (p.mode === 0) c.setTransform(-1, 0, 0, 1, W, 0);
        else if (p.mode === 1) c.setTransform(1, 0, 0, -1, 0, H);
        else c.setTransform(-1, 0, 0, -1, W, H);
        c.drawImage(orig, 0, 0); c.restore();
      } },
    { key: 'patches', name: 'Static Patches', cat: 'Glitch',
      make: (r, k) => ({ n: 2 + Math.floor(k * 20), sz: 20 + r() * 140 }),
      run(e) {
        const { c, p } = e;
        for (let i = 0; i < p.n; i++) {
          const w = p.sz * (0.3 + Math.random()), h = p.sz * 0.3 * (0.3 + Math.random());
          c.drawImage(noiseTex, Math.random() * 128, Math.random() * 128, 128, 128, Math.random() * W, Math.random() * H, w, h);
        }
      } },
    { key: 'corrupt', name: 'Corrupt Text', cat: 'Glitch',
      make: (r, k) => ({ n: 3 + Math.floor(k * 40), col: pick(r, ['#ff2a1f', '#9dff8a', '#ffffff', '#00e0ff']), sz: 14 + Math.floor(r() * 30) }),
      run(e) {
        const { c, p } = e, ch = '█▓▒░#@$%&?!ΔΣЖЯ¥¤§ERRORNULLHELP0123456789';
        c.save(); c.font = `${p.sz}px VT323, monospace`; c.fillStyle = p.col;
        for (let i = 0; i < p.n; i++) {
          let s = ''; for (let j = 0, L = 3 + Math.random() * 12; j < L; j++) s += ch[(Math.random() * ch.length) | 0];
          c.fillText(s, Math.random() * W, Math.random() * H);
        }
        c.restore();
      } },
    { key: 'pixsort', name: 'Pixel Sort', cat: 'Glitch',
      make: (r, k) => ({ th: 40 + r() * 160, dark: r() < 0.4, max: 60 + Math.floor(k * 400) }),
      run(e) {
        const { c, p } = e, img = c.getImageData(0, 0, W, H), d = img.data, buf = [];
        for (let y = 0; y < H; y++) {
          let x = 0;
          while (x < W) {
            const i0 = (y * W + x) * 4, L = lum(d, i0);
            if (p.dark ? L < p.th : L > p.th) {
              let x2 = x; buf.length = 0;
              while (x2 < W && x2 - x < p.max) {
                const i = (y * W + x2) * 4, l2 = lum(d, i);
                if (!(p.dark ? l2 < p.th : l2 > p.th)) break;
                buf.push(l2 * 16777216 + (d[i] << 16) + (d[i + 1] << 8) + d[i + 2]); x2++;
              }
              buf.sort((a, b) => a - b);
              for (let j = 0; j < buf.length; j++) { const i = (y * W + x + j) * 4, v = buf[j] % 16777216; d[i] = v >> 16; d[i + 1] = (v >> 8) & 255; d[i + 2] = v & 255; }
              x = x2 + 1;
            } else x++;
          }
        }
        c.putImageData(img, 0, 0);
      } },
    { key: 'chanrot', name: 'Channel Rot', cat: 'Glitch',
      make: (r, k) => ({ perm: Math.floor(r() * 5), off: Math.floor(k * 30) }),
      run(e) {
        const { c, p } = e, img = c.getImageData(0, 0, W, H), d = img.data, s = d.slice();
        const P = [[1, 2, 0], [2, 0, 1], [0, 2, 1], [2, 1, 0], [1, 0, 2]][p.perm];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4, j = (y * W + Math.min(W - 1, x + p.off)) * 4;
          d[i] = s[i + P[0]]; d[i + 1] = s[j + P[1]]; d[i + 2] = s[i + P[2]];
        }
        c.putImageData(img, 0, 0);
      } },
    { key: 'negghost', name: 'Negative Ghost', cat: 'Glitch',
      make: (r, k) => ({ dx: (r() - 0.5) * 60 * (0.3 + k), dy: (r() - 0.5) * 30 * k, a: 0.4 + r() * 0.6 }),
      run(e) {
        const { c, p, t } = e;
        c.save(); c.globalCompositeOperation = 'difference'; c.globalAlpha = p.a;
        c.drawImage(orig, p.dx * (1 + Math.sin(t * 2) * 0.3), p.dy); c.restore();
      } },

    // ---------- color ----------
    { key: 'hue', name: 'Hue Drift', cat: 'Color',
      make: (r, k) => ({ sp: 10 + k * 400, sat: 100 + r() * 200 * k }),
      run(e) { const { c, p, t } = e; c.save(); c.filter = `hue-rotate(${t * p.sp}deg) saturate(${p.sat}%)`; c.drawImage(orig, 0, 0); c.restore(); } },
    { key: 'duotone', name: 'Duotone', cat: 'Color',
      make: r => ({ pair: pick(r, DUO), con: 1 + r() * 0.8 }),
      run(e) {
        const { c, p } = e;
        c.save(); c.filter = `grayscale(1) contrast(${p.con})`; c.drawImage(orig, 0, 0); c.filter = 'none';
        c.globalCompositeOperation = 'multiply'; c.fillStyle = p.pair[1]; c.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'lighten'; c.fillStyle = p.pair[0]; c.fillRect(0, 0, W, H); c.restore();
      } },
    { key: 'gradmap', name: 'Gradient Map', cat: 'Color',
      make: r => ({ pal: Math.floor(r() * PALETTES.length), rev: r() < 0.3 }),
      run(e) {
        const { c, p } = e, img = c.getImageData(0, 0, W, H), d = img.data;
        const pal = PALETTES[p.pal].map(hexRgb); if (p.rev) pal.reverse();
        const lut = new Uint8Array(768);
        for (let i = 0; i < 256; i++) {
          const f = i / 255 * (pal.length - 1), a = Math.floor(f), b = Math.min(pal.length - 1, a + 1), k = f - a;
          for (let j = 0; j < 3; j++) lut[i * 3 + j] = pal[a][j] + (pal[b][j] - pal[a][j]) * k;
        }
        for (let i = 0; i < d.length; i += 4) { const l = clampI(lum(d, i) | 0, 0, 255) * 3; d[i] = lut[l]; d[i + 1] = lut[l + 1]; d[i + 2] = lut[l + 2]; }
        c.putImageData(img, 0, 0);
      } },
    { key: 'solarize', name: 'Solarize', cat: 'Color',
      make: (r, k) => ({ th: 200 - k * 160 }),
      run(e) {
        const { c, p } = e, img = c.getImageData(0, 0, W, H), d = img.data;
        for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) if (d[i + j] > p.th) d[i + j] = 255 - d[i + j];
        c.putImageData(img, 0, 0);
      } },
    { key: 'strobe', name: 'Strobe', cat: 'Color',
      make: (r, k) => ({ hz: 1 + k * 14, col: pick(r, ['#ffffff', '#ff0000', '#000000', '#00ff40']), mode: r() < 0.5 ? 'difference' : 'source-over', a: 0.3 + r() * 0.7 }),
      run(e) {
        const { c, p, t } = e;
        if (Math.floor(t * p.hz * 2) % 2) return;
        c.save(); c.globalCompositeOperation = p.mode; c.globalAlpha = p.a; c.fillStyle = p.col; c.fillRect(0, 0, W, H); c.restore();
      } },

    // ---------- stylize ----------
    { key: 'edges', name: 'Edge Glow', cat: 'Stylize',
      make: (r, k) => ({ col: hexRgb(pick(r, ['#9dff8a', '#ff2a1f', '#ffffff', '#00e0ff', '#ffb000'])), gain: 1 + k * 4, keep: r() < 0.5 }),
      run(e) {
        const { c, p } = e, img = c.getImageData(0, 0, W, H), d = img.data, L = new Float32Array(W * H);
        for (let i = 0; i < W * H; i++) L[i] = lum(d, i * 4);
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          const gx = L[i - W + 1] + 2 * L[i + 1] + L[i + W + 1] - L[i - W - 1] - 2 * L[i - 1] - L[i + W - 1];
          const gy = L[i + W - 1] + 2 * L[i + W] + L[i + W + 1] - L[i - W - 1] - 2 * L[i - W] - L[i - W + 1];
          const m = Math.min(1, Math.hypot(gx, gy) / 400 * p.gain), o = i * 4;
          if (p.keep) { d[o] += p.col[0] * m; d[o + 1] += p.col[1] * m; d[o + 2] += p.col[2] * m; }
          else { d[o] = p.col[0] * m; d[o + 1] = p.col[1] * m; d[o + 2] = p.col[2] * m; }
        }
        c.putImageData(img, 0, 0);
      } },
    { key: 'emboss', name: 'Carved', cat: 'Stylize',
      make: (r, k) => ({ g: 1 + k * 4 }),
      run(e) {
        const { c, p } = e, img = c.getImageData(0, 0, W, H), d = img.data, s = d.slice();
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
          const i = (y * W + x) * 4, v = 128 + (lum(s, i + (W + 1) * 4) - lum(s, i - (W + 1) * 4)) * p.g;
          d[i] = d[i + 1] = d[i + 2] = v;
        }
        c.putImageData(img, 0, 0);
      } },
    { key: 'dither', name: '1-Bit Dither', cat: 'Stylize',
      make: (r, k) => ({ pair: pick(r, DUO).map(hexRgb), sc: 1 + Math.floor(k * 3) }),
      run(e) {
        const { c, p } = e, img = c.getImageData(0, 0, W, H), d = img.data;
        const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4, th = (B[((y / p.sc | 0) & 3) * 4 + ((x / p.sc | 0) & 3)] + 0.5) * 16;
          const col = lum(d, i) > th ? p.pair[1] : p.pair[0];
          d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2];
        }
        c.putImageData(img, 0, 0);
      } },
    { key: 'halftone', name: 'Halftone', cat: 'Stylize',
      make: (r, k) => ({ s: 5 + Math.floor((1 - k) * 4 + r() * 10), col: pick(r, ['#ffffff', '#ff2a1f', '#f0e0a0', '#9dff8a']) }),
      run(e) {
        const { c, p } = e, d = c.getImageData(0, 0, W, H).data;
        black(c); c.fillStyle = p.col;
        for (let y = p.s / 2; y < H; y += p.s) for (let x = p.s / 2; x < W; x += p.s) {
          const r = (lum(d, ((y | 0) * W + (x | 0)) * 4) / 255) * p.s * 0.7;
          if (r > 0.4) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
        }
      } },
    { key: 'ascii', name: 'Terminal ASCII', cat: 'Stylize',
      make: (r, k) => ({ s: 8 + Math.floor(r() * 8 + (1 - k) * 4), col: pick(r, ['#9dff8a', '#ffffff', '#ffb000', '#00e0ff', '#ff2a1f']) }),
      run(e) {
        const { c, p } = e, d = c.getImageData(0, 0, W, H).data, ramp = ' .:-=+*#%@';
        black(c); c.save(); c.font = `${p.s + 2}px VT323, monospace`; c.fillStyle = p.col; c.textBaseline = 'top';
        for (let y = 0; y < H; y += p.s) {
          let row = '';
          for (let x = 0; x < W; x += p.s * 0.6) row += ramp[Math.min(9, (lum(d, ((y | 0) * W + (x | 0)) * 4) / 25.6) | 0)];
          c.fillText(row, 0, y);
        }
        c.restore();
      } },

    // ---------- film ----------
    { key: 'burn', name: 'Film Burn', cat: 'Film',
      make: (r, k) => ({ n: 1 + Math.floor(k * 4), a: 0.3 + k * 0.7, sp: 0.2 + r() * 1.5, seed: r() * 100 }),
      run(e) {
        const { c, p, t } = e; c.save(); c.globalCompositeOperation = 'screen';
        for (let i = 0; i < p.n; i++) {
          const x = HCNoise(t * p.sp, i + p.seed) * W, y = HCNoise(i + p.seed, t * p.sp) * H, r = 80 + HCNoise(t + i) * 300;
          const g = c.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(255,240,200,${p.a})`); g.addColorStop(0.3, `rgba(255,120,20,${p.a * 0.7})`); g.addColorStop(1, 'rgba(120,0,0,0)');
          c.fillStyle = g; c.fillRect(0, 0, W, H);
        }
        c.restore();
      } },
    { key: 'leak', name: 'Light Leak', cat: 'Film',
      make: (r, k) => ({ col: pick(r, ['255,60,20', '255,180,40', '200,40,255', '40,160,255']), a: 0.2 + k * 0.6, sp: 0.1 + r() }),
      run(e) {
        const { c, p, t } = e, ang = t * p.sp;
        const g = c.createLinearGradient(W / 2 + Math.cos(ang) * W, H / 2 + Math.sin(ang) * H, W / 2, H / 2);
        g.addColorStop(0, `rgba(${p.col},${p.a})`); g.addColorStop(1, `rgba(${p.col},0)`);
        c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
      } },
    { key: 'scratch', name: 'Scratched Print', cat: 'Film',
      make: (r, k) => ({ lines: 1 + Math.floor(k * 8), dust: 5 + Math.floor(k * 80) }),
      run(e) {
        const { c, p } = e; c.save();
        for (let i = 0; i < p.lines; i++) {
          c.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.6)';
          c.lineWidth = 1 + Math.random() * 1.5; const x = Math.random() * W;
          c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (Math.random() - 0.5) * 10, H); c.stroke();
        }
        for (let i = 0; i < p.dust; i++) {
          c.fillStyle = Math.random() < 0.5 ? '#000' : '#fff';
          c.beginPath(); c.arc(Math.random() * W, Math.random() * H, Math.random() * 2.5, 0, Math.PI * 2); c.fill();
        }
        c.restore();
      } },

    // ---------- weather ----------
    { key: 'rain', name: 'Black Rain', cat: 'Weather',
      make: (r, k) => ({ n: 40 + Math.floor(k * 400), ang: (r() - 0.5) * 0.6, sp: 300 + r() * 900, col: pick(r, ['rgba(200,210,230,0.5)', 'rgba(0,0,0,0.6)', 'rgba(150,0,0,0.6)']) }),
      run(e) {
        const { c, p, t } = e, R = rng(7); c.save(); c.strokeStyle = p.col; c.lineWidth = 1;
        c.beginPath();
        for (let i = 0; i < p.n; i++) {
          const x = R() * W * 1.4 - W * 0.2, y = (R() * H + t * p.sp * (0.7 + R() * 0.6)) % (H + 40) - 20;
          c.moveTo(x + y * p.ang, y); c.lineTo(x + (y + 18) * p.ang, y + 18);
        }
        c.stroke(); c.restore();
      } },
    { key: 'ash', name: 'Ashfall', cat: 'Weather',
      make: (r, k) => ({ n: 30 + Math.floor(k * 300), col: pick(r, ['#dddddd', '#ff7a20', '#222222', '#ffffff']), sp: 10 + r() * 80, up: r() < 0.25 }),
      run(e) {
        const { c, p, t } = e, R = rng(11); c.save(); c.fillStyle = p.col;
        for (let i = 0; i < p.n; i++) {
          const sp = p.sp * (0.5 + R()), x0 = R() * W, y0 = R() * H;
          let y = (y0 + t * sp) % H; if (p.up) y = H - y;
          c.fillRect(x0 + Math.sin(t + i) * 8, y, 1 + R() * 2.5, 1 + R() * 2.5);
        }
        c.restore();
      } },
    { key: 'fog', name: 'Fog Bank', cat: 'Weather',
      make: (r, k) => ({ n: 3 + Math.floor(k * 8), a: 0.1 + k * 0.4, col: pick(r, ['220,220,220', '150,200,150', '120,120,140', '255,230,200']) }),
      run(e) {
        const { c, p, t } = e; c.save();
        for (let i = 0; i < p.n; i++) {
          const x = HCNoise(t * 0.1, i * 3.1) * W * 1.4 - W * 0.2, y = H * 0.3 + HCNoise(i * 1.7, t * 0.08) * H * 0.7, r = 150 + 200 * HCNoise(i, t * 0.05);
          const g = c.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(${p.col},${p.a})`); g.addColorStop(1, `rgba(${p.col},0)`);
          c.fillStyle = g; c.fillRect(0, 0, W, H);
        }
        c.restore();
      } },

    // ---------- horror ----------
    { key: 'blood', name: 'Bleeding Frame', cat: 'Horror',
      make: (r, k) => ({ n: 3 + Math.floor(k * 20), sp: 10 + r() * 60, w: 3 + r() * 8 }),
      run(e) {
        const { c, p, t } = e, R = rng(5); c.save(); c.fillStyle = '#6a0000'; c.strokeStyle = '#6a0000';
        c.fillRect(0, 0, W, 6);
        for (let i = 0; i < p.n; i++) {
          const x = R() * W, len = Math.min(H * (0.3 + R() * 0.8), t * p.sp * (0.3 + R())), w = p.w * (0.5 + R());
          c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, len); c.stroke();
          c.beginPath(); c.arc(x, len, w * 0.9, 0, Math.PI * 2); c.fill();
        }
        c.restore();
      } },
    { key: 'heart', name: 'Heartbeat', cat: 'Horror',
      make: (r, k) => ({ bpm: 50 + k * 120, a: 0.4 + k * 0.6, zoom: r() * 0.06 }),
      run(e) {
        const { c, p, t } = e, ph = (t * p.bpm / 60) % 1;
        const pulse = Math.max(Math.exp(-ph * 14), 0.6 * Math.exp(-Math.abs(ph - 0.22) * 14));
        const s = 1 + pulse * p.zoom; black(c);
        c.drawImage(orig, (W - W * s) / 2, (H - H * s) / 2, W * s, H * s);
        const g = c.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.8);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(40,0,0,${p.a * (0.5 + pulse * 0.5)})`);
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      } },
    { key: 'censor', name: 'Redacted', cat: 'Horror',
      make: (r, k) => ({ n: 1 + Math.floor(k * 8), rate: 1 + r() * 8, label: r() < 0.5 }),
      run(e) {
        const { c, p, t } = e, R = rng(Math.floor(t * p.rate) + 3); c.save();
        for (let i = 0; i < p.n; i++) {
          const x = R() * W * 0.8, y = R() * H * 0.9, w = 60 + R() * 220, h = 18 + R() * 40;
          c.fillStyle = '#000'; c.fillRect(x, y, w, h);
          if (p.label) { c.fillStyle = '#c00'; c.font = `${h * 0.8}px VT323, monospace`; c.textBaseline = 'top'; c.fillText('[REDACTED]', x + 6, y + h * 0.1, w - 12); }
        }
        c.restore();
      } },
    { key: 'spot', name: 'Flashlight', cat: 'Horror',
      make: (r, k) => ({ rad: 200 - k * 140, sp: 0.2 + r() * 0.8, flick: r() < 0.5 }),
      run(e) {
        const { c, p, t } = e;
        const x = HCNoise(t * p.sp, 1.3) * W, y = HCNoise(2.7, t * p.sp) * H;
        const r = p.rad * (p.flick && Math.random() < 0.06 ? 0.2 : 1);
        const g = c.createRadialGradient(x, y, r * 0.3, x, y, r);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.97)');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      } },
    { key: 'zoomecho', name: 'Zoom Echo', cat: 'Horror',
      make: (r, k) => ({ n: 2 + Math.floor(k * 6), step: 0.03 + r() * 0.1 }),
      run(e) {
        const { c, p } = e; c.save(); c.globalCompositeOperation = 'screen';
        for (let i = 1; i <= p.n; i++) { const s = 1 + i * p.step; c.globalAlpha = 0.5 / i; c.drawImage(orig, (W - W * s) / 2, (H - H * s) / 2, W * s, H * s); }
        c.restore();
      } },
    { key: 'spinecho', name: 'Spin Echo', cat: 'Horror',
      make: (r, k) => ({ n: 2 + Math.floor(k * 5), ang: 0.02 + r() * 0.2, sp: r() * 2 }),
      run(e) {
        const { c, p, t } = e; c.save(); c.globalCompositeOperation = 'lighten';
        for (let i = 1; i <= p.n; i++) {
          c.globalAlpha = 0.6 / i; c.setTransform(1, 0, 0, 1, W / 2, H / 2); c.rotate(i * p.ang * Math.sin(t * p.sp + i));
          c.drawImage(orig, -W / 2, -H / 2);
        }
        c.restore();
      } },

    // ---------- time ----------
    { key: 'slit', name: 'Slit Scan', cat: 'Time', history: true,
      make: (r, k) => ({ depth: 4 + Math.floor(k * 26), vert: r() < 0.4 }),
      run(e) {
        const { c, p } = e, img = c.getImageData(0, 0, W, H), d = img.data;
        for (let y = 0; y < H; y++) {
          if (p.vert) continue;
          const h = e.hist(Math.floor(y / H * p.depth)); if (!h) continue;
          d.set(h.subarray(y * W * 4, (y + 1) * W * 4), y * W * 4);
        }
        if (p.vert) for (let x = 0; x < W; x++) {
          const h = e.hist(Math.floor(x / W * p.depth)); if (!h) continue;
          for (let y = 0; y < H; y++) { const i = (y * W + x) * 4; d[i] = h[i]; d[i + 1] = h[i + 1]; d[i + 2] = h[i + 2]; }
        }
        c.putImageData(img, 0, 0);
      } },
    { key: 'stutter', name: 'Stutter', cat: 'Time',
      make: (r, k) => ({ every: 0.5 + r() * 3, hold: 0.1 + k * 0.8 }),
      run(e) {
        const { c, p, t, state } = e, ph = t % p.every;
        if (ph < p.hold) {
          if (!state.frame || state.cycle !== Math.floor(t / p.every)) { state.frame = c.getImageData(0, 0, W, H); state.cycle = Math.floor(t / p.every); }
          c.putImageData(state.frame, 0, 0);
        }
      } },
    { key: 'motion', name: 'Motion Reveal', cat: 'Time', history: true,
      make: (r, k) => ({ lag: 1 + Math.floor(r() * 6), gain: 2 + k * 10, col: hexRgb(pick(r, ['#ffffff', '#ff2a1f', '#9dff8a', '#00e0ff'])) }),
      run(e) {
        const { c, p } = e, h = e.hist(p.lag); if (!h) return;
        const img = c.getImageData(0, 0, W, H), d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const m = Math.min(1, Math.abs(lum(d, i) - lum(h, i)) * p.gain / 255);
          d[i] = p.col[0] * m; d[i + 1] = p.col[1] * m; d[i + 2] = p.col[2] * m;
        }
        c.putImageData(img, 0, 0);
      } },
    { key: 'rgbtime', name: 'Time Split', cat: 'Time', history: true,
      make: (r, k) => ({ lag: 1 + Math.floor(k * 10) }),
      run(e) {
        const { c, p } = e, g = e.hist(p.lag), b = e.hist(p.lag * 2); if (!g || !b) return;
        const img = c.getImageData(0, 0, W, H), d = img.data;
        for (let i = 0; i < d.length; i += 4) { d[i + 1] = g[i + 1]; d[i + 2] = b[i + 2]; }
        c.putImageData(img, 0, 0);
      } },
    { key: 'trails', name: 'Afterimage', cat: 'Time', history: true,
      make: (r, k) => ({ n: 2 + Math.floor(k * 6), step: 1 + Math.floor(r() * 3) }),
      run(e) {
        const { c, p } = e, img = c.getImageData(0, 0, W, H), d = img.data;
        for (let k = 1; k <= p.n; k++) {
          const h = e.hist(k * p.step); if (!h) break;
          const a = 0.5 / k;
          for (let i = 0; i < d.length; i += 4) { d[i] = Math.max(d[i], h[i] * a); d[i + 1] = Math.max(d[i + 1], h[i + 1] * a); d[i + 2] = Math.max(d[i + 2], h[i + 2] * a); }
        }
        c.putImageData(img, 0, 0);
      } },
  ];

  // ---------- library ----------
  const LIB = [], BY_ID = new Map();
  for (const fam of FAMILIES) {
    for (let i = 0; i < ADJ.length; i++) {
      const id = `${fam.key}-${i}`;
      const entry = { id, name: `${ADJ[i]} ${fam.name}`, cat: fam.cat, fam, i };
      LIB.push(entry);
      BY_ID.set(id, entry);
    }
  }
  function params(entry) {
    if (!entry.p) entry.p = entry.fam.make(rng(hashStr(entry.id)), entry.i / (ADJ.length - 1));
    return entry.p;
  }

  // ---------- history ring for time effects ----------
  const HIST = 32, ring = [];
  let head = 0;
  function capture(ctx) {
    const d = ctx.getImageData(0, 0, W, H).data;
    if (ring.length < HIST) ring.push(new Uint8ClampedArray(d));
    else ring[head].set(d);
    head = (ring.length < HIST ? ring.length : head + 1) % HIST;
  }
  function hist(n) {
    if (!ring.length) return null;
    n = Math.min(n, ring.length - 1);
    const idx = ((ring.length < HIST ? ring.length : head) - 1 - n + HIST * 2) % (ring.length < HIST ? ring.length : HIST);
    return ring[idx] || null;
  }

  const states = new Map();
  function apply(ctx, stack, t, T) {
    if (!stack || !stack.length) return;
    const active = stack.map(s => s.on !== false && BY_ID.get(s.id) ? [s, BY_ID.get(s.id)] : null).filter(Boolean);
    if (!active.length) return;
    if (active.some(([, e]) => e.fam.history)) capture(ctx);
    for (const [s, entry] of active) {
      const amt = (s.amt ?? 100) / 100;
      octx.drawImage(ctx.canvas, 0, 0);
      let st = states.get(s);
      if (!st) { st = {}; states.set(s, st); }
      ctx.save();
      try {
        entry.fam.run({ c: ctx, p: params(entry), t, T, state: st, hist });
      } catch (err) { /* one bad effect should never stop playback */ }
      ctx.restore();
      if (amt < 1) { ctx.save(); ctx.globalAlpha = 1 - amt; ctx.drawImage(orig, 0, 0); ctx.restore(); }
    }
  }

  const CATS = [...new Set(FAMILIES.map(f => f.cat))];
  return { LIB, BY_ID, CATS, FAMILIES, apply, count: LIB.length };
})();

// Analog horror inspiration: well-known works, what they do well, and where to find them.
const INSPIRATION = [
  { name: 'Local 58', by: 'Kris Straub', year: 2015, tags: 'emergency broadcast, TV station', learn: 'Broadcast interruptions, calm public-service voices saying terrible things, color bars as dread.' },
  { name: 'Gemini Home Entertainment', by: 'Remy Abode', year: 2019, tags: 'VHS, educational tapes', learn: 'Educational-video framing, slowly escalating "warnings", cosmic scale.' },
  { name: 'The Mandela Catalogue', by: 'Alex Kister', year: 2021, tags: 'doppelgängers, faces', learn: 'Distorted faces, fast cuts, jumpscare pacing, the "something wearing a person" idea.' },
  { name: 'The Walten Files', by: 'Martin Walls', year: 2020, tags: 'animatronics, 3D, archives', learn: 'Low-poly 3D, archival documents, a mystery told through found files.' },
  { name: 'The Backrooms (found footage)', by: 'Kane Parsons', year: 2022, tags: 'liminal space, camcorder', learn: 'Camcorder realism, empty liminal spaces, tracking a creature you only half see.' },
  { name: 'The Monument Mythos', by: 'Alex Casanas', year: 2020, tags: 'documentary, government', learn: 'Mock-documentary narration, maps and archival photos, alternate history.' },
  { name: 'Unedited Footage of a Bear', by: 'Alan Resnick', year: 2014, tags: 'TV ad, doppelgänger', learn: 'Starts as a boring commercial and goes wrong. Shows how far restraint can go.' },
  { name: 'Marble Hornets', by: 'Troy Wagner', year: 2009, tags: 'found footage, tall figure', learn: 'The tall faceless figure, audio distortion when it appears, unreliable footage.' },
  { name: 'Petscop', by: 'Tony Domenico', year: 2017, tags: 'video game, ARG', learn: 'Horror hidden inside a video game playthrough, an ARG that viewers piece together.' },
  { name: 'Candle Cove', by: 'Kris Straub', year: 2009, tags: "children's TV, memory", learn: "A half-remembered children's show. Good for puppet and kids' TV horror." },
  { name: 'Too Many Cooks', by: 'Casper Kelly', year: 2014, tags: 'sitcom intro, loop', learn: 'A familiar format looping until it breaks. Great for intro and title-card ideas.' },
  { name: 'Analog horror (search)', by: 'YouTube', year: '', tags: 'everything', learn: 'Browse the whole genre.' },
];
