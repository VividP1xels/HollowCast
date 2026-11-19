'use strict';
/* HOLLOWCAST: tiny dependency-free 3D renderer, noise and the scripting runtime. */

const HC3D = (() => {
  const mesh = (v, f) => ({ v, f });

  function merge(...ms) {
    const v = [], f = [];
    for (const m of ms) {
      const o = v.length;
      v.push(...m.v.map(p => p.slice()));
      f.push(...m.f.map(face => face.map(i => i + o)));
    }
    return mesh(v, f);
  }

  function box(cx = 0, cy = 0, cz = 0, sx = 1, sy = 1, sz = 1) {
    const v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
      .map(([x, y, z]) => [cx + x * sx, cy + y * sy, cz + z * sz]);
    const f = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]];
    return mesh(v, f);
  }
  const cube = () => box();

  function sphere(seg = 16, rings = 12) {
    const v = [], f = [];
    for (let i = 0; i <= rings; i++) {
      const th = (i / rings) * Math.PI;
      for (let j = 0; j < seg; j++) {
        const ph = (j / seg) * Math.PI * 2;
        v.push([Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]);
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < seg; j++) {
        const a = i * seg + j, b = i * seg + (j + 1) % seg;
        f.push([a, b, b + seg, a + seg]);
      }
    }
    return mesh(v, f);
  }

  function torus(R = 1, r = 0.4, seg = 24, side = 12) {
    const v = [], f = [];
    for (let i = 0; i < seg; i++) {
      const u = (i / seg) * Math.PI * 2;
      for (let j = 0; j < side; j++) {
        const w = (j / side) * Math.PI * 2;
        v.push([(R + r * Math.cos(w)) * Math.cos(u), r * Math.sin(w), (R + r * Math.cos(w)) * Math.sin(u)]);
      }
    }
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < side; j++) {
        const a = i * side + j, b = ((i + 1) % seg) * side + j;
        const c = ((i + 1) % seg) * side + (j + 1) % side, d = i * side + (j + 1) % side;
        f.push([a, b, c, d]);
      }
    }
    return mesh(v, f);
  }

  function pyramid() {
    return mesh([[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1], [0, -1, 0]],
      [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]]);
  }

  function plane(n = 10) {
    const v = [], f = [];
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) v.push([(j / n) * 2 - 1, 0, (i / n) * 2 - 1]);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const a = i * (n + 1) + j;
      f.push([a, a + 1, a + n + 2, a + n + 1]);
    }
    return mesh(v, f);
  }

  // A tall, thin humanoid built from boxes. y is down, so the head has the lowest y.
  function figure() {
    return merge(
      box(0, -1.55, 0, 0.17, 0.22, 0.17),   // head
      box(0, -1.25, 0, 0.06, 0.08, 0.06),   // neck
      box(0, -0.75, 0, 0.26, 0.45, 0.12),   // torso
      box(-0.36, -0.55, 0, 0.06, 0.62, 0.06), // arms, too long
      box(0.36, -0.55, 0, 0.06, 0.62, 0.06),
      box(-0.12, 0.35, 0, 0.08, 0.65, 0.08), // legs
      box(0.12, 0.35, 0, 0.08, 0.65, 0.08),
    );
  }

  function parseOBJ(text) {
    const v = [], f = [];
    for (const line of text.split('\n')) {
      const p = line.trim().split(/\s+/);
      if (p[0] === 'v') v.push([+p[1], -(+p[2]), +p[3]]);
      else if (p[0] === 'f') {
        const idx = p.slice(1).map(s => {
          const i = parseInt(s.split('/')[0], 10);
          return i < 0 ? v.length + i : i - 1;
        }).filter(i => i >= 0);
        if (idx.length >= 3) f.push(idx);
      }
    }
    if (!v.length) throw new Error('no vertices found');
    // Center the model and scale it to fit a unit cube.
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const p of v) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
    const c = min.map((m, k) => (m + max[k]) / 2);
    const s = 2 / Math.max(...max.map((m, k) => m - min[k]), 1e-6);
    for (const p of v) for (let k = 0; k < 3; k++) p[k] = (p[k] - c[k]) * s;
    return mesh(v, f);
  }

  const colorCache = new Map();
  function rgb(c) {
    if (Array.isArray(c)) return c;
    if (colorCache.has(c)) return colorCache.get(c);
    let s = String(c).replace('#', '');
    if (s.length === 3) s = s.split('').map(x => x + x).join('');
    const n = parseInt(s, 16);
    const out = isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [220, 220, 220];
    colorCache.set(c, out);
    return out;
  }

  // Painter's-algorithm renderer with flat shading. Good enough for creepy low-poly.
  function render(ctx, m, o = {}) {
    if (!m || !m.v) return;
    const Wc = ctx.canvas.width, Hc = ctx.canvas.height;
    const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cam = 4, fov = 1.2, wire = false,
      stroke = null, alpha = 1, fog = 0, lineWidth = 1 } = o;
    const sc = Array.isArray(o.scale) ? o.scale : [o.scale ?? 1, o.scale ?? 1, o.scale ?? 1];
    const cx = o.cx ?? Wc / 2, cy = o.cy ?? Hc / 2, size = o.size ?? Hc / 2;
    const col = rgb(o.color ?? '#d8d8d8');
    let L = o.light || [0.4, -0.6, -0.7];
    const ll = Math.hypot(...L) || 1;
    L = L.map(q => q / ll);

    const cX = Math.cos(rx), sX = Math.sin(rx), cY = Math.cos(ry), sY = Math.sin(ry), cZ = Math.cos(rz), sZ = Math.sin(rz);
    const P = new Array(m.v.length), S = new Array(m.v.length);
    for (let i = 0; i < m.v.length; i++) {
      let [a, b, c] = m.v[i];
      a *= sc[0]; b *= sc[1]; c *= sc[2];
      let t1 = b * cX - c * sX; c = b * sX + c * cX; b = t1;
      t1 = a * cY + c * sY; c = -a * sY + c * cY; a = t1;
      t1 = a * cZ - b * sZ; b = a * sZ + b * cZ; a = t1;
      a += x; b += y; c += z + cam;
      P[i] = [a, b, c];
      S[i] = c > 0.05 ? [cx + (a / c) * fov * size, cy + (b / c) * fov * size] : null;
    }
    const faces = [];
    for (const face of m.f) {
      let zs = 0, ok = true;
      for (const i of face) { if (!S[i]) { ok = false; break; } zs += P[i][2]; }
      if (!ok) continue;
      const A = P[face[0]], B = P[face[1]], C = P[face[2]];
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
      const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      const zAvg = zs / face.length;
      let shade = 0.22 + 0.78 * Math.abs(nx * L[0] + ny * L[1] + nz * L[2]);
      if (fog) shade /= 1 + fog * Math.max(0, zAvg - 1);
      faces.push([zAvg, face, shade]);
    }
    faces.sort((p, q) => q[0] - p[0]);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    for (const [, face, shade] of faces) {
      ctx.beginPath();
      face.forEach((i, k) => (k ? ctx.lineTo(S[i][0], S[i][1]) : ctx.moveTo(S[i][0], S[i][1])));
      ctx.closePath();
      if (!wire) {
        ctx.fillStyle = `rgb(${col[0] * shade | 0},${col[1] * shade | 0},${col[2] * shade | 0})`;
        ctx.fill();
      }
      if (wire || stroke) {
        ctx.strokeStyle = stroke || `rgb(${col[0]},${col[1]},${col[2]})`;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  return { mesh, merge, box, cube, sphere, torus, pyramid, plane, figure, parseOBJ, render };
})();

// Smooth value noise in up to three dimensions, output 0..1.
const HCNoise = (() => {
  function hash(x, y, z) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const sm = t => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  return function noise(x, y = 0, z = 0) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const u = sm(x - xi), v = sm(y - yi), w = sm(z - zi);
    const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
    return lerp(
      lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
      lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
      w,
    );
  };
})();

const HCScript = (() => {
  const cache = new Map();
  function compile(code) {
    if (cache.has(code)) return cache.get(code);
    let r;
    try {
      // Function bodies are non-strict, so `with` lets scripts use the API names directly.
      r = { fn: new Function('api', 'with (api) {\n' + code + '\n}') };
    } catch (e) {
      r = { err: e };
    }
    cache.set(code, r);
    if (cache.size > 40) cache.delete(cache.keys().next().value);
    return r;
  }
  return { compile };
})();

const SCRIPT_EXAMPLES = {
  'Spinning cube': `// A wireframe cube that turns forever.
render3d(cube(), {
  ry: t * 0.8, rx: t * 0.3,
  scale: 1.1, wire: true, stroke: '#ffffff', lineWidth: 2
});`,

  'The figure approaches': `// A dim hallway. A tall figure steps closer every 3 seconds.
ctx.fillStyle = '#3a3f46';
ctx.fillRect(0, 0, W, H);
render3d(plane(14), { y: 1, z: 4, scale: [3, 1, 9], wire: true, stroke: '#8a94a0', lineWidth: 2 });
const step = Math.floor(t / 3);
const z = Math.max(0.4, 7 - step * 1.3);
render3d(figure(), {
  z, ry: Math.sin(t * 0.4) * 0.15,
  color: '#0a0a0a', light: [0, 0, -1]
});
if (every(3)) { glitch(); burst(0.4, 0.3); }`,

  'Watching eyes': `// Eyes open in the dark and blink at random.
ctx.fillStyle = 'rgba(0,0,0,0.9)';
ctx.fillRect(0, 0, W, H);
state.eyes ||= Array.from({ length: 8 }, () => ({
  x: 60 + rand() * (W - 120), y: 60 + rand() * (H - 160), s: 4 + rand() * 9, p: rand() * 50
}));
for (const e of state.eyes) {
  if (noise(t * 0.8 + e.p) < 0.5) continue;
  ctx.fillStyle = '#f4f4e8';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(e.x + side * e.s * 2.4, e.y, e.s, e.s * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}`,

  'Hypnotic spiral': `// Generative spiral. Change the numbers.
ctx.save();
ctx.translate(W / 2, H / 2);
for (let i = 0; i < 260; i++) {
  const a = i * 0.21 + t * 1.5;
  const r = i * 1.1;
  ctx.fillStyle = i % 2 ? '#fff' : '#900';
  ctx.fillRect(Math.cos(a) * r, Math.sin(a) * r, 5, 5);
}
ctx.restore();`,

  'Falling ash': `// Particle system: ash falling in front of the footage.
state.p ||= Array.from({ length: 160 }, () => ({ x: rand() * W, y: rand() * H, v: 0.5 + rand() * 1.5 }));
ctx.fillStyle = '#ddd';
for (const p of state.p) {
  p.y += p.v; p.x += (noise(p.y * 0.01, p.v) - 0.5) * 2;
  if (p.y > H) { p.y = -5; p.x = rand() * W; }
  ctx.fillRect(p.x, p.y, 2, 2);
}`,

  'Image flicker': `// Flash an image from your media bin. Use its exact file name.
const name = 'face.png';
if (rand() < 0.06) {
  drawImage(name, rand() * W * 0.4, rand() * H * 0.4, W * 0.6, H * 0.6, { alpha: 0.85 });
  burst(0.3, 0.15);
}`,

  'Film countdown': `// Classic film leader countdown.
const n = 10 - Math.floor(t);
ctx.fillStyle = '#8a8a8a'; ctx.fillRect(0, 0, W, H);
ctx.fillStyle = '#5c5c5c';
ctx.beginPath(); ctx.moveTo(W / 2, H / 2);
ctx.arc(W / 2, H / 2, 400, -Math.PI / 2, -Math.PI / 2 + (t % 1) * Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '#eee'; ctx.lineWidth = 4;
for (const r of [150, 175]) { ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2); ctx.stroke(); }
text(n > 0 ? String(n) : '', W / 2, H / 2, { size: 220, color: '#111', align: 'center' });`,

  'Glitch on the beat': `// Spike the static and glitch every 2 seconds.
const k = Math.max(0, 1 - (t % 2) * 3);
set('noise', 20 + 70 * k);
set('chroma', 2 + 10 * k);
if (every(2)) glitch();`,

  'Clean HUD (after damage)': `// after() draws on top of the finished, damaged frame.
after(c => {
  c.font = '26px VT323, monospace';
  c.fillStyle = '#7dff6a';
  c.fillText('SIGNAL ' + Math.round(noise(t) * 100) + '%', 30, 44);
  c.fillText('SUBJECT 7  //  ' + frame, 30, 72);
});`,

  'Your 3D model': `// Add a .obj file to the media bin, then use its name here.
const m = model('model.obj') || sphere();
render3d(m, { ry: t * 0.6, rx: 0.2, color: '#b0b0b0', scale: 1.1 });`,
};

const SCRIPT_HELP = `Scripts run every frame, before the tape damage is applied.
ctx         2D canvas context (W × H)
t / T       scene time / global time in seconds;  frame, dt
state       object that persists while the scene plays
rand() noise(x,y,z) lerp clamp map
text(str, x, y, {size, color, align})
image(name)  drawImage(name, x, y, w, h, {alpha})
cube() sphere() torus() pyramid() plane() figure() box(...) model('x.obj')
render3d(mesh, {x,y,z, rx,ry,rz, scale, color, wire, stroke, light, fog, cam})
glitch()  flash()  burst(level, secs)  every(seconds)
set('noise', 80)   override any effect for this frame
after(c => ...)    draw on top after the damage`;
