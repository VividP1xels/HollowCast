'use strict';
/* HOLLOWCAST layers: 3D model import (OBJ, STL, GLB/glTF, PLY), model layers and image layers. */

const HCLayers = (() => {
  const uid = p => p + Math.random().toString(36).slice(2, 9);

  // ---------- model importers ----------
  function normalize(m) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const p of m.v) for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
    const c = min.map((v, k) => (v + max[k]) / 2);
    const s = 2 / Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 1e-6);
    m.v = m.v.map(p => [(p[0] - c[0]) * s, (p[1] - c[1]) * s, (p[2] - c[2]) * s]);
    return m;
  }

  // The renderer sorts faces every frame, so very dense models are thinned for smooth playback.
  const MAX_FACES = 6000;
  function decimate(m) {
    m.original = m.f.length;
    if (m.f.length <= MAX_FACES) return m;
    const k = m.f.length / MAX_FACES, f = [];
    for (let i = 0; i < MAX_FACES; i++) f.push(m.f[Math.floor(i * k)]);
    m.f = f;
    return m;
  }

  function parseSTL(buf) {
    const dv = new DataView(buf);
    const n = buf.byteLength >= 84 ? dv.getUint32(80, true) : 0;
    const v = [], f = [];
    if (n && 84 + n * 50 === buf.byteLength) {
      for (let i = 0; i < n; i++) {
        const o = 84 + i * 50 + 12, b = v.length;
        for (let j = 0; j < 3; j++) {
          const x = dv.getFloat32(o + j * 12, true), y = dv.getFloat32(o + j * 12 + 4, true), z = dv.getFloat32(o + j * 12 + 8, true);
          v.push([x, -z, y]); // STL is usually Z-up
        }
        f.push([b, b + 1, b + 2]);
      }
    } else {
      const text = new TextDecoder().decode(buf);
      const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
      let m;
      while ((m = re.exec(text))) v.push([+m[1], -(+m[3]), +m[2]]);
      for (let i = 0; i + 2 < v.length; i += 3) f.push([i, i + 1, i + 2]);
    }
    if (!v.length) throw new Error('no triangles found');
    return { v, f };
  }

  function parsePLY(text) {
    const lines = text.split('\n');
    let i = 0, nv = 0, nf = 0;
    if (!/^ply/.test(lines[0])) throw new Error('not a PLY file');
    if (/binary/.test(text.slice(0, 400))) throw new Error('binary PLY is not supported: export it as ASCII');
    for (; i < lines.length; i++) {
      const l = lines[i].trim();
      if (l.startsWith('element vertex')) nv = +l.split(/\s+/)[2];
      if (l.startsWith('element face')) nf = +l.split(/\s+/)[2];
      if (l === 'end_header') { i++; break; }
    }
    const v = [], f = [];
    for (let k = 0; k < nv; k++, i++) { const p = lines[i].trim().split(/\s+/).map(Number); v.push([p[0], -p[1], p[2]]); }
    for (let k = 0; k < nf; k++, i++) { const p = lines[i].trim().split(/\s+/).map(Number); f.push(p.slice(1, 1 + p[0])); }
    return { v, f };
  }

  function gltfMesh(json, bins) {
    const v = [], f = [];
    const read = (accIdx) => {
      const acc = json.accessors[accIdx], bv = json.bufferViews[acc.bufferView];
      const buf = bins[bv.buffer || 0];
      const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
      const Arr = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[acc.componentType];
      const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
      const stride = bv.byteStride ? bv.byteStride / Arr.BYTES_PER_ELEMENT : comps;
      const all = new Arr(buf, start, Math.ceil(((acc.count - 1) * stride + comps)));
      const out = [];
      for (let i = 0; i < acc.count; i++) { const e = []; for (let c = 0; c < comps; c++) e.push(all[i * stride + c]); out.push(e); }
      return out;
    };
    for (const mesh of json.meshes || []) {
      for (const prim of mesh.primitives || []) {
        if (prim.mode !== undefined && prim.mode !== 4) continue;
        if (prim.attributes.POSITION === undefined) continue;
        const base = v.length;
        for (const p of read(prim.attributes.POSITION)) v.push([p[0], -p[1], p[2]]);
        const idx = prim.indices !== undefined ? read(prim.indices).map(e => e[0]) : [...Array(v.length - base).keys()];
        for (let i = 0; i + 2 < idx.length; i += 3) f.push([base + idx[i], base + idx[i + 1], base + idx[i + 2]]);
      }
    }
    if (!v.length) throw new Error('no triangle meshes found');
    return { v, f };
  }

  function parseGLB(buf) {
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a GLB file');
    let off = 12, json = null;
    const bins = [];
    while (off < buf.byteLength) {
      const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
      const chunk = buf.slice(off + 8, off + 8 + len);
      if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(chunk));
      else if (type === 0x004E4942) bins.push(chunk);
      off += 8 + len;
    }
    return gltfMesh(json, bins);
  }

  function parseGLTF(text) {
    const json = JSON.parse(text);
    const bins = (json.buffers || []).map(b => {
      if (!b.uri || !b.uri.startsWith('data:')) throw new Error('this .gltf uses a separate .bin file: export it as .glb instead');
      const bin = atob(b.uri.split(',')[1]);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return u8.buffer;
    });
    return gltfMesh(json, bins);
  }

  const MODEL_EXT = /\.(obj|stl|glb|gltf|ply)$/i;
  async function loadModel(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    let m;
    if (ext === 'obj') m = HC3D.parseOBJ(await file.text());
    else if (ext === 'stl') m = normalize(parseSTL(await file.arrayBuffer()));
    else if (ext === 'glb') m = normalize(parseGLB(await file.arrayBuffer()));
    else if (ext === 'gltf') m = normalize(parseGLTF(await file.text()));
    else if (ext === 'ply') m = normalize(parsePLY(await file.text()));
    else throw new Error('unknown model format');
    return decimate(m);
  }

  // ---------- model layers ----------
  const BUILTINS = {
    cube: () => HC3D.cube(), sphere: () => HC3D.sphere(18, 12), torus: () => HC3D.torus(), pyramid: () => HC3D.pyramid(),
    figure: () => HC3D.figure(), plane: () => HC3D.plane(10),
  };
  const builtinCache = {};

  function newModel(src) {
    return { id: uid('m'), src, name: src.replace(/^(m:|b:)/, ''), x: 0, y: 0, z: 3, rx: 0, ry: 0, rz: 0, spinX: 0, spinY: 0.4, spinZ: 0,
      scale: 1, color: '#bbbbbb', wire: false, stroke: '#ffffff', fog: 0.15, bob: 0, flicker: 0, start: 0, end: 0 };
  }

  const MODEL_SCHEMA = [
    ['Place', [['x', 'Left / right', 'range', -5, 5, 0.05], ['y', 'Up / down', 'range', -3, 3, 0.05], ['z', 'Distance', 'range', 0.3, 20, 0.1], ['scale', 'Scale', 'range', 0.05, 6, 0.05]]],
    ['Rotate', [['rx', 'Tilt', 'range', -3.14, 3.14, 0.01], ['ry', 'Turn', 'range', -3.14, 3.14, 0.01], ['rz', 'Roll', 'range', -3.14, 3.14, 0.01],
      ['spinX', 'Spin X', 'range', -4, 4, 0.05], ['spinY', 'Spin Y', 'range', -4, 4, 0.05], ['spinZ', 'Spin Z', 'range', -4, 4, 0.05], ['bob', 'Bob', 'range', 0, 1, 0.01]]],
    ['Look', [['color', 'Color', 'color'], ['wire', 'Wireframe', 'check'], ['stroke', 'Line color', 'color'], ['fog', 'Darkness falloff', 'range', 0, 2, 0.05], ['flicker', 'Flicker', 'range', 0, 100, 1]]],
    ['Timing', [['start', 'Appear at (s)', 'range', 0, 60, 0.1], ['end', 'Vanish at (s, 0 = never)', 'range', 0, 60, 0.1]]],
  ];

  const inWindow = (l, t) => t >= (l.start || 0) && (!l.end || t < l.end);

  function renderModels(ctx, layers, t, media) {
    for (const l of layers || []) {
      if (!inWindow(l, t)) continue;
      if (l.flicker && HCNoise(t * 4, l.x + l.z) < l.flicker / 130) continue;
      let mesh = null;
      if (l.src.startsWith('b:')) { const k = l.src.slice(2); mesh = builtinCache[k] || (builtinCache[k] = BUILTINS[k] && BUILTINS[k]()); }
      else { const m = media.get(l.src.slice(2)); mesh = m && m.kind === 'model' ? m.mesh : null; }
      if (!mesh) continue;
      HC3D.render(ctx, mesh, {
        x: l.x, y: l.y + Math.sin(t * 2) * l.bob * 0.3, z: l.z, cam: 0,
        rx: l.rx + t * l.spinX, ry: l.ry + t * l.spinY, rz: l.rz + t * l.spinZ,
        scale: l.scale, color: l.color, wire: l.wire, stroke: l.wire ? l.stroke : null, fog: l.fog,
      });
    }
  }

  // ---------- image layers ----------
  function newImage(src) {
    return { id: uid('i'), src, name: src.slice(2), x: 320, y: 240, scale: 1, rot: 0, opacity: 1, blend: 'source-over', flicker: 0,
      anim: 'none', amount: 1, layer: 'front', start: 0, end: 0, flipX: false };
  }
  const BLENDS = ['source-over', 'screen', 'multiply', 'overlay', 'lighten', 'darken', 'difference', 'exclusion', 'color-dodge', 'hard-light', 'luminosity'];
  const IMAGE_SCHEMA = [
    ['Place', [['x', 'X', 'range', -320, 960, 1], ['y', 'Y', 'range', -240, 720, 1], ['scale', 'Scale', 'range', 0.05, 5, 0.01], ['rot', 'Rotate (°)', 'range', -180, 180, 1], ['flipX', 'Mirror', 'check'],
      ['layer', 'Layer', 'select', [['front', 'In front of characters'], ['back', 'Behind everything']]]]],
    ['Look', [['opacity', 'Opacity', 'range', 0, 1, 0.01], ['blend', 'Blend', 'select', BLENDS], ['flicker', 'Flicker', 'range', 0, 100, 1]]],
    ['Motion', [['anim', 'Animation', 'select', ['none', 'drift', 'pulse', 'shake', 'peek', 'spin', 'creep zoom', 'fade in', 'jump scare']], ['amount', 'Strength', 'range', 0, 3, 0.05]]],
    ['Timing', [['start', 'Appear at (s)', 'range', 0, 60, 0.1], ['end', 'Vanish at (s, 0 = never)', 'range', 0, 60, 0.1]]],
  ];

  function renderImages(ctx, layers, t, which, media) {
    for (const l of layers || []) {
      if ((l.layer || 'front') !== which || !inWindow(l, t)) continue;
      if (l.flicker && Math.random() < l.flicker / 150) continue;
      const m = media.get(l.src.slice(2));
      if (!m || m.kind !== 'image' || !m.el.naturalWidth) continue;
      const el = m.el, lt = t - (l.start || 0), a = l.amount;
      let x = l.x, y = l.y, s = l.scale, r = (l.rot * Math.PI) / 180, op = l.opacity;
      switch (l.anim) {
        case 'drift': x += Math.sin(lt * 0.4) * 40 * a; y += Math.cos(lt * 0.3) * 20 * a; break;
        case 'pulse': s *= 1 + Math.sin(lt * 4) * 0.05 * a; break;
        case 'shake': x += (Math.random() - 0.5) * 12 * a; y += (Math.random() - 0.5) * 12 * a; break;
        case 'peek': x += Math.max(0, 1 - lt / 1.2) * 500 * a; break;
        case 'spin': r += lt * a; break;
        case 'creep zoom': s *= 1 + lt * 0.04 * a; break;
        case 'fade in': op *= Math.min(1, lt / Math.max(0.1, a)); break;
        case 'jump scare': if (lt > 0.25 / Math.max(0.2, a)) continue; s *= 1.6 + lt * 2; break;
      }
      const w = el.naturalWidth * s * (640 / Math.max(el.naturalWidth, 640)), h = el.naturalHeight * (w / el.naturalWidth);
      ctx.save();
      ctx.globalAlpha = op;
      ctx.globalCompositeOperation = l.blend || 'source-over';
      ctx.translate(x, y);
      ctx.rotate(r);
      if (l.flipX) ctx.scale(-1, 1);
      ctx.drawImage(el, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  return { MODEL_EXT, loadModel, BUILTINS, newModel, MODEL_SCHEMA, renderModels, newImage, IMAGE_SCHEMA, renderImages };
})();
