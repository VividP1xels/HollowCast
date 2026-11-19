'use strict';
/* HOLLOWCAST audio: a procedural horror SFX generator, per-scene sound layers with voice FX,
   and microphone recording. Everything is synthesized with the Web Audio API. */

const HCAudio = (() => {
  const SR = 44100;
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---------- building blocks ----------
  function noise(c, secs) {
    const b = c.createBuffer(1, Math.max(1, Math.ceil(secs * SR)), SR), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b; return s;
  }
  const osc = (c, type, f) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; return o; };
  const gain = (c, v = 0) => { const g = c.createGain(); g.gain.value = v; return g; };
  const filt = (c, type, f, q = 1) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  function shaper(c, k) {
    const w = c.createWaveShaper(), n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    w.curve = curve; return w;
  }
  function hit(g, t, a, d, peak = 1) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + Math.max(0.002, a));
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function walk(r, n, lo, hi, step = 0.2) {
    const out = new Float32Array(n);
    let v = lo + r() * (hi - lo);
    for (let i = 0; i < n; i++) { v += (r() - 0.5) * (hi - lo) * step; v = Math.min(hi, Math.max(lo, v)); out[i] = v; }
    return out;
  }

  // Each generator gets an OfflineAudioContext, an output node, a seeded random, pitch and length.
  const GENS = {
    static: { name: 'Static burst', cat: 'Signal', len: 1.2, gen(c, out, r, p, L) {
      const n = noise(c, L), g = gain(c), hp = filt(c, 'highpass', 400 * p);
      n.connect(hp).connect(g).connect(out); hit(g, 0, 0.005, L, 0.8); n.start(); } },
    powerdown: { name: 'TV power down', cat: 'Signal', len: 1.5, gen(c, out, r, p, L) {
      const o = osc(c, 'sine', 15000 * p), g = gain(c, 0.3);
      o.frequency.exponentialRampToValueAtTime(30, L); g.gain.exponentialRampToValueAtTime(0.0001, L);
      o.connect(g).connect(out); o.start();
      const n = noise(c, 0.04), ng = gain(c, 0.7); n.connect(ng).connect(out); n.start(); } },
    rewind: { name: 'VHS rewind', cat: 'Signal', len: 2, gen(c, out, r, p, L) {
      const n = noise(c, L), bp = filt(c, 'bandpass', 2000 * p, 3), g = gain(c, 0.4);
      bp.frequency.setValueCurveAtTime(walk(r, 64, 800 * p, 6000 * p, 0.5), 0, L);
      n.connect(bp).connect(g).connect(out); n.start();
      const o = osc(c, 'sawtooth', 300 * p), og = gain(c, 0.08);
      o.frequency.setValueCurveAtTime(walk(r, 32, 200 * p, 1600 * p, 0.6), 0, L);
      o.connect(og).connect(out); o.start(); } },
    radio: { name: 'Radio tuning', cat: 'Signal', len: 3, gen(c, out, r, p, L) {
      const n = noise(c, L), bp = filt(c, 'bandpass', 1500, 0.7), g = gain(c, 0.35);
      g.gain.setValueCurveAtTime(walk(r, 40, 0.05, 0.5, 0.8), 0, L);
      n.connect(bp).connect(g).connect(out); n.start();
      const o = osc(c, 'sine', 900 * p), og = gain(c, 0.12);
      o.frequency.setValueCurveAtTime(walk(r, 40, 300 * p, 3000 * p, 0.5), 0, L);
      o.connect(og).connect(out); o.start(); } },
    numbers: { name: 'Number station', cat: 'Signal', len: 4, gen(c, out, r, p, L) {
      let t = 0.1;
      while (t < L - 0.3) {
        const o = osc(c, 'sine', (r() < 0.3 ? 1400 : 1000) * p), g = gain(c);
        o.connect(g).connect(out); hit(g, t, 0.005, 0.12, 0.35); o.start(t); o.stop(t + 0.2);
        t += r() < 0.25 ? 0.6 : 0.2;
      } } },
    alert: { name: 'Alert tone', cat: 'Signal', len: 3, gen(c, out, r, p, L) {
      for (let t = 0, i = 0; t < L; t += 0.3, i++) {
        const o = osc(c, 'square', (i % 2 ? 1100 : 700) * p), g = gain(c), lp = filt(c, 'lowpass', 3000);
        o.connect(lp).connect(g).connect(out); hit(g, t, 0.01, 0.25, 0.18); o.start(t); o.stop(t + 0.3);
      } } },
    hum: { name: 'Mains hum', cat: 'Signal', len: 4, gen(c, out, r, p, L) {
      const o = osc(c, 'sawtooth', 60 * p), lp = filt(c, 'lowpass', 300), g = gain(c, 0.3);
      g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.3, 0.3); g.gain.setValueAtTime(0.3, L - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, L);
      o.connect(lp).connect(g).connect(out); o.start(); } },
    chirps: { name: 'Glitch chirps', cat: 'Signal', len: 1.5, gen(c, out, r, p, L) {
      for (let t = 0; t < L; t += 0.02 + r() * 0.08) {
        const o = osc(c, 'square', (200 + r() * 3000) * p), g = gain(c);
        o.connect(g).connect(out); hit(g, t, 0.002, 0.03, 0.15); o.start(t); o.stop(t + 0.05);
      } } },

    drone: { name: 'Dread drone', cat: 'Ambience', len: 8, gen(c, out, r, p, L) {
      const lp = filt(c, 'lowpass', 220), g = gain(c);
      g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.4, 1.5); g.gain.setValueAtTime(0.4, L - 1.5); g.gain.exponentialRampToValueAtTime(0.0001, L);
      lp.frequency.setValueCurveAtTime(walk(r, 32, 120, 500, 0.3), 0, L);
      lp.connect(g).connect(out);
      [1, 1.012 + r() * 0.01, 1.5, 0.5].forEach(m => { const o = osc(c, 'sawtooth', 41 * p * m); o.connect(lp); o.start(); }); } },
    wind: { name: 'Wind howl', cat: 'Ambience', len: 6, gen(c, out, r, p, L) {
      const n = noise(c, L), bp = filt(c, 'bandpass', 500 * p, 9), g = gain(c, 0.6);
      bp.frequency.setValueCurveAtTime(walk(r, 48, 250 * p, 1000 * p, 0.25), 0, L);
      g.gain.setValueCurveAtTime(walk(r, 24, 0.1, 0.9, 0.4), 0, L);
      n.connect(bp).connect(g).connect(out); n.start(); } },
    tinnitus: { name: 'Ear ringing', cat: 'Ambience', len: 5, gen(c, out, r, p, L) {
      const o = osc(c, 'sine', 9000 * p), g = gain(c);
      g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.15, L * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, L);
      o.connect(g).connect(out); o.start(); } },
    clock: { name: 'Clock ticking', cat: 'Ambience', len: 6, gen(c, out, r, p, L) {
      for (let t = 0.05, i = 0; t < L; t += 1, i++) {
        const n = noise(c, 0.03), hp = filt(c, 'bandpass', (i % 2 ? 2500 : 3200) * p, 5), g = gain(c);
        n.connect(hp).connect(g).connect(out); hit(g, t, 0.001, 0.03, 0.9); n.start(t);
      } } },
    musicbox: { name: 'Broken music box', cat: 'Ambience', len: 8, gen(c, out, r, p, L) {
      const scale = [0, 3, 5, 7, 8, 10, 12, 15];
      for (let t = 0.1; t < L - 0.5; t += 0.35 + r() * 0.3) {
        const f = 523 * p * Math.pow(2, scale[(r() * scale.length) | 0] / 12) * (1 + (r() - 0.5) * 0.03);
        const o = osc(c, 'triangle', f), g = gain(c);
        o.connect(g).connect(out); hit(g, t, 0.003, 1.2, 0.2); o.start(t); o.stop(t + 1.4);
      } } },
    siren: { name: 'Distant siren', cat: 'Ambience', len: 6, gen(c, out, r, p, L) {
      const o = osc(c, 'sine', 700 * p), lfo = osc(c, 'sine', 0.3 + r() * 0.3), lg = gain(c, 300 * p), g = gain(c, 0.15), lp = filt(c, 'lowpass', 1500);
      lfo.connect(lg).connect(o.frequency); o.connect(lp).connect(g).connect(out); o.start(); lfo.start(); } },
    phone: { name: 'Old phone ringing', cat: 'Ambience', len: 6, gen(c, out, r, p, L) {
      for (let t = 0; t < L; t += 6) {
        [440, 480].forEach(f => {
          const o = osc(c, 'sine', f * p), am = osc(c, 'square', 20), ag = gain(c, 0.5), g = gain(c, 0);
          am.connect(ag).connect(g.gain); o.connect(g).connect(out);
          g.gain.setValueAtTime(0.12, t); g.gain.setValueAtTime(0, t + 2);
          o.start(t); am.start(t); o.stop(t + 2); am.stop(t + 2);
        });
      } } },

    heartbeat: { name: 'Heartbeat', cat: 'Body', len: 5, gen(c, out, r, p, L) {
      const beat = 60 / (55 + r() * 60);
      for (let t = 0.05; t < L; t += beat) for (const [dt, v] of [[0, 1], [0.22, 0.7]]) {
        const o = osc(c, 'sine', 70 * p), g = gain(c);
        o.frequency.setValueAtTime(70 * p, t + dt); o.frequency.exponentialRampToValueAtTime(35 * p, t + dt + 0.12);
        o.connect(g).connect(out); hit(g, t + dt, 0.005, 0.18, v); o.start(t + dt); o.stop(t + dt + 0.3);
      } } },
    breathing: { name: 'Heavy breathing', cat: 'Body', len: 6, gen(c, out, r, p, L) {
      const n = noise(c, L), lp = filt(c, 'lowpass', 900 * p, 1), g = gain(c, 0);
      for (let t = 0; t < L; t += 2.8 + r()) {
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35, t + 1.1); g.gain.linearRampToValueAtTime(0.02, t + 1.3);
        g.gain.linearRampToValueAtTime(0.45, t + 1.6); g.gain.linearRampToValueAtTime(0.0001, t + 2.7);
      }
      n.connect(lp).connect(g).connect(out); n.start(); } },
    whisper: { name: 'Whispers', cat: 'Body', len: 4, gen(c, out, r, p, L) {
      const n = noise(c, L), bp = filt(c, 'bandpass', 2500 * p, 4), bp2 = filt(c, 'bandpass', 1200 * p, 6), g = gain(c, 0);
      bp.frequency.setValueCurveAtTime(walk(r, 80, 1500 * p, 5000 * p, 0.9), 0, L);
      for (let t = 0; t < L - 0.3; t += 0.12 + r() * 0.2) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 * r() + 0.2, t + 0.04); g.gain.linearRampToValueAtTime(0, t + 0.11); }
      n.connect(bp).connect(g); n.connect(bp2).connect(g); g.connect(out); n.start(); } },
    scream: { name: 'Synthetic scream', cat: 'Body', len: 2.2, gen(c, out, r, p, L) {
      const o = osc(c, 'sawtooth', 320 * p), vib = osc(c, 'sine', 6 + r() * 4), vg = gain(c, 30 * p), g = gain(c), ws = shaper(c, 8);
      o.frequency.setValueAtTime(300 * p, 0); o.frequency.exponentialRampToValueAtTime((700 + r() * 400) * p, 0.4); o.frequency.exponentialRampToValueAtTime(400 * p, L);
      vib.connect(vg).connect(o.frequency);
      const f1 = filt(c, 'bandpass', 900, 5), f2 = filt(c, 'bandpass', 1400, 6), f3 = filt(c, 'bandpass', 2800, 8);
      [f1, f2, f3].forEach(f => { o.connect(f); f.connect(ws); });
      const n = noise(c, L), nb = filt(c, 'bandpass', 3000, 2), ng = gain(c, 0.3); n.connect(nb).connect(ng).connect(ws);
      ws.connect(g).connect(out); hit(g, 0, 0.05, L - 0.05, 0.6); o.start(); vib.start(); n.start(); } },
    footsteps: { name: 'Footsteps', cat: 'Body', len: 5, gen(c, out, r, p, L) {
      for (let t = 0.1; t < L; t += 0.45 + r() * 0.25) {
        const n = noise(c, 0.1), lp = filt(c, 'lowpass', 500 * p), g = gain(c);
        n.connect(lp).connect(g).connect(out); hit(g, t, 0.003, 0.09, 0.9); n.start(t);
        const o = osc(c, 'sine', 90 * p), og = gain(c); o.connect(og).connect(out); hit(og, t, 0.002, 0.08, 0.5); o.start(t); o.stop(t + 0.15);
      } } },

    creak: { name: 'Door creak', cat: 'Objects', len: 2.5, gen(c, out, r, p, L) {
      const o = osc(c, 'sawtooth', 100 * p), bp = filt(c, 'bandpass', 900 * p, 3), g = gain(c);
      o.frequency.setValueCurveAtTime(walk(r, 120, 60 * p, 220 * p, 0.35), 0, L);
      g.gain.setValueCurveAtTime(walk(r, 60, 0, 0.5, 0.5), 0, L);
      o.connect(bp).connect(g).connect(out); o.start(); } },
    bell: { name: 'Distorted bell', cat: 'Objects', len: 5, gen(c, out, r, p, L) {
      const ws = shaper(c, 3), g = gain(c, 0.5); ws.connect(g).connect(out);
      [1, 2.76, 5.4, 8.93].forEach((m, i) => { const o = osc(c, 'sine', 220 * p * m * (1 + (r() - 0.5) * 0.01)), og = gain(c); o.connect(og).connect(ws); hit(og, 0, 0.002, L / (i + 1), 0.4 / (i + 1)); o.start(); }); } },
    scrape: { name: 'Metal scrape', cat: 'Objects', len: 2.5, gen(c, out, r, p, L) {
      const n = noise(c, L), bp = filt(c, 'bandpass', 3000 * p, 25), g = gain(c, 1.2);
      bp.frequency.setValueCurveAtTime(walk(r, 60, 1500 * p, 7000 * p, 0.3), 0, L);
      g.gain.setValueCurveAtTime(walk(r, 40, 0.3, 1.6, 0.6), 0, L);
      n.connect(bp).connect(g).connect(out); n.start(); } },
    impact: { name: 'Impact thud', cat: 'Objects', len: 1.5, gen(c, out, r, p, L) {
      const o = osc(c, 'sine', 120 * p), g = gain(c), ws = shaper(c, 4);
      o.frequency.exponentialRampToValueAtTime(30 * p, 0.4); o.connect(ws).connect(g).connect(out); hit(g, 0, 0.003, L * 0.8, 1); o.start();
      const n = noise(c, 0.3), lp = filt(c, 'lowpass', 800), ng = gain(c); n.connect(lp).connect(ng).connect(out); hit(ng, 0, 0.002, 0.25, 0.8); n.start(); } },

    stinger: { name: 'Jump scare stinger', cat: 'Stingers', len: 2, gen(c, out, r, p, L) {
      const g = gain(c), ws = shaper(c, 6); ws.connect(g).connect(out); hit(g, 0, 0.004, L, 0.9);
      [1, 1.06, 1.5, 2.12].forEach(m => { const o = osc(c, 'sawtooth', 110 * p * m); o.connect(ws); o.start(); });
      const n = noise(c, L); n.connect(ws); n.start();
      const b = osc(c, 'sine', 60 * p); b.frequency.exponentialRampToValueAtTime(25, 1); b.connect(g); b.start(); } },
    swell: { name: 'Reverse swell', cat: 'Stingers', len: 3, gen(c, out, r, p, L) {
      const n = noise(c, L), hp = filt(c, 'highpass', 200), g = gain(c);
      hp.frequency.exponentialRampToValueAtTime(4000, L);
      g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.7, L - 0.01); g.gain.setValueAtTime(0, L);
      n.connect(hp).connect(g).connect(out); n.start();
      [1, 1.19, 1.5].forEach(m => { const o = osc(c, 'sawtooth', 220 * p * m), og = gain(c); og.gain.setValueAtTime(0.0001, 0); og.gain.exponentialRampToValueAtTime(0.12, L - 0.01); og.gain.setValueAtTime(0, L); o.connect(og).connect(out); o.start(); }); } },
    riser: { name: 'Tension riser', cat: 'Stingers', len: 5, gen(c, out, r, p, L) {
      const o = osc(c, 'sawtooth', 80 * p), lp = filt(c, 'lowpass', 300), g = gain(c);
      o.frequency.exponentialRampToValueAtTime(800 * p, L); lp.frequency.exponentialRampToValueAtTime(6000, L);
      g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.35, L - 0.05); g.gain.setValueAtTime(0, L);
      o.connect(lp).connect(g).connect(out); o.start(); } },
  };
  const CATS = [...new Set(Object.values(GENS).map(g => g.cat))];

  const cache = new Map();
  function renderSfx(key, seed = 1, pitch = 1, len) {
    const g = GENS[key];
    if (!g) return Promise.reject(new Error('unknown sound ' + key));
    const L = Math.max(0.2, len || g.len);
    const ck = [key, seed, pitch, L].join('|');
    if (cache.has(ck)) return cache.get(ck);
    const c = new OfflineAudioContext(1, Math.ceil(L * SR), SR);
    const comp = c.createDynamicsCompressor();
    comp.connect(c.destination);
    g.gen(c, comp, rng(seed * 7919 + 13), pitch, L);
    const pr = c.startRendering();
    cache.set(ck, pr);
    if (cache.size > 80) cache.delete(cache.keys().next().value);
    return pr;
  }

  function decode(arrayBuffer) {
    return new OfflineAudioContext(1, 1, SR).decodeAudioData(arrayBuffer);
  }

  const revCache = new WeakMap();
  function reversed(buf) {
    if (revCache.has(buf)) return revCache.get(buf);
    const c = new OfflineAudioContext(buf.numberOfChannels, buf.length, buf.sampleRate).createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) { const s = buf.getChannelData(ch), d = c.getChannelData(ch); for (let i = 0; i < s.length; i++) d[i] = s[s.length - 1 - i]; }
    revCache.set(buf, c);
    return c;
  }

  // ---------- voice / sound FX ----------
  const FX = ['none', 'radio', 'telephone', 'tape', 'underwater', 'cave', 'distort', 'bitcrush', 'demon', 'chipmunk', 'ghost'];
  const FX_RATE = { demon: 0.62, chipmunk: 1.7 };
  let impulse = null;
  function chain(ac, fx, input) {
    const f = (type, fr, q = 1) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = fr; b.Q.value = q; return b; };
    switch (fx) {
      case 'radio': return input.connect(f('bandpass', 1800, 1.2)).connect(shaper(ac, 25));
      case 'telephone': return input.connect(f('highpass', 400)).connect(f('lowpass', 3000)).connect(shaper(ac, 5));
      case 'tape': return input.connect(f('lowpass', 4500)).connect(shaper(ac, 1.5));
      case 'underwater': return input.connect(f('lowpass', 450, 3));
      case 'distort': return input.connect(shaper(ac, 120));
      case 'bitcrush': {
        const w = ac.createWaveShaper(), n = 1024, cv = new Float32Array(n);
        for (let i = 0; i < n; i++) cv[i] = Math.round(((i / (n - 1)) * 2 - 1) * 6) / 6;
        w.curve = cv; return input.connect(w);
      }
      case 'cave': case 'ghost': {
        if (!impulse || impulse.sampleRate !== ac.sampleRate) {
          impulse = ac.createBuffer(2, ac.sampleRate * 3.5, ac.sampleRate);
          for (let ch = 0; ch < 2; ch++) { const d = impulse.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
        }
        const cv = ac.createConvolver(); cv.buffer = impulse;
        const mix = ac.createGain();
        if (fx === 'ghost') { input.connect(f('highpass', 700)).connect(cv); } else { input.connect(mix); input.connect(cv); }
        cv.connect(mix);
        return mix;
      }
      default: return input;
    }
  }

  // ---------- sound layers ----------
  function newSound(src) {
    return { id: 's' + Math.random().toString(36).slice(2, 9), src, at: 0, vol: 100, rate: 1, reverse: false, loop: false, fx: 'none', fadeIn: 0, fadeOut: 0 };
  }
  const SOUND_SCHEMA = [
    ['Timing', [['at', 'Starts at (s)', 'range', 0, 60, 0.05], ['loop', 'Loop until scene ends', 'check'], ['fadeIn', 'Fade in (s)', 'range', 0, 5, 0.05], ['fadeOut', 'Fade out (s)', 'range', 0, 5, 0.05]]],
    ['Sound', [['vol', 'Volume', 'range', 0, 200, 1], ['rate', 'Speed / pitch', 'range', 0.25, 3, 0.01], ['reverse', 'Reverse', 'check'], ['fx', 'Voice FX', 'select', FX]]],
  ];

  const buffers = new Map(); // src -> AudioBuffer | Promise
  function bufferFor(src, media) {
    if (buffers.has(src)) { const b = buffers.get(src); return b instanceof AudioBuffer ? b : null; }
    let pr = null;
    if (src.startsWith('sfx:')) { const [, key, seed, pitch, len] = src.split(':'); pr = renderSfx(key, +seed, +pitch, +len || undefined); }
    else if (src.startsWith('m:')) { const m = media.get(src.slice(2)); if (m && m.kind === 'audio') return m.buffer; return null; }
    if (pr) { buffers.set(src, pr); pr.then(b => buffers.set(src, b)).catch(() => buffers.delete(src)); }
    return null;
  }

  const active = new Map();
  function stopAll() {
    for (const a of active.values()) { try { a.node && a.node.stop(); } catch (e) { /* already stopped */ } }
    active.clear();
  }

  // Called every frame with the active scene's sounds.
  function tick(ac, dest, sounds, t, playing, sceneDur, media) {
    if (!ac || !playing) { if (active.size) stopAll(); return; }
    for (const s of sounds || []) {
      if (active.has(s.id)) continue;
      if (t < s.at) continue;
      const buf0 = bufferFor(s.src, media);
      if (!buf0) continue;
      const buf = s.reverse ? reversed(buf0) : buf0;
      const rate = s.rate * (FX_RATE[s.fx] || 1);
      const dur = buf.duration / rate;
      const into = t - s.at;
      if (!s.loop && into >= dur) { active.set(s.id, { node: null }); continue; }
      const src = ac.createBufferSource();
      src.buffer = buf; src.playbackRate.value = rate; src.loop = !!s.loop;
      const g = ac.createGain(), now = ac.currentTime, v = s.vol / 100;
      if (s.fadeIn > 0 && into < s.fadeIn) { g.gain.setValueAtTime(v * (into / s.fadeIn), now); g.gain.linearRampToValueAtTime(v, now + (s.fadeIn - into)); }
      else g.gain.value = v;
      const endIn = (s.loop ? sceneDur - s.at : dur) - into;
      if (s.fadeOut > 0 && endIn > 0) {
        const at = now + Math.max(0, endIn - s.fadeOut);
        g.gain.setValueAtTime(v, at); g.gain.linearRampToValueAtTime(0.0001, now + endIn);
      }
      chain(ac, s.fx, src).connect(g).connect(dest);
      src.start(now, (into * rate) % buf.duration);
      if (s.loop) src.stop(now + Math.max(0.05, endIn));
      active.set(s.id, { node: src });
    }
  }

  // Preview a sound right away (in the editor).
  let previewNode = null;
  async function preview(ac, dest, s, media) {
    if (previewNode) { try { previewNode.stop(); } catch (e) { /* ignore */ } previewNode = null; }
    let buf = bufferFor(s.src, media);
    if (!buf && buffers.get(s.src)) buf = await buffers.get(s.src);
    if (!buf) return;
    if (s.reverse) buf = reversed(buf);
    const src = ac.createBufferSource();
    src.buffer = buf; src.playbackRate.value = s.rate * (FX_RATE[s.fx] || 1);
    const g = ac.createGain(); g.gain.value = s.vol / 100;
    chain(ac, s.fx, src).connect(g).connect(dest);
    src.start();
    previewNode = src;
  }

  // ---------- microphone ----------
  let micRec = null;
  async function toggleMic() {
    if (micRec) { micRec.stop(); return null; }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    micRec = new MediaRecorder(stream);
    micRec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const done = new Promise(res => { micRec.onstop = () => { stream.getTracks().forEach(t => t.stop()); micRec = null; res(new Blob(chunks, { type: chunks[0] ? chunks[0].type : 'audio/webm' })); }; });
    micRec.start();
    return done;
  }
  const recording = () => !!micRec;

  return { GENS, CATS, FX, renderSfx, decode, newSound, SOUND_SCHEMA, tick, stopAll, preview, toggleMic, recording, bufferFor };
})();
