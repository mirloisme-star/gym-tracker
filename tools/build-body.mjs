// Bakes the 3D figure into assets/body.bin. Run with: node tools/build-body.mjs
// The body is a signed distance field: muscles blend onto a base form with a small radius,
// which leaves natural grooves between them. Surface nets then turns it into a single mesh.
import { mkdirSync, writeFileSync } from 'node:fs';

// Same order as the region indexes body.js reads. Index 0 is everything that isn't a muscle.
const REGIONS = ['base', 'chest', 'frontDelt', 'sideDelt', 'rearDelt', 'biceps', 'triceps', 'forearm', 'abs', 'obliques', 'traps', 'lats', 'lowerBack', 'glutes', 'quads', 'hamstrings', 'calves'];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
};

// Capsule with a different radius at each end.
function cone(a, b, r1, r2) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  return (p) => {
    const ap = sub(p, a);
    const t = Math.min(1, Math.max(0, dot(ap, ab) / l2));
    return len([ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t]) - (r1 + (r2 - r1) * t);
  };
}

function ellipsoidIn(frame, center, r) {
  return (p) => {
    const d = sub(p, center);
    const q = [dot(d, frame[0]), dot(d, frame[1]), dot(d, frame[2])];
    const k0 = Math.hypot(q[0] / r[0], q[1] / r[1], q[2] / r[2]);
    const k1 = Math.hypot(q[0] / (r[0] * r[0]), q[1] / (r[1] * r[1]), q[2] / (r[2] * r[2]));
    return k1 === 0 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1;
  };
}

// Tilted about the z axis, then the y axis, in radians.
function ell(center, r, tiltZ = 0, tiltY = 0) {
  const cz = Math.cos(tiltZ);
  const sz = Math.sin(tiltZ);
  const cy = Math.cos(tiltY);
  const sy = Math.sin(tiltY);
  const x = [cz * cy, sz, -cz * sy];
  const y = [-sz * cy, cz, sz * sy];
  const z = [sy, 0, cy];
  return ellipsoidIn([x, y, z], center, r);
}

// A muscle belly stretched between two points.
function belly(a, b, r, flat = 1) {
  const axis = sub(b, a);
  const half = len(axis) / 2;
  const y = axis.map((v) => v / (half * 2));
  const ref = Math.abs(y[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const xr = [y[1] * ref[2] - y[2] * ref[1], y[2] * ref[0] - y[0] * ref[2], y[0] * ref[1] - y[1] * ref[0]];
  const xl = len(xr);
  const x = xr.map((v) => v / xl);
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  return ellipsoidIn([x, y, z], c, [r, half, r * flat]);
}

// All shapes describe the x >= 0 half; the field is evaluated on |x|, which mirrors them.
const BASE = [
  ell([0, 3.14, 0.012], [0.155, 0.2, 0.178]),
  ell([0, 3.03, 0.035], [0.105, 0.11, 0.12]),
  cone([0, 2.76, -0.015], [0, 3.02, 0], 0.125, 0.098),
  ell([0, 2.47, 0], [0.37, 0.44, 0.215]),
  ell([0, 2.03, 0], [0.285, 0.38, 0.17]),
  ell([0, 1.73, 0], [0.32, 0.2, 0.2]),
  cone([0.05, 2.77, -0.015], [0.46, 2.72, -0.01], 0.09, 0.075),
  cone([0.52, 2.68, 0], [0.71, 2.14, 0.01], 0.078, 0.058),
  cone([0.71, 2.14, 0.01], [0.86, 1.64, 0.05], 0.06, 0.036),
  ell([0.888, 1.49, 0.066], [0.042, 0.125, 0.026], -0.27),
  cone([0.87, 1.55, 0.09], [0.872, 1.43, 0.115], 0.016, 0.011),
  cone([0.19, 1.74, 0], [0.2, 0.98, 0.012], 0.165, 0.092),
  ell([0.2, 0.95, 0.03], [0.083, 0.09, 0.088]),
  cone([0.2, 0.92, 0.005], [0.2, 0.13, 0], 0.08, 0.046),
  ell([0.2, 0.1, -0.01], [0.05, 0.07, 0.055]),
  cone([0.2, 0.052, -0.06], [0.215, 0.038, 0.2], 0.056, 0.04),
];

const MUSCLES = [
  ['chest', ell([0.2, 2.54, 0.15], [0.225, 0.15, 0.09], -0.16, 0.3)],
  ['chest', ell([0.17, 2.42, 0.15], [0.16, 0.085, 0.07], 0.14, 0.25)],
  ['abs', ell([0.07, 2.27, 0.15], [0.062, 0.062, 0.042])],
  ['abs', ell([0.07, 2.14, 0.157], [0.064, 0.062, 0.042])],
  ['abs', ell([0.07, 2.01, 0.16], [0.064, 0.062, 0.042])],
  ['abs', ell([0.066, 1.84, 0.155], [0.058, 0.098, 0.04])],
  ['obliques', ell([0.218, 2.07, 0.075], [0.072, 0.24, 0.092], -0.08, 0.45)],
  ['frontDelt', ell([0.475, 2.715, 0.07], [0.09, 0.15, 0.072], 0.3)],
  ['sideDelt', ell([0.565, 2.7, -0.002], [0.066, 0.145, 0.078], 0.3)],
  ['rearDelt', ell([0.475, 2.715, -0.075], [0.09, 0.15, 0.072], 0.3)],
  ['biceps', belly([0.54, 2.58, 0.05], [0.7, 2.17, 0.065], 0.072)],
  ['triceps', belly([0.525, 2.62, -0.05], [0.675, 2.2, -0.05], 0.062)],
  ['triceps', belly([0.6, 2.6, -0.025], [0.725, 2.22, -0.035], 0.056)],
  ['forearm', belly([0.71, 2.14, 0.035], [0.85, 1.68, 0.06], 0.056)],
  ['forearm', belly([0.75, 2.13, -0.015], [0.87, 1.68, 0.035], 0.05)],
  ['traps', belly([0.03, 2.95, -0.03], [0.4, 2.73, -0.035], 0.082, 0.95)],
  ['traps', ell([0.1, 2.63, -0.17], [0.13, 0.17, 0.055], 0.3)],
  ['traps', ell([0.038, 2.4, -0.185], [0.05, 0.17, 0.04])],
  ['lats', ell([0.245, 2.34, -0.1], [0.135, 0.33, 0.075], 0.24, -0.4)],
  ['lowerBack', ell([0.068, 1.97, -0.135], [0.062, 0.2, 0.05])],
  ['glutes', ell([0.155, 1.67, -0.105], [0.15, 0.165, 0.1], -0.1)],
  ['quads', belly([0.2, 1.67, 0.1], [0.205, 1.03, 0.1], 0.085, 0.85)],
  ['quads', belly([0.305, 1.62, 0.015], [0.28, 1.02, 0.055], 0.082)],
  ['quads', belly([0.1, 1.36, 0.06], [0.145, 0.99, 0.09], 0.07)],
  ['hamstrings', belly([0.27, 1.58, -0.085], [0.27, 1.0, -0.07], 0.078)],
  ['hamstrings', belly([0.125, 1.58, -0.085], [0.135, 1.0, -0.07], 0.078)],
  ['calves', belly([0.245, 0.93, -0.04], [0.225, 0.4, -0.04], 0.07)],
  ['calves', belly([0.15, 0.93, -0.04], [0.17, 0.4, -0.04], 0.07)],
].map(([region, sdf]) => ({ region: REGIONS.indexOf(region), sdf }));

function field(p) {
  const q = [Math.abs(p[0]), p[1], p[2]];
  let d = BASE[0](q);
  for (let i = 1; i < BASE.length; i++) d = smin(d, BASE[i](q), 0.06);
  for (const m of MUSCLES) d = smin(d, m.sdf(q), 0.017);
  return d;
}

function regionAt(p) {
  const q = [Math.abs(p[0]), p[1], p[2]];
  let best = 0;
  let bestD = Infinity;
  for (const m of MUSCLES) {
    const d = m.sdf(q);
    if (d < bestD) {
      bestD = d;
      best = m.region;
    }
  }
  // Fades to the neutral body over tendons and joints, so color edges stay soft.
  const t = Math.min(1, Math.max(0, (0.05 - bestD) / 0.035));
  return { region: best, weight: t * t * (3 - 2 * t) };
}

// How open the surface is: low in the grooves between muscles, which darkens them.
function openness(p) {
  const e = 0.004;
  const n = [
    field([p[0] + e, p[1], p[2]]) - field([p[0] - e, p[1], p[2]]),
    field([p[0], p[1] + e, p[2]]) - field([p[0], p[1] - e, p[2]]),
    field([p[0], p[1], p[2] + e]) - field([p[0], p[1], p[2] - e]),
  ];
  const l = len(n) || 1;
  let sum = 0;
  for (const dist of [0.02, 0.04, 0.07]) {
    sum += Math.min(1, Math.max(0, field([p[0] + (n[0] / l) * dist, p[1] + (n[1] / l) * dist, p[2] + (n[2] / l) * dist]) / dist));
  }
  return sum / 3;
}

const CELL = 0.021;
const MIN = [-1.04, -0.02, -0.34];
const MAX = [1.04, 3.42, 0.34];
const dims = MIN.map((m, i) => Math.ceil((MAX[i] - m) / CELL) + 1);
const [nx, ny, nz] = dims;
const at = (x, y, z) => x + nx * (y + ny * z);
const values = new Float32Array(nx * ny * nz);
for (let z = 0; z < nz; z++) {
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      values[at(x, y, z)] = field([MIN[0] + x * CELL, MIN[1] + y * CELL, MIN[2] + z * CELL]);
    }
  }
}

// Surface nets: one vertex per cell the surface passes through, placed at the mean crossing.
const cellVertex = new Int32Array(nx * ny * nz).fill(-1);
const positions = [];
const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
for (let z = 0; z < nz - 1; z++) {
  for (let y = 0; y < ny - 1; y++) {
    for (let x = 0; x < nx - 1; x++) {
      const v = CORNERS.map((c) => values[at(x + c[0], y + c[1], z + c[2])]);
      const sum = [0, 0, 0];
      let hits = 0;
      for (const [a, b] of EDGES) {
        if (v[a] < 0 === v[b] < 0) continue;
        const t = v[a] / (v[a] - v[b]);
        for (let i = 0; i < 3; i++) sum[i] += CORNERS[a][i] + (CORNERS[b][i] - CORNERS[a][i]) * t;
        hits += 1;
      }
      if (!hits) continue;
      cellVertex[at(x, y, z)] = positions.length;
      positions.push([MIN[0] + (x + sum[0] / hits) * CELL, MIN[1] + (y + sum[1] / hits) * CELL, MIN[2] + (z + sum[2] / hits) * CELL]);
    }
  }
}

const indices = [];
function quad(a, b, c, d, flip) {
  if (a < 0 || b < 0 || c < 0 || d < 0) return;
  if (flip) indices.push(a, c, b, a, d, c);
  else indices.push(a, b, c, a, c, d);
}
for (let z = 1; z < nz - 1; z++) {
  for (let y = 1; y < ny - 1; y++) {
    for (let x = 1; x < nx - 1; x++) {
      const inside = values[at(x, y, z)] < 0;
      const cv = (i, j, k) => cellVertex[at(i, j, k)];
      if (inside !== values[at(x + 1, y, z)] < 0) quad(cv(x, y - 1, z - 1), cv(x, y, z - 1), cv(x, y, z), cv(x, y - 1, z), !inside);
      if (inside !== values[at(x, y + 1, z)] < 0) quad(cv(x - 1, y, z - 1), cv(x - 1, y, z), cv(x, y, z), cv(x, y, z - 1), !inside);
      if (inside !== values[at(x, y, z + 1)] < 0) quad(cv(x - 1, y - 1, z), cv(x, y - 1, z), cv(x, y, z), cv(x - 1, y, z), !inside);
    }
  }
}

if (positions.length > 65535) throw new Error(`Too many vertices for 16-bit indices: ${positions.length}`);

// Layout: u32 vertex count, u32 index count, int16 xyz (1/8192 units),
// u8 region, weight and openness per vertex, padding to 2 bytes, u16 indices.
const scale = 8192;
const vCount = positions.length;
const iCount = indices.length;
const regionPad = (vCount * 9) % 2;
const buf = Buffer.alloc(8 + vCount * 9 + regionPad + iCount * 2);
buf.writeUInt32LE(vCount, 0);
buf.writeUInt32LE(iCount, 4);
let o = 8;
for (const p of positions) {
  for (const c of p) {
    buf.writeInt16LE(Math.round(c * scale), o);
    o += 2;
  }
}
for (const p of positions) {
  const { region, weight } = regionAt(p);
  buf.writeUInt8(region, o++);
  buf.writeUInt8(Math.round(weight * 255), o++);
  buf.writeUInt8(Math.round(openness(p) * 255), o++);
}
o += regionPad;
for (const i of indices) {
  buf.writeUInt16LE(i, o);
  o += 2;
}
mkdirSync('assets', { recursive: true });
writeFileSync('assets/body.bin', buf);
console.log(`${vCount} vertices, ${iCount / 3} triangles, ${Math.round(buf.length / 1024)} KB`);
