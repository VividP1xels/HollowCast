'use strict';
/* HOLLOWCAST character creator: procedural 3D humans, monsters and creatures.
   A character is a list of sliders. Every frame it is rebuilt as a posed low-poly mesh,
   rendered with HC3D, and given glowing eyes and a mouth in 2D. */

const HCChar = (() => {
  const BASE = {
    name: 'Character', type: 'human', anim: 'idle', speed: 1, x: 0, z: 3, y: 0, face: 0, scale: 1, flicker: 0,
    height: 1.75, build: 1, headSize: 1, headStretch: 1, neck: 0.3, hunch: 0, arms: 2, armLen: 1, legs: 2, legLen: 1,
    eyes: 2, eyeSize: 1, eyeColor: '#111111', glow: false, mouth: 0, teeth: false, horns: 0, hornLen: 0.4,
    skin: '#c9a68a', fog: 0.15, pose: 'stand',
  };

  const TYPES = {
    human: {},
    'tall man': { height: 2.9, build: 0.55, headSize: 0.8, headStretch: 1.15, neck: 0.8, armLen: 1.7, legLen: 1.2, hunch: 0.1, eyes: 0, skin: '#121212', anim: 'sway', speed: 0.5 },
    faceless: { eyes: 0, mouth: 0, skin: '#e6e1d8', anim: 'stare', headStretch: 1.1 },
    smiler: { height: 2.1, build: 0.75, headStretch: 1.35, eyes: 2, eyeColor: '#ffffff', glow: true, mouth: 1, teeth: true, skin: '#efe9df', hunch: 0.2, anim: 'approach', speed: 0.6 },
    monster: { height: 2.4, build: 1.7, headSize: 1.25, neck: 0.1, armLen: 1.45, arms: 4, hunch: 0.55, eyes: 5, eyeColor: '#ff2a1f', glow: true, mouth: 0.8, teeth: true, horns: 2, hornLen: 0.7, skin: '#3a4a30', anim: 'twitch' },
    crawler: { height: 1.7, build: 0.65, armLen: 1.35, eyes: 2, eyeColor: '#ffffff', glow: true, mouth: 0.6, teeth: true, skin: '#d9d4c9', pose: 'crawl', anim: 'approach', speed: 1.2 },
    spider: { height: 1.2, build: 1.1, headSize: 0.9, arms: 0, legs: 8, legLen: 1.2, eyes: 8, eyeSize: 0.7, eyeColor: '#ff2a1f', glow: true, skin: '#1a1a1a', pose: 'spider', anim: 'walk' },
    child: { height: 1.15, build: 0.8, headSize: 1.35, eyes: 2, eyeColor: '#000000', skin: '#e0c8b0', anim: 'stare' },
    puppet: { height: 1.6, build: 0.7, headSize: 1.4, headStretch: 0.9, eyes: 2, eyeSize: 1.8, eyeColor: '#ffffff', mouth: 0.5, skin: '#c04a2a', anim: 'twitch', speed: 0.7 },
    wendigo: { height: 3.1, build: 0.5, headSize: 0.9, headStretch: 1.5, neck: 1.1, armLen: 2.2, hunch: 0.35, eyes: 2, eyeColor: '#ffffff', glow: true, eyeSize: 0.7, mouth: 0.7, teeth: true, horns: 4, hornLen: 1.1, skin: '#d8d0c0', anim: 'sway', speed: 0.4 },
    'many-armed': { height: 2, build: 0.9, arms: 8, armLen: 1.2, eyes: 3, eyeColor: '#ffd000', glow: true, skin: '#5a4a5a', anim: 'twitch' },
  };

  const SCHEMA = [
    ['Placement', [
      ['anim', 'Animation', 'select', ['idle', 'sway', 'walk', 'approach', 'twitch', 'stare', 'head spin', 'float', 'reach']],
      ['speed', 'Speed', 'range', 0, 4, 0.05], ['x', 'Left / right', 'range', -4, 4, 0.05], ['z', 'Distance', 'range', 0.3, 20, 0.1],
      ['y', 'Raise / lower', 'range', -3, 2, 0.05], ['face', 'Facing (°)', 'range', -180, 180, 1], ['scale', 'Scale', 'range', 0.2, 4, 0.05],
      ['flicker', 'Flicker in/out', 'range', 0, 100, 1], ['fog', 'Darkness falloff', 'range', 0, 2, 0.05],
    ]],
    ['Body', [
      ['pose', 'Pose', 'select', ['stand', 'crawl', 'spider']],
      ['height', 'Height', 'range', 0.5, 5, 0.05], ['build', 'Build', 'range', 0.25, 3, 0.05], ['hunch', 'Hunch', 'range', 0, 1, 0.05],
      ['arms', 'Arms', 'range', 0, 10, 1], ['armLen', 'Arm length', 'range', 0.3, 3.5, 0.05],
      ['legs', 'Legs', 'range', 0, 10, 1], ['legLen', 'Leg length', 'range', 0.3, 2.5, 0.05], ['skin', 'Skin', 'color'],
    ]],
    ['Head', [
      ['headSize', 'Head size', 'range', 0.3, 3.5, 0.05], ['headStretch', 'Head stretch', 'range', 0.4, 3, 0.05], ['neck', 'Neck', 'range', 0, 3, 0.05],
      ['eyes', 'Eyes', 'range', 0, 16, 1], ['eyeSize', 'Eye size', 'range', 0.2, 5, 0.05], ['eyeColor', 'Eye color', 'color'], ['glow', 'Glowing eyes', 'check'],
      ['mouth', 'Mouth', 'range', 0, 1, 0.05], ['teeth', 'Teeth', 'check'], ['horns', 'Horns', 'range', 0, 8, 1], ['hornLen', 'Horn length', 'range', 0.1, 3, 0.05],
    ]],
  ];

  function create(type = 'human', over = {}) {
    return { ...BASE, ...(TYPES[type] || {}), type, name: type[0].toUpperCase() + type.slice(1), id: 'c' + Math.random().toString(36).slice(2, 9), ...over };
  }

  // A random creature: start from a type, then push every slider somewhere strange.
  function randomMonster() {
    const r = Math.random, types = Object.keys(TYPES);
    const c = create(types[(r() * types.length) | 0]);
    Object.assign(c, {
      name: ['Thing', 'Visitor', 'Tenant', 'Neighbor', 'Watcher', 'Guest', 'Host', 'Other'][(r() * 8) | 0],
      height: 0.8 + r() * 3, build: 0.3 + r() * 2, hunch: r(), arms: (r() * 7) | 0, armLen: 0.5 + r() * 2.5,
      legs: [0, 2, 2, 2, 4, 6, 8][(r() * 7) | 0], headSize: 0.5 + r() * 2, headStretch: 0.6 + r() * 1.8, neck: r() * 2,
      eyes: (r() * 12) | 0, eyeSize: 0.4 + r() * 2, glow: r() < 0.6, mouth: r() < 0.5 ? r() : 0, teeth: r() < 0.6,
      horns: r() < 0.4 ? (r() * 6) | 0 : 0, hornLen: 0.2 + r() * 1.5,
      eyeColor: ['#ff2a1f', '#ffffff', '#ffd000', '#9dff8a', '#000000'][(r() * 5) | 0],
      skin: ['#1a1a1a', '#e6e1d8', '#3a4a30', '#5a3a3a', '#c9a68a', '#2a2a40', '#8a8070'][(r() * 7) | 0],
      anim: ['idle', 'sway', 'walk', 'approach', 'twitch', 'stare', 'head spin', 'float', 'reach'][(r() * 9) | 0],
    });
    if (c.legs > 2) c.pose = 'spider';
    return c;
  }

  // ---------- geometry helpers ----------
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp3 = (a, b, k) => add(a, mul(sub(b, a), k));

  // A tapered box from a to b: arms, legs, horns, torso.
  function limb(a, b, w0, w1 = w0) {
    const d = norm(sub(b, a));
    const ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = norm(cross(d, ref)), v = norm(cross(d, u));
    const corner = (p, w, su, sv) => add(p, add(mul(u, w * su), mul(v, w * sv)));
    const vs = [corner(a, w0, -1, -1), corner(a, w0, 1, -1), corner(a, w0, 1, 1), corner(a, w0, -1, 1),
      corner(b, w1, -1, -1), corner(b, w1, 1, -1), corner(b, w1, 1, 1), corner(b, w1, -1, 1)];
    return { v: vs, f: [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]] };
  }

  let sphereCache = null;
  function ellipsoid(c, rx, ry, rz) {
    if (!sphereCache) sphereCache = HC3D.sphere(12, 9);
    return { v: sphereCache.v.map(p => [c[0] + p[0] * rx, c[1] + p[1] * ry, c[2] + p[2] * rz]), f: sphereCache.f };
  }

  const hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

  // ---------- build a posed character in local space (feet at y=0, y is down, front is -z) ----------
  function build(s, t) {
    const parts = [], Hh = s.height, sp = s.speed;
    const L = Hh * 0.46 * s.legLen, T = Hh * 0.3, tw = Hh * 0.1 * s.build;
    const hr = Hh * 0.07 * s.headSize, hs = s.headStretch;
    const ph = t * sp * 5;
    const walking = s.anim === 'walk' || s.anim === 'approach';
    const breath = Math.sin(t * 1.6) * 0.01 * Hh;
    let twitch = [0, 0, 0];
    if (s.anim === 'twitch') {
      const k = Math.floor(t * 9 * Math.max(0.2, sp));
      if (hash(k) > 0.7) twitch = [(hash(k + 1) - 0.5) * 0.3, (hash(k + 2) - 0.5) * 0.2, (hash(k + 3) - 0.5) * 0.3];
    }

    let hip, shoulder;
    if (s.pose === 'crawl') {
      hip = [0, -L * 0.5, 0.2 * Hh];
      shoulder = [0, -L * 0.55, 0.2 * Hh - T * 1.2];
    } else if (s.pose === 'spider') {
      hip = [0, -L * 0.55, T * 0.35];
      shoulder = [0, -L * 0.6, -T * 0.35];
    } else {
      hip = [0, -L + breath * 0.3, 0];
      const sway = s.anim === 'sway' ? Math.sin(t * sp * 1.3) * 0.12 * T : 0;
      shoulder = [sway, -L - T + breath, -s.hunch * T * 0.8];
    }
    shoulder = add(shoulder, mul(twitch, T * 0.4));
    parts.push(limb(hip, shoulder, tw * 0.85, tw * 1.1));

    // Neck and head.
    const up = s.pose === 'stand' ? norm(add(sub(shoulder, hip), [0, 0, -s.hunch * 0.6])) : norm([0, -0.6, -1]);
    const neckLen = Hh * 0.03 + Hh * 0.08 * s.neck;
    const neckTop = add(shoulder, mul(up, neckLen));
    parts.push(limb(shoulder, neckTop, tw * 0.28, tw * 0.25));
    let headC = add(neckTop, mul(up, hr * hs * 0.9));
    if (s.anim === 'float') headC = add(headC, [0, Math.sin(t * 2) * 0.02, 0]);
    headC = add(headC, mul(twitch, hr));
    parts.push(ellipsoid(headC, hr, hr * hs, hr * 0.95));

    // Head orientation for eyes and mouth.
    let yaw = 0, roll = 0;
    if (s.anim === 'head spin') yaw = t * sp * 2.5;
    if (s.anim === 'stare') roll = Math.sin(t * 0.3) * 0.25;
    if (s.anim === 'twitch') roll = twitch[0] * 3;
    const orient = p => {
      let [x, y, z] = p;
      const cr = Math.cos(roll), sr = Math.sin(roll);
      [x, y] = [x * cr - y * sr, x * sr + y * cr];
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      return add(headC, [x, y, z]);
    };

    const eyes = [];
    const n = s.eyes | 0;
    for (let i = 0; i < n; i++) {
      let ex, ey;
      if (n <= 2) { ex = n === 1 ? 0 : (i ? 0.38 : -0.38); ey = -0.12; }
      else { const a = (i / n) * Math.PI * 2 + hash(i + 9); const rr = 0.25 + hash(i + 3) * 0.45; ex = Math.cos(a) * rr; ey = Math.sin(a) * rr * 0.7 - 0.15; }
      const ez = -Math.sqrt(Math.max(0.05, 1 - ex * ex - ey * ey));
      const local = [ex * hr, ey * hr * hs, ez * hr * 0.95];
      eyes.push({ p: orient(local), dir: norm(sub(orient(local), headC)), r: hr * 0.13 * s.eyeSize });
    }
    let mouth = null;
    if (s.mouth > 0.02) {
      const local = [0, hr * hs * 0.45, -hr * 0.85];
      mouth = { p: orient(local), dir: norm(sub(orient(local), headC)), w: hr * (0.35 + s.mouth * 0.4), h: hr * s.mouth * 0.7 };
    }

    // Horns from the top of the head.
    for (let i = 0; i < (s.horns | 0); i++) {
      const side = (s.horns === 1 ? 0 : (i / (s.horns - 1)) * 2 - 1);
      const base = orient([side * hr * 0.6, -hr * hs * 0.75, 0]);
      const tip = add(base, mul(norm([side * 0.7, -1, 0.15 + hash(i) * 0.3]), Hh * 0.18 * s.hornLen));
      parts.push(limb(base, tip, hr * 0.12, hr * 0.01));
    }

    // Arms.
    const aw = Hh * 0.025 * Math.max(0.5, s.build), seg = Hh * 0.19 * s.armLen;
    const armCount = s.arms | 0;
    for (let i = 0; i < armCount; i++) {
      const side = i % 2 ? 1 : -1, pair = Math.floor(i / 2), pairs = Math.ceil(armCount / 2);
      const at = add(lerp3(shoulder, hip, pairs > 1 ? pair / pairs * 0.7 : 0), [side * tw * 1.15, 0, 0]);
      let elbow, hand;
      if (s.pose === 'crawl' || s.pose === 'spider') {
        elbow = add(at, [side * seg * 0.6, -seg * 0.3, -seg * 0.5]);
        hand = [at[0] + side * seg * 0.9, 0, at[2] - seg * 1.1];
        if (walking) hand = add(hand, [0, 0, Math.sin(ph + i * 1.7) * seg * 0.35]);
      } else if (s.anim === 'reach' || (s.anim === 'approach' && s.mouth > 0.5)) {
        elbow = add(at, [side * 0.03, seg * 0.15, -seg]);
        hand = add(elbow, [side * 0.02 * Math.sin(t * 3 + i), seg * 0.1, -seg]);
      } else {
        const swing = walking ? Math.sin(ph + (side > 0 ? Math.PI : 0) + pair) * 0.5 : Math.sin(t * 1.1 + i) * 0.05;
        const spread = 0.08 + pair * 0.25;
        elbow = add(at, [side * seg * spread, seg * Math.cos(swing), -seg * Math.sin(swing)]);
        hand = add(elbow, [side * seg * spread * 0.5, seg * Math.cos(swing * 1.3), -seg * Math.sin(swing * 1.3) - seg * 0.1]);
      }
      if (s.anim === 'twitch' && hash(Math.floor(t * 7) + i * 13) > 0.85) hand = add(hand, [side * seg * 0.6, -seg * 0.8, 0]);
      parts.push(limb(at, elbow, aw, aw * 0.85), limb(elbow, hand, aw * 0.85, aw * 0.6));
      parts.push(ellipsoid(hand, aw * 1.3, aw * 1.6, aw * 1.3));
    }

    // Legs.
    const lw = Hh * 0.035 * Math.max(0.5, s.build);
    const legCount = s.legs | 0;
    for (let i = 0; i < legCount; i++) {
      const side = i % 2 ? 1 : -1;
      if (s.pose === 'spider' || legCount > 2) {
        const pairs = Math.ceil(legCount / 2), pr = Math.floor(i / 2);
        const at = add(lerp3(shoulder, hip, pairs > 1 ? pr / (pairs - 1) : 0.5), [side * tw * 0.8, 0, 0]);
        const lift = walking ? Math.max(0, Math.sin(ph + i * 1.3 + (side > 0 ? 1.5 : 0))) * L * 0.25 : 0;
        const fan = (pr - (pairs - 1) / 2) * L * 0.55;
        const knee = add(at, [side * L * 0.55, -L * 0.45 - lift, fan * 0.6]);
        const foot = [at[0] + side * L * 1.05, -lift * 0.3, at[2] + fan];
        parts.push(limb(at, knee, lw, lw * 0.8), limb(knee, foot, lw * 0.8, lw * 0.3));
      } else if (s.pose === 'crawl') {
        const at = add(hip, [side * tw * 0.5, 0, 0]);
        const knee = [at[0], -lw, at[2] + L * 0.25];
        const foot = [at[0], -lw * 0.5, at[2] + L * 0.85 + (walking ? Math.sin(ph + side) * L * 0.1 : 0)];
        parts.push(limb(at, knee, lw, lw), limb(knee, foot, lw, lw * 0.7));
      } else {
        const at = add(hip, [side * tw * 0.5, 0, 0]);
        const swing = walking ? Math.sin(ph + (side > 0 ? 0 : Math.PI)) * 0.45 : 0;
        const knee = add(at, [0, L * 0.5 * Math.cos(swing), -L * 0.5 * Math.sin(swing)]);
        const bend = walking ? Math.max(0, -Math.sin(ph + (side > 0 ? 0 : Math.PI))) * 0.6 : 0.02;
        const foot = add(knee, [0, L * 0.5 * Math.cos(swing - bend), -L * 0.5 * Math.sin(swing - bend)]);
        parts.push(limb(at, knee, lw, lw * 0.85), limb(knee, foot, lw * 0.85, lw * 0.6));
      }
    }

    return { mesh: HC3D.merge(...parts), eyes, mouth };
  }

  // ---------- render into the frame ----------
  const CAM = 0, FOV = 1.2;
  function render(ctx, s, t) {
    if (s.flicker > 0 && HCNoise(t * 3, s.x * 7 + s.z) < s.flicker / 130) return;
    const W = ctx.canvas.width, H = ctx.canvas.height, size = H / 2;
    const { mesh, eyes, mouth } = build(s, t);

    let z = s.z, y = s.y;
    if (s.anim === 'approach') z = Math.max(0.35, s.z - t * s.speed * 0.6);
    if (s.anim === 'float') y = s.y - 0.4 - Math.sin(t * s.speed * 1.5) * 0.12;

    const yaw = (s.face * Math.PI) / 180, cy = Math.cos(yaw), sy = Math.sin(yaw), sc = s.scale;
    const world = p => {
      const x0 = p[0] * sc, y0 = p[1] * sc, z0 = p[2] * sc;
      return [x0 * cy + z0 * sy + s.x, y0 + 1 + y, -x0 * sy + z0 * cy + z];
    };
    mesh.v = mesh.v.map(world);
    HC3D.render(ctx, mesh, { color: s.skin, light: [0.35, -0.55, -0.75], fog: s.fog, cam: CAM, fov: FOV });

    const project = p => {
      const c = p[2] + CAM;
      return c > 0.05 ? [W / 2 + (p[0] / c) * FOV * size, H / 2 + (p[1] / c) * FOV * size, c] : null;
    };
    const facing = dir => (-dir[0] * sy + dir[2] * cy) < 0.15; // pointing toward the camera
    ctx.save();
    for (const e of eyes) {
      if (!facing(e.dir)) continue;
      const q = project(world(e.p)); if (!q) continue;
      const r = Math.max(1, (e.r * sc / q[2]) * FOV * size);
      if (s.glow) { ctx.shadowColor = s.eyeColor; ctx.shadowBlur = r * 4; }
      ctx.fillStyle = s.eyeColor;
      ctx.beginPath(); ctx.ellipse(q[0], q[1], r, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    if (mouth && facing(mouth.dir)) {
      const q = project(world(mouth.p));
      if (q) {
        const mw = (mouth.w * sc / q[2]) * FOV * size, mh = Math.max(1, (mouth.h * sc / q[2]) * FOV * size);
        ctx.fillStyle = '#050000';
        ctx.beginPath(); ctx.ellipse(q[0], q[1], mw, mh, 0, 0, Math.PI * 2); ctx.fill();
        if (s.teeth) {
          ctx.fillStyle = '#efe8d8';
          const n = 8, tw = (mw * 2) / n;
          for (let i = 0; i < n; i++) {
            const x = q[0] - mw + i * tw;
            ctx.beginPath(); ctx.moveTo(x, q[1] - mh * 0.85); ctx.lineTo(x + tw, q[1] - mh * 0.85); ctx.lineTo(x + tw / 2, q[1] - mh * 0.2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(x, q[1] + mh * 0.85); ctx.lineTo(x + tw, q[1] + mh * 0.85); ctx.lineTo(x + tw / 2, q[1] + mh * 0.2); ctx.fill();
          }
        }
      }
    }
    ctx.restore();
  }

  return { BASE, TYPES, SCHEMA, create, randomMonster, render, build };
})();
