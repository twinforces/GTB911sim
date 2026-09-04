import { G } from "./constants";
import { eFactor, fyFactor } from "./steel";
import type { Piece, Pit, Scenario } from "./types";
import { woodFy } from "./wood";

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

let seq = 1;

function piece(
  kind: Piece["kind"],
  material: Piece["material"],
  x: number,
  y: number,
  w: number,
  h: number,
  theta: number,
  mass: number,
  layer: number,
  col: number,
  z = 0,
  alongZ = false,
  depth = h,
): Piece {
  return {
    id: seq++,
    kind,
    material,
    x,
    y,
    z,
    w,
    h,
    depth,
    theta,
    vx: 0,
    vy: 0,
    vz: 0,
    omega: 0,
    mass,
    temp: 22,
    fuel: 1,
    burning: 0,
    stripped: 0,
    intact: 1,
    failed: false,
    dynamic: false,
    layer,
    col,
    restX: x,
    restY: y,
    restZ: z,
    alongZ,
  };
}

export function buildPieces(s: Scenario): { pieces: Piece[]; pit: Pit | null } {
  seq = 1;
  if (s.shape === "bonfire") return buildBonfire(s);
  if (s.shape === "house") return buildHouse(s);
  if (s.shape === "apartment") return buildApartment(s);
  return { pieces: [], pit: null };
}

function buildBonfire(s: Scenario): { pieces: Piece[]; pit: Pit | null } {
  const pitW = s.width - 0.32;
  const half = pitW / 2;
  const pit: Pit = { left: 0.16, right: s.width - 0.16, depth: 0.42, near: -half, far: half };
  const cx = s.width / 2;
  const dia = 0.15;
  const len = 1.92;
  const layers = 10;
  const per = 4;
  const span = 1.02;
  const pieces: Piece[] = [];
  for (let layer = 0; layer < layers; layer++) {
    const alongZ = layer % 2 === 0;
    const y = -pit.depth + dia * 0.55 + layer * dia;
    for (let i = 0; i < per; i++) {
      const t = i / Math.max(1, per - 1);
      const off = (t - 0.5) * span;
      const col = t < 0.34 ? 0 : t > 0.66 ? 4 : 2;
      if (alongZ) {
        pieces.push(piece("log", "wood", cx + off, y, dia, dia, 0, 16, layer, col, 0, true, len));
      } else {
        pieces.push(piece("log", "wood", cx, y, len, dia, 0, 16, layer, col, off, false, dia));
      }
    }
  }
  return { pieces, pit };
}

function buildHouse(s: Scenario): { pieces: Piece[]; pit: Pit | null } {
  const storeys = Math.max(1, s.floors);
  const W = s.width;
  const D = 6.4;
  const H = s.floorH;
  const wallT = 0.14;
  const pieces: Piece[] = [];
  const xs = [0.28, W * 0.26, W * 0.5, W * 0.74, W - 0.28];
  const zs = [-D * 0.38, 0, D * 0.38];

  for (let st = 0; st < storeys; st++) {
    const y0 = st * H;
    // Floor deck plus actual joists — one 8×6 m plate read as a wall flying out.
    pieces.push(piece("joist", "wood", W / 2, y0 + 0.08, W - 0.18, 0.05, 0, 70, st * 5 + 3, 2, 0, false, D - 0.22));
    for (let j = 0; j < 6; j++) {
      const z = (j / 5 - 0.5) * (D - 0.55);
      pieces.push(piece("joist", "wood", W / 2, y0 + 0.18, W - 0.28, 0.16, 0, 22, st * 5 + 3, 2, z, false, 0.14));
    }
    pieces.push(piece("sill", "wood", W / 2, y0 + 0.05, W - 0.12, 0.1, 0, 28, st * 5, 2, D / 2 - 0.22, false, 0.16));
    pieces.push(piece("sill", "wood", W / 2, y0 + 0.05, W - 0.12, 0.1, 0, 28, st * 5, 2, -D / 2 + 0.22, false, 0.16));

    const studH = H - 0.32;
    const cy = y0 + 0.2 + studH / 2;
    for (let c = 0; c < xs.length; c++) {
      for (let zi = 0; zi < zs.length; zi++) {
        if (c !== 0 && c !== 4 && zi === 1 && st > 0) continue;
        pieces.push(piece("stud", "wood", xs[c], cy, 0.14, studH, 0, 48, st * 5 + 1, c, zs[zi], false, 0.14));
      }
    }

    const wallY = y0 + H * 0.5;
    const wallH = H - 0.18;
    pieces.push(piece("wall", "wood", W / 2, wallY, W - 0.08, wallH, 0, 110, st * 5 + 2, 2, D / 2 - wallT / 2, false, wallT));
    pieces.push(piece("wall", "wood", W / 2, wallY, W - 0.08, wallH, 0, 110, st * 5 + 2, 2, -D / 2 + wallT / 2, false, wallT));
    pieces.push(piece("wall", "wood", wallT / 2, wallY, wallT, wallH, 0, 95, st * 5 + 2, 0, 0, false, D - 0.2));
    pieces.push(piece("wall", "wood", W - wallT / 2, wallY, wallT, wallH, 0, 95, st * 5 + 2, 4, 0, false, D - 0.2));
  }

  const roofY = storeys * H;
  const pitch = 0.5;
  const run = W / 2;
  const rise = Math.tan(pitch) * run;
  const len = Math.sqrt(run * run + rise * rise);
  const midY = roofY + rise * 0.5;
  pieces.push(piece("roof", "wood", W * 0.25, midY, len, 0.09, -pitch, 120, storeys * 5, 0, 0, false, D + 0.35));
  pieces.push(piece("roof", "wood", W * 0.75, midY, len, 0.09, pitch, 120, storeys * 5, 4, 0, false, D + 0.35));
  pieces.push(piece("plate", "wood", W / 2, roofY + rise, 0.16, 0.12, 0, 36, storeys * 5, 2, 0, false, D + 0.2));

  // Living-room Christmas tree (UL/NIST demo): dry tree, then the couch.
  const treeH = Math.min(2.05, H * 0.78);
  pieces.push(piece("tree", "wood", 1.58, treeH * 0.52, 0.9, treeH, 0, 18, 0, 0, 1.42, false, 0.9));
  pieces.push(piece("couch", "wood", 3.22, 0.4, 2.05, 0.78, 0, 48, 0, 1, 1.48, false, 0.92));
  return { pieces, pit: null };
}

function buildApartment(s: Scenario): { pieces: Piece[]; pit: Pit | null } {
  const n = s.floors;
  const W = s.width;
  const H = s.floorH;
  const D = W * 0.78;
  const xs = [0.1, 0.3, 0.5, 0.7, 0.9].map((t) => t * W);
  const zs = [-D * 0.28, 0, D * 0.28];
  const pieces: Piece[] = [];
  const colMass = 420;
  const slabMass = 900;
  const wallT = 0.22;
  for (let i = 0; i < n; i++) {
    const y0 = i * H;
    for (let zi = 0; zi < zs.length; zi++) {
      for (let c = 0; c < 5; c++) {
        pieces.push(
          piece("column", "steel", xs[c], y0 + H * 0.48, c === 2 ? 0.32 : 0.2, H * 0.9, 0, colMass, i, c, zs[zi], false, 0.24),
        );
      }
    }
    for (let b = 0; b < 4; b++) {
      const x = ((b + 0.5) / 4) * W;
      pieces.push(piece("slab", "steel", x, y0 + H - 0.1, W * 0.28, 0.18, 0, slabMass, i, b === 0 ? 0 : b === 3 ? 4 : 2, 0, false, D * 0.92));
    }
    const wallY = y0 + H * 0.48;
    const wallH = H - 0.1;
    pieces.push(piece("wall", "wood", W / 2, wallY, W - 0.02, wallH, 0, 260, i, 2, D / 2 - wallT / 2, false, wallT));
    pieces.push(piece("wall", "wood", W / 2, wallY, W - 0.02, wallH, 0, 260, i, 2, -D / 2 + wallT / 2, false, wallT));
    pieces.push(piece("wall", "wood", wallT / 2, wallY, wallT, wallH, 0, 200, i, 0, 0, false, D - 0.08));
    pieces.push(piece("wall", "wood", W - wallT / 2, wallY, wallT, wallH, 0, 200, i, 4, 0, false, D - 0.08));
    // Party walls — rooms, not an empty shaft.
    pieces.push(piece("wall", "wood", W * 0.5, wallY, wallT, wallH * 0.92, 0, 70, i, 2, 0, false, D * 0.62));
    pieces.push(piece("wall", "wood", W * 0.3, wallY, wallT, wallH * 0.92, 0, 55, i, 1, 0, false, D * 0.5));
    pieces.push(piece("wall", "wood", W * 0.7, wallY, wallT, wallH * 0.92, 0, 55, i, 3, 0, false, D * 0.5));
  }
  pieces.push(piece("slab", "steel", W / 2, n * H + 0.08, W * 1.04, 0.18, 0, 1600, n, 2, 0, false, D * 1.04));
  const py = n * H + 0.18 + 0.42;
  pieces.push(piece("wall", "wood", W / 2, py, W + 0.1, 0.84, 0, 48, n, 2, D / 2, false, wallT));
  pieces.push(piece("wall", "wood", W / 2, py, W + 0.1, 0.84, 0, 48, n, 2, -D / 2, false, wallT));
  pieces.push(piece("wall", "wood", wallT / 2, py, wallT, 0.84, 0, 36, n, 0, 0, false, D + 0.04));
  pieces.push(piece("wall", "wood", W - wallT / 2, py, wallT, 0.84, 0, 36, n, 4, 0, false, D + 0.04));
  return { pieces, pit: null };
}

export function ignitePieces(pieces: Piece[], s: Scenario): void {
  if (s.noFire) return;
  if (s.shape === "bonfire") {
    // Boy Scout one-match: a single log at the kerosene corner, not a whole face.
    let best: Piece | null = null;
    let score = Infinity;
    for (const p of pieces) {
      const s0 = p.y * 6 + p.x + p.z;
      if (s0 < score) {
        score = s0;
        best = p;
      }
    }
    if (best) {
      best.burning = 1;
      best.stripped = 0.8;
      best.fuel = 1;
    }
    return;
  }
  if (s.shape === "house") {
    const tree = pieces.find((p) => p.kind === "tree");
    if (tree) {
      tree.burning = 1;
      tree.stripped = 0.95;
      tree.fuel = 1;
      tree.temp = 420;
    }
    return;
  }
  const lo = s.impactLo;
  const hi = s.impactHi;
  for (const p of pieces) {
    if (p.kind === "sill" && p.layer === 0) continue;
    if (s.shape === "apartment") {
      // One unit on the ignition storey — not the whole floor plate.
      if (p.kind === "wall") continue;
      if (p.layer !== lo - 1) continue;
      if (p.col !== 0) continue;
      p.burning = 0.78;
      p.stripped = 0.7;
      p.fuel = 1;
      p.temp = 280;
      continue;
    }
    const story = p.kind === "column" || p.kind === "slab" ? p.layer + 1 : Math.floor(p.layer / 5) + 1;
    const onFireFloor = story >= lo && story <= hi;
    if (!onFireFloor) continue;
    if (p.col <= 1 || p.x < s.width * 0.45) {
      p.burning = 0.8;
      p.stripped = 0.92;
      p.fuel = 1;
    }
  }
}

export function fyOf(p: Piece): number {
  return p.material === "wood" ? woodFy(p.temp) * p.intact : fyFactor(p.temp) * p.intact;
}

export function heatPieces(pieces: Piece[], s: Scenario, dt: number): void {
  const heatMul = s.heatRate;
  for (const p of pieces) {
    if (p.failed && p.dynamic && p.burning < 0.05) continue;
    const gas = 20 + 880 * p.burning;
    const tau = (p.stripped > 0.4 ? 4200 : 11000) / heatMul;
    p.temp += ((gas - p.temp) / tau) * dt;
    if (p.temp > 1100) p.temp = 1100;
    if (p.temp < 0) p.temp = 0;
    if (p.burning > 0 && p.fuel > 0) {
      const burn = p.burning * heatMul * dt;
      // Bottom logs sit in the hottest air. A real pit eats the base first.
      const layerBoost =
        p.kind === "log"
          ? 1 + Math.max(0, 5 - p.layer) * 0.45
          : p.kind === "tree"
            ? 1.8
            : p.kind === "couch"
              ? 1.6
              : s.shape === "house" && (p.kind === "stud" || p.kind === "joist" || p.kind === "wall" || p.kind === "roof" || p.kind === "plate")
                ? 2.4
                : 1;
      p.fuel = Math.max(0, p.fuel - 0.0016 * burn * layerBoost);
      if (p.material === "wood") {
        p.intact = Math.max(0.02, p.intact - 0.0012 * burn * layerBoost);
        if (p.kind === "log") {
          const remain = Math.max(0.06, p.intact * (0.35 + 0.65 * p.fuel));
          const dia = 0.15 * (0.16 + 0.84 * Math.sqrt(remain));
          const long = 1.92 * (0.2 + 0.8 * remain);
          p.h = dia;
          if (p.alongZ) {
            p.w = dia;
            p.depth = long;
          } else {
            p.depth = dia;
            p.w = long;
          }
        } else if (p.kind === "tree") {
          const remain = Math.max(0.18, p.intact * (0.25 + 0.75 * p.fuel));
          p.h = 2.05 * remain;
          p.w = 0.9 * (0.45 + 0.55 * remain);
          p.depth = p.w;
          p.y = Math.max(p.h * 0.5, p.restY - (2.05 - p.h) * 0.35);
        } else if (p.kind === "couch") {
          const remain = Math.max(0.28, p.intact * (0.4 + 0.6 * p.fuel));
          p.h = 0.78 * remain;
          p.y = Math.max(0.18, p.h * 0.5);
        } else if (p.kind === "stud") {
          const remain = Math.max(0.22, p.intact * (0.45 + 0.55 * p.fuel));
          p.w = 0.14 * remain;
          p.depth = 0.14 * remain;
        }
      }
      if (p.fuel < 0.06) p.burning *= Math.exp(-dt / 700);
    } else if (p.burning > 0) {
      p.burning *= Math.exp(-dt / 350);
    }
  }
}

/** Drop each locked layer onto the one below as diameters shrink. */
export function restackBonfire(pieces: Piece[], pit: Pit): void {
  const locked = pieces.filter((p) => p.kind === "log" && !p.dynamic);
  if (locked.length === 0) return;
  let maxLayer = 0;
  for (const p of locked) if (p.layer > maxLayer) maxLayer = p.layer;
  let top = -pit.depth;
  for (let layer = 0; layer <= maxLayer; layer++) {
    const logs = locked.filter((p) => p.layer === layer);
    if (logs.length === 0) continue;
    let dia = 0;
    for (const p of logs) if (p.h > dia) dia = p.h;
    const cy = top + dia * 0.5;
    for (const p of logs) p.y = cy;
    top = cy + dia * 0.5;
  }
}

export function spreadPieces(pieces: Piece[], s: Scenario, dt: number): void {
  if (s.noFire) return;
  const horiz = s.fireSpread;
  const rate = s.shape === "bonfire" ? 0.014 : s.shape === "house" ? 0.16 : 0.09;
  let couchLit = false;
  if (s.shape === "house") {
    for (const q of pieces) if (q.kind === "couch" && q.burning > 0.25) couchLit = true;
  }
  for (let i = 0; i < pieces.length; i++) {
    const a = pieces[i];
    if (a.burning < 0.12 || a.fuel < 0.04) continue;
    for (let j = 0; j < pieces.length; j++) {
      if (i === j) continue;
      const b = pieces[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      const maxD =
        s.shape === "house"
          ? a.kind === "tree" || a.kind === "couch"
            ? 2.35
            : 2.45
          : s.shape === "apartment"
            ? dy > 1.2
              ? 3.5
              : 3.05
            : dy > 0.15
              ? 3.4
              : 1.35;
      if (d2 > maxD * maxD) continue;
      const d = Math.sqrt(d2) + 0.04;
      const up = dy > 0.04 ? 1.6 : 1;
      const side = horiz > 0 ? 1 : dx > 0.05 ? 0.08 : 1;
      const src = a.kind === "tree" ? 0.9 : a.kind === "couch" ? 1.7 : 1;
      if (s.shape === "house" && a.kind === "tree" && b.kind !== "couch" && b.kind !== "tree" && !couchLit) continue;
      const leak = (rate * a.burning * up * side * src * dt) / d;
      b.temp += leak * 90;
      if (b.temp > 1100) b.temp = 1100;
      if (horiz === 0 && dx > 0.15 && dy < 0.2) continue;
      if (b.kind === "sill" && b.layer === 0) continue;
      const catchT = b.kind === "couch" ? 150 : b.kind === "tree" ? 140 : a.kind === "tree" || a.kind === "couch" ? 185 : 220;
      if (b.temp > catchT && b.fuel > 0.08) {
        const catchBurn = b.kind === "couch" ? 0.7 : b.kind === "tree" ? 0.85 : a.kind === "tree" ? 0.4 : 0.22;
        b.burning = Math.max(b.burning, catchBurn * Math.min(1, up * Math.max(horiz, 0.35)));
        b.stripped = Math.max(b.stripped, 0.35);
      }
    }
  }
}

function xOverlap(a: Piece, b: Piece): number {
  const a0 = a.x - Math.abs(Math.cos(a.theta)) * a.w * 0.45 - 0.05;
  const a1 = a.x + Math.abs(Math.cos(a.theta)) * a.w * 0.45 + 0.05;
  const b0 = b.x - Math.abs(Math.cos(b.theta)) * b.w * 0.45 - 0.05;
  const b1 = b.x + Math.abs(Math.cos(b.theta)) * b.w * 0.45 + 0.05;
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

function hasSupport(p: Piece, locked: Piece[], bonfire: boolean): boolean {
  const low = p.y - Math.max(p.h, p.w * Math.abs(Math.sin(p.theta))) * 0.5;
  if (!bonfire && low < 0.18) return true;
  if (bonfire && p.layer === 0) return true;
  if ((p.kind === "tree" || p.kind === "couch") && p.y - p.h * 0.5 < 0.28) return true;
  const reach = (p.kind === "log" ? 0.28 : Math.max(p.h, 1.2)) + 0.45;
  for (const q of locked) {
    if (q.id === p.id) continue;
    if (p.y < q.y + 0.02) continue;
    if (p.y > q.y + reach) continue;
    if (xOverlap(p, q) > 0.05) return true;
  }
  return false;
}

function unlock(p: Piece, drop = false): void {
  p.failed = true;
  p.dynamic = true;
  if (p.kind === "log" || drop) {
    p.omega = (hash(p.id) - 0.5) * 0.08;
    p.vx = 0;
    p.vz = 0;
    p.vy = -0.15;
  } else {
    p.omega = (hash(p.id) - 0.5) * 1.3;
    p.vx += (hash(p.id + 3) - 0.5) * 0.5;
    p.vz += (hash(p.id + 9) - 0.5) * 1.1;
  }
}

export function evaluatePieces(pieces: Piece[], s: Scenario): Piece | null {
  let first: Piece | null = null;
  const locked = pieces.filter((p) => !p.dynamic);

  for (const p of locked) {
    if (p.kind === "sill" && p.layer === 0) continue;
    // Logs never go ballistic. The crib sags because restackBonfire drops
    // each layer as the one below chars away. Unlocking here was the
    // "burns, then explodes" artifact.
    if (p.kind === "log") continue;
    if (p.kind === "tree" || p.kind === "couch") continue;
    if (p.kind === "wall" || p.kind === "roof") {
      if (s.shape === "apartment") {
        const dead = pieces.filter((q) => q.kind === "column" && q.layer === p.layer && q.dynamic).length;
        if (dead < 6) continue;
      }
    }
    // House: wait until the wood is actually charcoal, then drop in the
    // footprint. Walls linger as a burned shell so the roof can fall in
    // first. Nothing here is allowed to skip char and just fly off.
    if (s.shape === "house") {
      if (p.kind === "stud" && p.intact > 0.3) continue;
      if (p.kind === "joist" && p.intact > 0.28) continue;
      if (p.kind === "plate" && p.intact > 0.28) continue;
      if (p.kind === "sill" && p.intact > 0.22) continue;
      if (p.kind === "roof") {
        const studs = pieces.filter((q) => q.kind === "stud" && q.restY > p.restY - 3.4);
        const dead = studs.filter((q) => q.dynamic).length;
        const need = Math.max(4, Math.floor(studs.length * 0.35));
        if (p.intact > 0.32 && dead < need) continue;
      }
      if (p.kind === "wall" && p.intact > 0.16) continue;
    } else if (p.kind === "stud" && p.intact > 0.22) continue;
    if (!hasSupport(p, locked, s.shape === "bonfire")) {
      const anyLoose = pieces.some((q) => q.dynamic);
      if (!anyLoose && p.temp < 180) continue;
      unlock(p, s.shape === "house" || s.shape === "apartment");
      if (!first) first = p;
      continue;
    }
    let carried = p.mass;
    for (const q of locked) {
      if (q.id === p.id) continue;
      if (q.y <= p.y + 0.05) continue;
      if (p.kind === "column" || p.kind === "stud") {
        const close = Math.abs(q.x - p.x) < 1.25 || q.col === p.col;
        if (!close) continue;
        const peers = locked.filter(
          (v) => (v.kind === "column" || v.kind === "stud") && Math.abs(v.y - p.y) < 0.5,
        ).length;
        const share = 1 / Math.max(1, peers);
        if (q.kind === "slab" || q.kind === "plate" || q.kind === "joist" || q.kind === "rafter" || q.kind === "sill" || q.kind === "wall" || q.kind === "roof") {
          carried += q.mass * share;
        } else if (Math.abs(q.x - p.x) < 0.5) {
          carried += q.mass;
        }
      } else {
        const ov = xOverlap(p, q);
        if (ov < 0.08) continue;
        carried += q.mass * Math.min(0.55, ov / Math.max(0.25, q.w * 0.35));
      }
    }
    if (p.temp < 220 && p.intact > 0.7) continue;
    const load = carried * G;
    const fy = fyOf(p);
    const em = p.material === "steel" ? eFactor(p.temp) : 1;
    const vert = p.kind === "stud" || p.kind === "column";
    const cap = fy * em * (vert ? 10 : 5) * p.mass * G * (vert ? 1.8 : 1);
    if ((load > cap && fy < 0.85) || p.intact < 0.28) {
      unlock(p, s.shape === "house" || s.shape === "apartment");
      if (!first) first = p;
    }
  }
  return first;
}

function axes(p: Piece): [number, number][] {
  const c = Math.cos(p.theta);
  const s = Math.sin(p.theta);
  return [
    [c, s],
    [-s, c],
  ];
}

function project(p: Piece, ax: number, ay: number): { min: number; max: number } {
  const c = Math.cos(p.theta);
  const s = Math.sin(p.theta);
  const hx = p.w / 2;
  const hy = p.h / 2;
  const corners = [
    [p.x + c * hx - s * hy, p.y + s * hx + c * hy],
    [p.x - c * hx - s * hy, p.y - s * hx + c * hy],
    [p.x - c * hx + s * hy, p.y - s * hx - c * hy],
    [p.x + c * hx + s * hy, p.y + s * hx - c * hy],
  ];
  let min = Infinity;
  let max = -Infinity;
  for (const [x, y] of corners) {
    const d = x * ax + y * ay;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { min, max };
}

function sat(a: Piece, b: Piece): { nx: number; ny: number; depth: number } | null {
  const list = axes(a).concat(axes(b));
  let minDepth = Infinity;
  let nx = 1;
  let ny = 0;
  for (const [ax, ay] of list) {
    const pa = project(a, ax, ay);
    const pb = project(b, ax, ay);
    const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
    if (overlap <= 0) return null;
    if (overlap < minDepth) {
      minDepth = overlap;
      nx = ax;
      ny = ay;
    }
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx * nx + dy * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { nx, ny, depth: minDepth };
}

function lowestY(p: Piece): number {
  const c = Math.cos(p.theta);
  const s = Math.sin(p.theta);
  const hx = p.w / 2;
  const hy = p.h / 2;
  return Math.min(
    p.y + s * hx + c * hy,
    p.y - s * hx + c * hy,
    p.y - s * hx - c * hy,
    p.y + s * hx - c * hy,
  );
}

function terrain(x: number, z: number, pit: Pit | null): number {
  if (!pit) return 0;
  if (x < pit.left || x > pit.right) return 0;
  if (z < pit.near || z > pit.far) return 0;
  return -pit.depth;
}

function capacityN(p: Piece): number {
  const fy = fyOf(p);
  const em = p.material === "steel" ? eFactor(p.temp) : 1;
  const vert = p.kind === "stud" || p.kind === "column";
  return fy * em * (vert ? 16 : 6) * p.mass * G;
}

export function integratePieces(pieces: Piece[], pit: Pit | null, dt: number, width: number): number {
  let ke = 0;
  const dyn = pieces.filter((p) => p.dynamic);
  for (const p of dyn) {
    p.vy -= G * dt;
    p.vx *= Math.exp(-1.6 * dt);
    p.vz *= Math.exp(-1.6 * dt);
    p.omega *= Math.exp(-2.2 * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.theta += p.omega * dt;
    ke += 0.5 * p.mass * (p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
  }

  for (const p of dyn) {
    const gy = terrain(p.x, p.z, pit);
    const low = lowestY(p);
    if (low < gy) {
      const push = gy - low;
      p.y += push;
      if (p.vy < 0) p.vy = Math.abs(p.vy) < 0.55 ? 0 : p.vy * -0.12;
      p.vx *= 0.55;
      p.vz *= 0.55;
      p.omega *= 0.4;
    }
    if (pit && p.y < 0.95) {
      const r = 0.22;
      if (p.x < pit.left + r) {
        p.x = pit.left + r;
        p.vx = Math.max(0, p.vx) * 0.1;
      }
      if (p.x > pit.right - r) {
        p.x = pit.right - r;
        p.vx = Math.min(0, p.vx) * 0.1;
      }
      if (p.z < pit.near + r) {
        p.z = pit.near + r;
        p.vz = Math.max(0, p.vz) * 0.1;
      }
      if (p.z > pit.far - r) {
        p.z = pit.far - r;
        p.vz = Math.min(0, p.vz) * 0.1;
      }
    }
    if (lowestY(p) < terrain(p.x, p.z, pit) + 0.12) {
      p.vx *= Math.exp(-5 * dt);
      p.vz *= Math.exp(-5 * dt);
      p.omega *= Math.exp(-6 * dt);
    }
    if (p.x < -0.4) {
      p.x = -0.4;
      p.vx *= -0.2;
    }
    if (p.x > width + 0.4) {
      p.x = width + 0.4;
      p.vx *= -0.2;
    }
    if (p.y < -1.6) {
      p.y = -1.6;
      p.vy = 0;
    }
  }

  const n = dyn.length;
  const cap = Math.min(n, 72);
  for (let i = 0; i < cap; i++) {
    const a = dyn[i];
    for (let j = i + 1; j < cap; j++) {
      const b = dyn[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx * dx + dy * dy > 4) continue;
      const hit = sat(a, b);
      if (!hit || hit.depth > 0.45) continue;
      const push = hit.depth * 0.5;
      a.x -= hit.nx * push;
      a.y -= hit.ny * push;
      b.x += hit.nx * push;
      b.y += hit.ny * push;
      const rel = (b.vx - a.vx) * hit.nx + (b.vy - a.vy) * hit.ny;
      if (rel < 0) {
        const jimp = -rel * 0.35;
        a.vx -= hit.nx * jimp;
        a.vy -= hit.ny * jimp;
        b.vx += hit.nx * jimp;
        b.vy += hit.ny * jimp;
      }
    }
  }

  const toUnlock: Piece[] = [];
  for (const p of dyn) {
    for (const q of pieces) {
      if (q.dynamic || q.id === p.id) continue;
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      if (dx * dx + dy * dy > 6) continue;
      const hit = sat(p, q);
      if (!hit) continue;
      p.x += hit.nx * hit.depth;
      p.y += hit.ny * hit.depth;
      const vn = p.vx * hit.nx + p.vy * hit.ny;
      if (vn < 0) {
        const impact = p.mass * vn * vn;
        const groundSill = q.kind === "sill" && q.layer === 0;
        const keep =
          q.kind === "log" ||
          q.kind === "tree" ||
          q.kind === "couch" ||
          q.kind === "wall" ||
          q.kind === "roof" ||
          (q.kind === "sill" && q.layer === 0);
        if (!groundSill && !keep && impact > capacityN(q) * 0.85) toUnlock.push(q);
        p.vx -= hit.nx * vn * 1.15;
        p.vy -= hit.ny * vn * 1.15;
      }
    }
  }
  for (const q of toUnlock) {
    if (!q.dynamic) unlock(q, true);
  }

  return ke;
}

export function pieceCgrav(pieces: Piece[]): { x: number; y: number; mass: number } {
  let m = 0;
  let x = 0;
  let y = 0;
  for (const p of pieces) {
    m += p.mass;
    x += p.mass * p.x;
    y += p.mass * p.y;
  }
  if (m < 1) return { x: 0, y: 0, mass: 0 };
  return { x: x / m, y: y / m, mass: m };
}

export function piecesSettled(pieces: Piece[]): boolean {
  const dyn = pieces.filter((p) => p.dynamic);
  if (dyn.length < 4) return false;
  let ke = 0;
  let restSum = 0;
  for (const p of pieces) {
    restSum += p.restX;
    if (p.dynamic) ke += p.vx * p.vx + p.vy * p.vy;
  }
  if (ke > dyn.length * 1.5) return false;
  const roofs = pieces.filter((p) => p.kind === "roof" || p.kind === "rafter");
  if (roofs.length > 0) {
    const roofLoose = roofs.filter((p) => p.dynamic).length;
    if (roofLoose < Math.max(1, Math.ceil(roofs.length * 0.5))) return false;
  }
  if (dyn.length >= pieces.length * 0.7) return true;
  const mid = restSum / Math.max(1, pieces.length);
  const structural = (p: Piece) => p.kind !== "sill" && p.kind !== "tree" && p.kind !== "couch" && p.kind !== "log";
  const leftRoof = pieces.filter((p) => (p.kind === "rafter" || p.kind === "roof") && p.restX < mid);
  if (leftRoof.length > 0) {
    const roofLoose = leftRoof.filter((p) => p.dynamic).length;
    if (roofLoose < Math.max(1, leftRoof.length * 0.5)) return false;
  }
  const high = pieces.filter((p) => p.restX < mid && p.restY > 1.55 && structural(p));
  if (high.length > 0) {
    const highLoose = high.filter((p) => p.dynamic).length;
    if (highLoose < high.length * 0.45) return false;
  }
  const left = pieces.filter((p) => p.restX < mid && structural(p));
  const leftLoose = left.filter((p) => p.dynamic).length;
  return left.length > 0 && leftLoose >= left.length * 0.55;
}

export function hottest(pieces: Piece[]): Piece | null {
  let h: Piece | null = null;
  for (const p of pieces) {
    if (!h || p.temp > h.temp) h = p;
  }
  return h;
}
