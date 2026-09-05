/**
 * Piece world — bonfire, houses, apartment.
 *
 * What: Build discrete members, ignite one of them, heat them, walk fire to
 * neighbors, unlock a member when remaining strength cannot carry the load,
 * then integrate gravity and collisions.
 * Why a piece world at all: the truther claim is a scale error ("a tower is
 * a chimney"). A log crib and a house are things you have seen fall into
 * their own footprint. Same three laws, smaller stack.
 *
 * Accusation map:
 *   painted-on fire          -> ignitePieces, spreadPieces
 *   tree lights the house    -> ignitePieces (tree only) + the couch gate in spreadPieces
 *   demolition kick          -> unlockPiece zeroes vx, vz (Newton 1)
 *   gravity faked            -> integratePieces: vy -= G * dt
 *   logs shrink in place     -> they don't; 4 sections + 3 joins, stick holds until a join chars
 *   boiling-noodle crib      -> a stick is one body until a join chars; SAT prefers Y for stacks
 *   spinning walls / flying 2x4s -> omega capped by length; inelastic (J=0); boards drop flat
 *   houses never drop        -> evaluatePieces house branch + piecesSettled
 *   jumping wall panels      -> 3-axis AABB; stacked contacts separate in Y
 *   bouncing logs / roofs    -> inelastic contacts; slop; no +vy; supported pieces sleep
 *   nothing rotates          -> theta/omega exist; unlock is a small flop, not a centrifuge
 *   apartment never falls    -> two dead columns in a bay drops the nearby shell
 *   building-width facade    -> long faces are bay × course panels, not one 14 m strip
 *   logs don't darken        -> woodRgb tracks surface char from 80 °C; joins do not shatter the stick first
 */
import { G } from "./constants.ts";
import { eFactor, fyFactor } from "./steel.ts";
import type { Piece, Pit, Scenario } from "./types.ts";
import { woodFy } from "./wood.ts";

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
  stickId = 0,
  seg = 0,
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
    stickId,
    seg,
  };
}

export function buildPieces(s: Scenario): { pieces: Piece[]; pit: Pit | null } {
  seq = 1;
  if (s.shape === "bonfire") return buildBonfire(s);
  if (s.shape === "house") return buildHouse(s);
  if (s.shape === "apartment") return buildApartment(s);
  return { pieces: [], pit: null };
}

/** Four length-sections per stick, three joins. A stick is one log until a join chars. */
export const LOG_SECTIONS = 4;
export const LOG_JOINS = 3;
const LOG_LEN = 1.92;
const LOG_DIA = 0.15;
const JOIN_LEN = 0.1;

/**
 * Lay a stick end-to-end: log, join, log, join, log, join, log.
 * Why not 4 equal centres of LOG_LEN: that overlapped the joins, so SAT
 * thought neighbouring sections were colliding and shoved them apart in Z.
 */
function stickLayout(): { kind: "log" | "join"; seg: number; along: number; len: number }[] {
  const segLen = (LOG_LEN - JOIN_LEN * LOG_JOINS) / LOG_SECTIONS;
  const out: { kind: "log" | "join"; seg: number; along: number; len: number }[] = [];
  let cursor = -LOG_LEN / 2;
  for (let sIdx = 0; sIdx < LOG_SECTIONS; sIdx++) {
    out.push({ kind: "log", seg: sIdx, along: cursor + segLen / 2, len: segLen });
    cursor += segLen;
    if (sIdx < LOG_JOINS) {
      out.push({ kind: "join", seg: sIdx, along: cursor + JOIN_LEN / 2, len: JOIN_LEN });
      cursor += JOIN_LEN;
    }
  }
  return out;
}

const STICK_LAYOUT = stickLayout();

function buildBonfire(s: Scenario): { pieces: Piece[]; pit: Pit | null } {
  const pitW = s.width - 0.32;
  const half = pitW / 2;
  const pit: Pit = { left: 0.16, right: s.width - 0.16, depth: 0.42, near: -half, far: half };
  const cx = s.width / 2;
  const dia = LOG_DIA;
  const layers = 10;
  const per = 4;
  const span = 1.08;
  const pieces: Piece[] = [];
  const mass = 14 / LOG_SECTIONS;
  let stickId = 1;
  for (let layer = 0; layer < layers; layer++) {
    const alongZ = layer % 2 === 0;
    const y = -pit.depth + dia * 0.55 + layer * dia;
    for (let i = 0; i < per; i++) {
      const t = i / Math.max(1, per - 1);
      // Hash jitter on the crib axis, not along the stick — a log is a line.
      const jitter = (hash(layer * 17 + i * 9) - 0.5) * 0.11;
      const off = (t - 0.5) * span + jitter;
      const col = t < 0.34 ? 0 : t > 0.66 ? 4 : 2;
      const sid = stickId++;
      for (const bit of STICK_LAYOUT) {
        const m = bit.kind === "join" ? 3.2 : mass;
        const thick = bit.kind === "join" ? dia * 1.04 : dia;
        if (alongZ) {
          pieces.push(piece(bit.kind, "wood", cx + off, y, thick, thick, 0, m, layer, col, bit.along, true, bit.len, sid, bit.seg));
        } else {
          pieces.push(piece(bit.kind, "wood", cx + bit.along, y, bit.len, thick, 0, m, layer, col, off, false, thick, sid, bit.seg));
        }
      }
    }
  }
  return { pieces, pit };
}

function buildHouse(s: Scenario): { pieces: Piece[]; pit: Pit | null } {
  const stories = Math.max(1, s.floors);
  const W = s.width;
  const D = 6.4;
  const H = s.floorH;
  const wallT = 0.14;
  const pieces: Piece[] = [];
  const xs = [0.28, W * 0.26, W * 0.5, W * 0.74, W - 0.28];
  const zs = [-D * 0.38, 0, D * 0.38];

  for (let st = 0; st < stories; st++) {
    const y0 = st * H;
    // Short joists, not one 8 m 2×4. Four spans × eight rows.
    for (let j = 0; j < 8; j++) {
      const z = (j / 7 - 0.5) * (D - 0.5);
      for (let span = 0; span < 4; span++) {
        const x = ((span + 0.5) / 4) * W;
        pieces.push(piece("joist", "wood", x, y0 + 0.18, W / 4 - 0.08, 0.12, 0, 5, st * 5 + 3, span === 0 ? 0 : span === 3 ? 4 : 2, z, false, 0.1));
      }
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

    const wallH = H - 0.18;
    // Five bays × two courses per long face, three × two per gable.
    // A wall is boards. Boards fall. Smaller boards do not cartwheel.
    const faceBays = 5;
    const faceRows = 2;
    for (const zSign of [1, -1]) {
      for (let k = 0; k < faceBays; k++) {
        for (let r = 0; r < faceRows; r++) {
          const wx = (W * (k + 0.5)) / faceBays;
          const ww = W / faceBays - 0.04;
          const hh = wallH / faceRows - 0.04;
          const wy = y0 + 0.14 + (r + 0.5) * (wallH / faceRows);
          pieces.push(piece("wall", "wood", wx, wy, ww, hh, 0, 8, st * 5 + 2, k, zSign * (D / 2 - wallT / 2), false, wallT));
        }
      }
    }
    for (const xLeft of [true, false]) {
      const x = xLeft ? wallT / 2 : W - wallT / 2;
      const col = xLeft ? 0 : 4;
      for (let k = 0; k < 3; k++) {
        for (let r = 0; r < faceRows; r++) {
          const z = (k / 2 - 0.5) * (D - 0.35);
          const hh = wallH / faceRows - 0.04;
          const wy = y0 + 0.14 + (r + 0.5) * (wallH / faceRows);
          pieces.push(piece("wall", "wood", x, wy, wallT, hh, 0, 9, st * 5 + 2, col, z, false, D * 0.3));
        }
      }
    }
  }

  const roofY = stories * H;
  const pitch = 0.5;
  const run = W / 2;
  const rise = Math.tan(pitch) * run;
  const len = Math.sqrt(run * run + rise * rise);
  const midY = roofY + rise * 0.5;
  for (const z of [-D * 0.32, 0, D * 0.32]) {
    pieces.push(piece("roof", "wood", W * 0.25, midY, len, 0.09, -pitch, 22, stories * 5, 0, z, false, D * 0.34));
    pieces.push(piece("roof", "wood", W * 0.75, midY, len, 0.09, pitch, 22, stories * 5, 4, z, false, D * 0.34));
  }
  pieces.push(piece("plate", "wood", W / 2, roofY + rise, 0.16, 0.12, 0, 36, stories * 5, 2, 0, false, D + 0.2));

  const treeH = Math.min(2.05, H * 0.78);
  // Against the front wall, next to each other — not 2 m of open air.
  pieces.push(piece("tree", "wood", 1.58, treeH * 0.52, 0.9, treeH, 0, 18, 0, 0, 2.58, false, 0.9));
  pieces.push(piece("couch", "wood", 3.18, 0.4, 2.05, 0.78, 0, 48, 0, 1, 2.58, false, 0.92));
  return { pieces, pit: null };
}

function buildApartment(s: Scenario): { pieces: Piece[]; pit: Pit | null } {
  const n = s.floors;
  const W = s.width;
  const H = s.floorH;
  const D = W * 0.78;
  const xs = [0.1, 0.3, 0.5, 0.7, 0.9].map((t) => t * W);
  const zs = [-D * 0.32, 0, D * 0.32];
  const pieces: Piece[] = [];
  const colMass = 420;
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
    // Bay slabs, not one plate the depth of the building.
    for (let b = 0; b < 4; b++) {
      const x = ((b + 0.5) / 4) * W;
      for (let zi = 0; zi < zs.length; zi++) {
        pieces.push(
          piece("slab", "steel", x, y0 + H - 0.1, W * 0.26, 0.16, 0, 280, i, b === 0 ? 0 : b === 3 ? 4 : 2, zs[zi], false, D * 0.3),
        );
      }
    }
    const wallH = H - 0.1;
    // Six bays × three courses per long face. Collapse debris is masonry,
    // not a 14 m ribbon the width of the building.
    const bays = 6;
    const courses = 3;
    for (const zSign of [1, -1]) {
      for (let k = 0; k < bays; k++) {
        for (let r = 0; r < courses; r++) {
          const wx = (W * (k + 0.5)) / bays;
          const ww = W / bays - 0.05;
          const hh = wallH / courses - 0.04;
          const wy = y0 + 0.08 + (r + 0.5) * (wallH / courses);
          const col = Math.min(4, Math.floor(((k + 0.5) / bays) * 5));
          pieces.push(piece("wall", "wood", wx, wy, ww, hh, 0, 16, i, col, zSign * (D / 2 - wallT / 2), false, wallT));
        }
      }
    }
    for (const xLeft of [true, false]) {
      const x = xLeft ? wallT / 2 : W - wallT / 2;
      const col = xLeft ? 0 : 4;
      for (let zi = 0; zi < 4; zi++) {
        const z = ((zi + 0.5) / 4 - 0.5) * (D - 0.2);
        for (let r = 0; r < courses; r++) {
          const hh = wallH / courses - 0.04;
          const wy = y0 + 0.08 + (r + 0.5) * (wallH / courses);
          pieces.push(piece("wall", "wood", x, wy, wallT, hh, 0, 14, i, col, z, false, D * 0.24));
        }
      }
    }
    for (const px of [0.3, 0.5, 0.7]) {
      const col = px < 0.4 ? 1 : px > 0.6 ? 3 : 2;
      for (const zSign of [-1, 1]) {
        for (let r = 0; r < 2; r++) {
          const hh = wallH * 0.46;
          const wy = y0 + 0.1 + (r + 0.5) * (wallH * 0.48);
          pieces.push(piece("wall", "wood", W * px, wy, wallT, hh, 0, 12, i, col, zSign * D * 0.16, false, D * 0.26));
        }
      }
    }
  }
  for (let zi = 0; zi < zs.length; zi++) {
    pieces.push(piece("slab", "steel", W / 2, n * H + 0.08, W * 1.04, 0.16, 0, 420, n, 2, zs[zi], false, D * 0.34));
  }
  const py = n * H + 0.18 + 0.42;
  for (const zSign of [1, -1]) {
    for (let k = 0; k < 6; k++) {
      const wx = (W * (k + 0.5)) / 6;
      pieces.push(piece("wall", "wood", wx, py, W / 6 - 0.04, 0.84, 0, 8, n, Math.min(4, k), zSign * (D / 2), false, wallT));
    }
  }
  for (const xLeft of [true, false]) {
    const x = xLeft ? wallT / 2 : W - wallT / 2;
    const col = xLeft ? 0 : 4;
    for (let zi = 0; zi < 4; zi++) {
      const z = ((zi + 0.5) / 4 - 0.5) * (D - 0.2);
      pieces.push(piece("wall", "wood", x, py, wallT, 0.84, 0, 7, n, col, z, false, D * 0.24));
    }
  }
  return { pieces, pit: null };
}

/**
 * What: Light ONE thing.
 * Why not a whole wall: a painted-on fire is the cheat we are accused of.
 * Bonfire = lowest log. House = the Christmas tree, nothing else.
 * Apartment = one corner unit on the ignition story.
 * Towers are handled in SimEngine, not here.
 */
export function ignitePieces(pieces: Piece[], s: Scenario): void {
  if (s.noFire) return;
  if (s.shape === "bonfire") {
    // Boy Scout one-match: a single log at the kerosene corner, not a whole face.
    let best: Piece | null = null;
    let score = Infinity;
    for (const p of pieces) {
      if (p.kind !== "log") continue;
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
      // Match on dry needles — a pretty fire, not a furnace. The couch
      // waits until this has been going.
      tree.burning = 0.4;
      tree.stripped = 0.55;
      tree.fuel = 1;
      tree.temp = 230;
    }
    return;
  }
  const lo = s.impactLo;
  const hi = s.impactHi;
  for (const p of pieces) {
    if (p.kind === "sill" && p.layer === 0) continue;
    if (s.shape === "apartment") {
      // Match is the room — wood walls of one corner unit. Steel in that
      // room heats from the compartment. It is not the fuel.
      if (p.kind !== "wall") continue;
      if (p.layer !== lo - 1) continue;
      if (p.col !== 0) continue;
      p.burning = 0.55;
      p.stripped = 0.45;
      p.fuel = 1;
      p.temp = 180;
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

/**
 * What: Each burning member heats toward a gas temperature and loses fuel.
 * Why wood `intact` drops here: charcoal is section loss. A stud that is
 * 30% charcoal cannot carry what a green stud can. Colour is not strength;
 * `intact` is.
 */
export function heatPieces(pieces: Piece[], s: Scenario, dt: number): void {
  const heatMul = s.heatRate;
  for (const p of pieces) {
    if (p.failed && p.dynamic && p.burning < 0.05) continue;
    const gas =
      p.kind === "tree"
        ? 20 + 520 * p.burning
        : p.kind === "couch"
          ? 20 + 1100 * p.burning
          : 20 + 880 * p.burning;
    const tau = (
      p.kind === "tree"
        ? (p.burning > 0.15 ? 520 : 1100)
        : p.kind === "couch"
          ? (p.burning > 0.15 ? 640 : 1600)
      : p.kind === "log" || p.kind === "join"
        ? (p.burning > 0.15 ? 480 : 1600)
        : p.material === "steel" && p.burning > 0.15
          ? 1600
          : p.stripped > 0.4
            ? 4200
            : 11000
    ) / heatMul;
    if (p.burning > 0.05) {
      p.temp += ((gas - p.temp) / tau) * dt;
    } else if (p.material !== "steel") {
      // Slow cool. Steel in an apartment sits in the compartment gas
      // (heatCompartments) — do not yank it back to 20 °C every frame.
      p.temp += ((20 - p.temp) / Math.max(tau, 4000 / heatMul)) * dt;
    }
    if (p.temp > 1100) p.temp = 1100;
    if (p.temp < 0) p.temp = 0;
    if (p.kind === "tree" && p.burning > 0.05 && p.fuel > 0.18) {
      p.burning = Math.min(0.82, p.burning + 0.00042 * heatMul * dt);
    }
    if (p.kind === "couch" && p.burning > 0.05 && p.fuel > 0.12) {
      p.burning = Math.min(1, p.burning + 0.0011 * heatMul * dt);
    }
    if (p.burning > 0 && p.fuel > 0) {
      const burn = p.burning * heatMul * dt;
      // Bottom logs sit in the hottest air. A real pit eats the base first.
      const layerBoost =
        p.kind === "log"
          ? 1 + Math.max(0, 5 - p.layer) * 0.45
          : p.kind === "join"
            ? 1.4 + Math.max(0, 5 - p.layer) * 0.25
            : p.kind === "tree"
            ? 0.35
            : p.kind === "couch"
              ? 2.7
              : s.shape === "apartment" && p.kind === "wall"
                ? 0.22
              : s.shape === "house" && (p.kind === "stud" || p.kind === "joist" || p.kind === "wall" || p.kind === "roof" || p.kind === "plate")
                ? 2.4
                : 1;
      if (p.material !== "steel") {
        p.fuel = Math.max(0, p.fuel - 0.0016 * burn * layerBoost);
      }
      if (p.material === "wood") {
        // Char is remaining section (`intact`), not a scale animation.
        // IRL a burning stick does not shrink into a toothpick — it breaks
        // and the pieces fall. Size stays; colour and strength change; then
        // evaluatePieces unlocks the charcoal and gravity takes it.
        p.intact = Math.max(0.02, p.intact - 0.0012 * burn * layerBoost);
      }
      if (p.fuel < 0.06) p.burning *= Math.exp(-dt / 700);
    } else if (p.burning > 0) {
      p.burning *= Math.exp(-dt / 350);
    }
  }
  // Joins track the wood on either side. They are heat sensors, not a
  // second fuel that burns through first and shatters a green stick.
  for (const p of pieces) {
    if (p.kind !== "join" || !p.stickId) continue;
    const logs = stickMembers(pieces, p.stickId).filter((q) => q.kind === "log");
    const left = logs.find((q) => q.seg === p.seg);
    const right = logs.find((q) => q.seg === p.seg + 1);
    if (left) p.temp = Math.max(p.temp, left.temp * 0.94);
    if (right) p.temp = Math.max(p.temp, right.temp * 0.94);
    if (p.temp > 1100) p.temp = 1100;
  }
  heatCompartments(pieces, s, dt);
}

/**
 * Used to teleport locked layers down as logs shrank. That was the "melting
 * crib" look. Gravity now drops charred sections, so this is a no-op kept
 * only so a critic searching for restack finds the explanation.
 */
export function restackBonfire(_pieces: Piece[], _pit: Pit): void {}

function surfaceGap(a: Piece, b: Piece): number {
  const gx = Math.max(0, Math.abs(b.x - a.x) - (a.w + b.w) * 0.5);
  const gy = Math.max(0, Math.abs(b.y - a.y) - (a.h + b.h) * 0.5);
  const gz = Math.max(0, Math.abs(b.z - a.z) - (a.depth + b.depth) * 0.5);
  return Math.hypot(gx, gy, gz);
}

/**
 * Enclosed room, not open air. Burning walls set a gas temperature for
 * every member in that bay. Adjacent bays catch through the party wall.
 * The floor above catches slower. Steel in the room heats; it does not
 * have to be "on fire."
 */
function heatCompartments(pieces: Piece[], s: Scenario, dt: number): void {
  if (s.shape !== "apartment") return;
  const heatMul = s.heatRate;
  const units = new Map<string, { fire: number; n: number; members: Piece[] }>();
  const keyOf = (p: Piece) => `${p.layer}:${p.col}`;
  for (const p of pieces) {
    const k = keyOf(p);
    let u = units.get(k);
    if (!u) {
      u = { fire: 0, n: 0, members: [] };
      units.set(k, u);
    }
    u.members.push(p);
    if (p.kind === "wall" && p.burning > 0.12 && p.fuel > 0.05) {
      u.fire += p.burning;
      u.n += 1;
    }
  }
  for (const [k, u] of units) {
    const avg = u.n > 0 ? u.fire / u.n : 0;
    const involved = Math.min(1, 0.5 * avg + 0.5 * Math.min(1, u.n / 8));
    if (involved < 0.08) continue;
    const gas = 20 + 880 * involved;
    const tau = 2400 / heatMul;
    for (const p of u.members) {
      p.temp += ((gas - p.temp) / tau) * dt;
      if (p.temp > 1100) p.temp = 1100;
      if (p.kind === "wall" && p.temp > 250 && p.fuel > 0.08 && p.burning < 0.2) {
        p.burning = Math.max(p.burning, 0.28 * involved);
        p.stripped = Math.max(p.stripped, 0.3);
      }
    }
    const sep = k.indexOf(":");
    const layer = Number(k.slice(0, sep));
    const col = Number(k.slice(sep + 1));
    if (involved > 0.32) {
      const leak = involved * 0.28 * heatMul * dt;
      for (const dcol of [-1, 1]) {
        const n = units.get(`${layer}:${col + dcol}`);
        if (!n) continue;
        for (const p of n.members) {
          if (p.kind !== "wall") continue;
          p.temp += leak;
          if (p.temp > 1100) p.temp = 1100;
          if (p.temp > 270 && p.fuel > 0.08) {
            p.burning = Math.max(p.burning, 0.2);
            p.stripped = Math.max(p.stripped, 0.25);
          }
        }
      }
    }
    if (involved > 0.55) {
      const up = units.get(`${layer + 1}:${col}`);
      if (up) {
        const leak = involved * 0.035 * heatMul * dt;
        for (const p of up.members) {
          p.temp += leak;
          if (p.temp > 1100) p.temp = 1100;
          if (p.kind === "wall" && p.temp > 340 && p.fuel > 0.08) {
            p.burning = Math.max(p.burning, 0.18);
            p.stripped = Math.max(p.stripped, 0.2);
          }
        }
      }
    }
  }
}

/**
 * Neighbor heat.
 *
 * What: A burning member warms every other member within reach.
 * When the neighbor's own temperature passes its ignition point, that
 * neighbor lights. Distance is 3D. Heat prefers "up."
 *
 * CRITIC: "The left wall just catches fire."
 * House gate: the tree cannot heat anything except the couch until the
 * couch is actually lit (`couchLit`). Tree -> couch -> room is enforced
 * here, not in the renderer.
 *
 * CRITIC: "maxD is a fudge so fire jumps."
 * Range is surface gap, not center-to-center. Adjacent bays touch, so
 * fire walks. Two metres of open air does not. Fire rises farther than
 * it throws sideways — a plume to the ceiling and the floor above, not a
 * 6-foot bubble.
 *
 * CRITIC: "The whole crib lights because everything is within 2 m."
 * Bonfire reach is contact: ~0.2 m sideways, a layer up. Same-stick
 * sections still couple so heat walks a log through its joins. Fire rises.
 */
export function spreadPieces(pieces: Piece[], s: Scenario, dt: number): void {
  if (s.noFire) return;
  // Apartment fire is a compartment gas layer, not 18 walls torching
  // the slab above by contact. heatCompartments owns that walk.
  if (s.shape === "apartment") return;
  const horiz = s.fireSpread;
  const rate = s.shape === "bonfire" ? 0.055 : s.shape === "house" ? 0.09 : 0.045;
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
      const sameStick = a.stickId > 0 && a.stickId === b.stickId;
      let d: number;
      if (s.shape === "bonfire") {
        const d2 = dx * dx + dy * dy + dz * dz;
        const maxD = sameStick ? 0.55 : dy > 0.08 ? 0.42 : 0.22;
        if (d2 > maxD * maxD) continue;
        d = Math.sqrt(d2) + 0.04;
      } else {
        // House / apartment: air gap between the boxes, not the distance
        // between centroids. A 2 m stud spacing is not a 2 m flame.
        const gap = surfaceGap(a, b);
        // Sideways: a hand's reach. House plume reaches the floor above.
        // Apartment: one slab, not two stories in a minute.
        const maxD =
          s.shape === "house"
            ? dy > 0.08 ? 1.2 : 0.32
            : dy > 0.08
              ? 0.48
              : 0.32;
        if (gap > maxD) continue;
        d = 0.4 + gap;
      }
      const up = dy > 0.04 ? (s.shape === "bonfire" ? 2.4 : s.shape === "house" && dy > 0.4 ? 2.6 : 1.35) : 1;
      const side = horiz > 0 ? 1 : dx > 0.05 ? 0.08 : 1;
      const src = a.kind === "tree" ? 0.75 : a.kind === "couch" ? 2.25 : 1;
      if (s.shape === "house" && a.kind === "tree" && b.kind !== "couch" && b.kind !== "tree" && !couchLit) continue;
      const leak = (rate * a.burning * up * side * src * dt) / d;
      // Steel already in the fire shouldn't get flash-cooked by every
      // roommate in the same bay — that's how a slab hit 468 °C in 6 s.
      const cook = a.material === "steel" && b.material === "steel" ? 0.22 : 1;
      b.temp += leak * 90 * cook;
      if (b.temp > 1100) b.temp = 1100;
      if (horiz === 0 && dx > 0.15 && dy < 0.2) continue;
      if (b.kind === "sill" && b.layer === 0) continue;
      if (b.material === "steel") continue;
      const catchT =
        b.material === "steel"
          ? 420
          : b.kind === "couch"
            ? 280
            : b.kind === "tree"
              ? 140
              : b.kind === "join"
                ? 190
                : a.kind === "tree" || a.kind === "couch"
                  ? 185
                  : 220;
      if (b.temp > catchT && b.fuel > 0.08) {
        const catchBurn = b.kind === "couch" ? 0.78 : b.kind === "tree" ? 0.85 : a.kind === "tree" ? 0.4 : 0.22;
        b.burning = Math.max(b.burning, catchBurn * Math.min(1, up * Math.max(horiz, 0.35)));
        b.stripped = Math.max(b.stripped, 0.35);
      }
    }
  }
}

function zNear(a: Piece, b: Piece, pad = 0.04): boolean {
  const a0 = a.z - a.depth * 0.5;
  const a1 = a.z + a.depth * 0.5;
  const b0 = b.z - b.depth * 0.5;
  const b1 = b.z + b.depth * 0.5;
  return Math.min(a1, b1) + pad >= Math.max(a0, b0);
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
  const reach = (p.kind === "log" || p.kind === "join" ? 0.28 : Math.max(p.h, 1.2)) + 0.45;
  for (const q of locked) {
    if (q.id === p.id) continue;
    if (p.y < q.y + 0.02) continue;
    if (p.y > q.y + reach) continue;
    if (xOverlap(p, q) > 0.05 && zNear(p, q, bonfire ? 0.16 : 0.08)) return true;
  }
  return false;
}

/** A join holds while below ignition and both neighbours are still mostly wood. */
function joinHolds(j: Piece, pieces: Piece[]): boolean {
  if (j.kind !== "join" || j.temp >= 280) return false;
  const members = stickMembers(pieces, j.stickId);
  const left = members.find((q) => q.kind === "log" && q.seg === j.seg);
  const right = members.find((q) => q.kind === "log" && q.seg === j.seg + 1);
  if (left && left.intact <= 0.5) return false;
  if (right && right.intact <= 0.5) return false;
  return true;
}

function stickMembers(pieces: Piece[], stickId: number): Piece[] {
  const out: Piece[] = [];
  for (const p of pieces) if (p.stickId === stickId && (p.kind === "log" || p.kind === "join")) out.push(p);
  return out;
}

/**
 * Connected component of one stick through joins that still hold.
 * Why: four sections are one log until a join chars. Then it is two logs.
 */
function weldedGroup(pieces: Piece[], p: Piece): Piece[] {
  if (!p.stickId) return [p];
  const members = stickMembers(pieces, p.stickId);
  const logs = members.filter((q) => q.kind === "log");
  const joins = members.filter((q) => q.kind === "join");
  const holding = new Set<number>();
  for (const j of joins) {
    if (!joinHolds(j, pieces)) continue;
    holding.add(j.seg);
  }
  const seen = new Set<number>();
  const stack: Piece[] = [p];
  const group: Piece[] = [];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur.id)) continue;
    seen.add(cur.id);
    group.push(cur);
    if (cur.kind === "log") {
      for (const j of joins) {
        if (j.seg !== cur.seg && j.seg !== cur.seg - 1) continue;
        if (!holding.has(j.seg)) continue;
        if (!seen.has(j.id)) stack.push(j);
        const otherSeg = j.seg === cur.seg ? cur.seg + 1 : cur.seg - 1;
        const other = logs.find((q) => q.seg === otherSeg);
        if (other && !seen.has(other.id)) stack.push(other);
      }
    } else if (cur.kind === "join" && holding.has(cur.seg)) {
      const left = logs.find((q) => q.seg === cur.seg);
      const right = logs.find((q) => q.seg === cur.seg + 1);
      if (left && !seen.has(left.id)) stack.push(left);
      if (right && !seen.has(right.id)) stack.push(right);
    }
  }
  return group;
}

/**
 * Unlock a member so gravity may integrate it.
 *
 * What: `dynamic = true`. If `drop` (houses, apartments, impact unlocks,
 * logs) then vx = vz = 0 and vy is a tiny downward nudge.
 * Why drop-only: giving joists a lateral kick looked like a demolition
 * charge. Things made of pieces fall down. They do not jump out of the
 * footprint. Tests assert vx === 0 when drop is true.
 */
export function unlockPiece(p: Piece, drop = false): void {
  p.failed = true;
  p.dynamic = true;
  void drop;
  // Spin is not a shove. A long joist at 3 rad/s has end speed ~12 m/s —
  // that was the flying 2×4 / boiling-noodle look. Cap by length so a
  // falling board flops, it does not centrifuge.
  const len = Math.max(p.w, p.h, p.depth, 0.2);
  let spin = 0.28 + hash(p.id + 7) * 0.55;
  if (p.kind === "log" || p.kind === "join") spin = 0.22 + hash(p.id) * 0.28;
  if (p.kind === "joist" || p.kind === "slab" || p.kind === "plate" || p.kind === "sill") spin *= 0.04;
  if (p.kind === "wall" || p.kind === "roof") spin *= 0.16;
  if (p.kind === "stud" || p.kind === "column") spin *= 0.55;
  const cap = (p.kind === "joist" || p.kind === "slab" || p.kind === "plate" || p.kind === "sill" ? 0.7 : 1.8) / len;
  spin = Math.min(spin, cap);
  if (p.kind === "log" || p.kind === "join") spin = Math.min(spin, 0.55);
  if (p.kind === "wall" || p.kind === "roof") spin = Math.min(spin, 0.35);
  p.omega = hash(p.id) >= 0.5 ? spin : -spin;
  p.vx = 0;
  p.vz = 0;
  p.vy = -0.15;
}

/**
 * What: For each still-locked member, is remaining strength enough?
 * Why house thresholds wait for charcoal: locking everyone so they would
 * not "pop out" also stopped the house burning down. The fix is not a
 * sideways kick — it is "char, then drop in the footprint."
 *
 * House rules of thumb (not hidden in the renderer):
 *   studs  fail once intact < 0.30
 *   joists/plate < 0.28
 *   roof drops after ~35% of nearby studs are dead, or it itself is charcoal
 *   walls linger until intact < 0.16 so the roof can fall in first
 */
export function evaluatePieces(pieces: Piece[], s: Scenario): Piece | null {
  let first: Piece | null = null;
  const locked = pieces.filter((p) => !p.dynamic);

  for (const p of locked) {
    if (p.kind === "sill" && p.layer === 0) continue;
    // Joins first: a stick is one log until the join is half charcoal or
    // at ignition, or either neighbouring section is. Then it is two.
    if (p.kind === "join") {
      const members = stickMembers(pieces, p.stickId);
      const left = members.find((q) => q.kind === "log" && q.seg === p.seg);
      const right = members.find((q) => q.kind === "log" && q.seg === p.seg + 1);
      const split =
        p.temp >= 280 ||
        (left !== undefined && left.intact <= 0.5) ||
        (right !== undefined && right.intact <= 0.5);
      if (!split) continue;
      unlockPiece(p, true);
      if (!first) first = p;
      continue;
    }
    if (p.kind === "log") {
      const group = weldedGroup(pieces, p);
      const supported = group.some((q) => hasSupport(q, locked, true));
      if (supported && p.intact > 0.4) continue;
      let sharedOmega: number | null = null;
      for (const q of group) {
        if (q.dynamic) continue;
        unlockPiece(q, true);
        if (sharedOmega === null) sharedOmega = q.omega;
        else q.omega = sharedOmega;
        if (!first) first = q;
      }
      continue;
    }
    if (p.kind === "tree" || p.kind === "couch") {
      if (p.intact > 0.3) continue;
      unlockPiece(p, true);
      if (!first) first = p;
      continue;
    }
    if (p.kind === "wall" || p.kind === "roof" || p.kind === "slab" || p.kind === "column") {
      if (s.shape === "apartment") {
        // Steel does not char. It loses yield with temperature (Eurocode 3).
        // A 6-dead-column gate on the brick meant a corner fire could never
        // drop the shell — 3 columns light, the box stays a box. Two columns
        // in a bay is a story mechanism; the mass above then has nothing
        // to sit on.
        if (p.kind === "column") {
          const fy = fyOf(p);
          if (fy < 0.55 && p.temp > 540) {
            unlockPiece(p, true);
            if (!first) first = p;
          } else if (p.layer > 0) {
            const below = pieces.some(
              (q) =>
                q.kind === "column" &&
                !q.dynamic &&
                q.layer === p.layer - 1 &&
                q.col === p.col &&
                Math.abs(q.z - p.z) < 0.8,
            );
            if (!below) {
              unlockPiece(p, true);
              if (!first) first = p;
            }
          }
          continue;
        }
        if (p.kind === "slab") {
          const cols = pieces.filter(
            (q) => q.kind === "column" && q.layer === p.layer && Math.abs(q.x - p.x) < Math.max(1.8, p.w * 0.7),
          );
          const live = cols.filter((q) => !q.dynamic).length;
          if (cols.length > 0 && live < 2) {
            unlockPiece(p, true);
            if (!first) first = p;
          }
          continue;
        }
        if (p.kind === "wall") {
          const layer = Math.min(p.layer, Math.max(0, s.floors - 1));
          const nearbyDead = pieces.filter(
            (q) =>
              q.kind === "column" &&
              q.layer === layer &&
              q.dynamic &&
              Math.abs(q.x - p.x) < 3.0 &&
              Math.abs(q.z - p.z) < 3.8,
          ).length;
          if (nearbyDead < 2) continue;
          unlockPiece(p, true);
          if (!first) first = p;
          continue;
        }
      }
    }
    // House: green timber stays. Charcoal drops. We do not lock a burned
    // wall in place so the roof looks pretty — boards fall. Debris may
    // land outside the walls; that is still gravity, not a hinge.
    if (s.shape === "house") {
      if (p.kind === "stud" && p.intact > 0.38) continue;
      if (p.kind === "joist" && p.intact > 0.36) continue;
      if (p.kind === "plate" && p.intact > 0.36) continue;
      if (p.kind === "sill" && p.intact > 0.32) continue;
      if (p.kind === "roof") {
        const studs = pieces.filter(
          (q) => q.kind === "stud" && Math.abs(q.restX - p.restX) < 2.4 && q.restY < p.restY && q.restY > p.restY - 3.2,
        );
        const dead = studs.filter((q) => q.dynamic).length;
        const need = Math.max(2, Math.ceil(studs.length * 0.4));
        if (p.intact > 0.38 && dead < need) continue;
      }
      if (p.kind === "wall" && p.intact > 0.22) continue;
    } else if (p.kind === "stud" && p.intact > 0.22) continue;
    if (!hasSupport(p, locked, s.shape === "bonfire")) {
      const anyLoose = pieces.some((q) => q.dynamic);
      if (!anyLoose && p.temp < 180) continue;
      unlockPiece(p, true);
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
      unlockPiece(p, true);
      if (!first) first = p;
    }
  }
  if (s.shape === "apartment") {
    // Two dead columns in a bay is a story mechanism. The bay from there
    // up is not a building anymore — walls, slabs, the stack. That's the
    // missing corner, not a hovering hotel.
    for (let layer = 0; layer < s.floors; layer++) {
      for (let col = 0; col < 5; col++) {
        const cols = pieces.filter((p) => p.kind === "column" && p.layer === layer && p.col === col);
        if (cols.length < 2) continue;
        const dead = cols.filter((p) => p.dynamic).length;
        if (dead < 2) continue;
        for (const q of pieces) {
          if (q.dynamic) continue;
          if (q.col !== col || q.layer < layer) continue;
          if (q.kind !== "column" && q.kind !== "wall" && q.kind !== "slab") continue;
          unlockPiece(q, true);
          if (!first) first = q;
        }
      }
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

function inertia(p: Piece): number {
  return Math.max(0.08, (p.mass * (p.w * p.w + p.h * p.h)) / 12);
}

function applyTorque(p: Piece, nx: number, ny: number, jimp: number): void {
  // Long boards do not pick up spin from a contact — that was the flying 2×4.
  if (
    p.kind === "joist" ||
    p.kind === "slab" ||
    p.kind === "plate" ||
    p.kind === "sill" ||
    p.kind === "log" ||
    p.kind === "join"
  ) {
    return;
  }
  const rx = nx * Math.max(0.04, p.w * 0.22);
  const ry = ny * Math.max(0.04, p.h * 0.22);
  p.omega += (rx * (ny * jimp) - ry * (nx * jimp)) / inertia(p) * 0.35;
}

/**
 * A board that has hit the ground should lie down, not bounce on its end.
 * Gravity on a free body has no torque (CGrav is the centre). The ground
 * contact does: we drive theta toward ±π/2 for tall pieces.
 */
function flopOnGround(p: Piece, dt: number): void {
  // Long boards lie down. They do not cartwheel — that was the flying 2×4.
  if (p.kind === "joist" || p.kind === "slab" || p.kind === "plate" || p.kind === "sill" || p.kind === "log" || p.kind === "join") {
    p.omega += -p.theta * 5 * dt;
    p.omega *= Math.exp(-3.2 * dt);
    return;
  }
  const tall = p.h > p.w * 1.15;
  if (!tall) {
    p.omega *= Math.exp(-2.4 * dt);
    return;
  }
  let th = p.theta;
  while (th > Math.PI) th -= Math.PI * 2;
  while (th < -Math.PI) th += Math.PI * 2;
  if (Math.abs(th) < Math.PI / 2.4) {
    const sign = Math.abs(th) < 0.05 ? (hash(p.id) > 0.5 ? 1 : -1) : th >= 0 ? 1 : -1;
    p.omega += sign * 1.4 * dt;
  }
  const len = Math.max(p.w, p.h, p.depth);
  const cap = 1.4 / Math.max(len, 0.4);
  if (p.omega > cap) p.omega = cap;
  if (p.omega < -cap) p.omega = -cap;
}

function overlap1(ac: number, as: number, bc: number, bs: number): number {
  return Math.max(0, Math.min(ac + as * 0.5, bc + bs * 0.5) - Math.max(ac - as * 0.5, bc - bs * 0.5));
}

function pairKey(a: number, b: number): number {
  return a < b ? a * 100000 + b : b * 100000 + a;
}

/**
 * 3-axis AABB. Prefer Y when the overlap is close — a crib stacks, it does
 * not get shoved into a Z-grid.
 *
 * Restitution is 0. The old solver still bounced: it pushed overlapping
 * pieces apart by up to 5 cm a frame (faster than gravity) and the
 * velocity kill was inverted, so a roof on rubble could hop for hours.
 * Now: slop so hairline overlaps rest, tiny positional correction, mass-
 * weighted inelastic velocities, and nothing is allowed to leave a
 * contact going up.
 */
function resolveAabb(
  a: Piece,
  b: Piece,
  both: boolean,
  supported: Set<number>,
): void {
  const ox = overlap1(a.x, a.w, b.x, b.w);
  const oy = overlap1(a.y, a.h, b.y, b.h);
  const oz = overlap1(a.z, a.depth, b.z, b.depth);
  if (ox <= 0 || oy <= 0 || oz <= 0) return;
  const min = Math.min(ox, oy, oz);
  let axis: "x" | "y" | "z";
  if (oy <= min * 1.4) axis = "y";
  else if (ox <= oz) axis = "x";
  else axis = "z";

  const SLOP = 0.01;
  const PERCENT = 0.18;
  const MAX = 0.0035;

  if (axis === "y") {
    const aBelow = a.y <= b.y;
    const approaching = aBelow ? a.vy > b.vy : b.vy > a.vy;
    if (approaching) {
      if (both) {
        const v = (a.mass * a.vy + b.mass * b.vy) / Math.max(1e-6, a.mass + b.mass);
        a.vy = v;
        b.vy = v;
      } else {
        if (a.vy < 0) a.vy = 0;
      }
    }
    if (aBelow) supported.add(b.id);
    else supported.add(a.id);
    const pen = oy - SLOP;
    if (pen > 0) {
      const corr = Math.min(MAX, pen * PERCENT);
      const sign = aBelow ? -1 : 1;
      if (both) {
        const invA = 1 / Math.max(a.mass, 0.05);
        const invB = 1 / Math.max(b.mass, 0.05);
        const s = invA + invB;
        a.y += sign * corr * (invA / s);
        b.y -= sign * corr * (invB / s);
      } else {
        a.y += sign * Math.min(MAX * 2, pen * PERCENT);
      }
    }
    return;
  }

  if (axis === "x") {
    const aLeft = a.x <= b.x;
    const approaching = aLeft ? a.vx > b.vx : b.vx > a.vx;
    if (approaching) {
      if (both) {
        const v = (a.mass * a.vx + b.mass * b.vx) / Math.max(1e-6, a.mass + b.mass);
        a.vx = v;
        b.vx = v;
      } else if ((aLeft && a.vx > 0) || (!aLeft && a.vx < 0)) {
        a.vx = 0;
      }
    }
    const pen = ox - SLOP;
    if (pen > 0) {
      const corr = Math.min(MAX, pen * PERCENT);
      const sign = aLeft ? -1 : 1;
      if (both) {
        const invA = 1 / Math.max(a.mass, 0.05);
        const invB = 1 / Math.max(b.mass, 0.05);
        const s = invA + invB;
        a.x += sign * corr * (invA / s);
        b.x -= sign * corr * (invB / s);
      } else {
        a.x += sign * Math.min(MAX * 2, pen * PERCENT);
      }
    }
    return;
  }

  const aNear = a.z <= b.z;
  const approaching = aNear ? a.vz > b.vz : b.vz > a.vz;
  if (approaching) {
    if (both) {
      const v = (a.mass * a.vz + b.mass * b.vz) / Math.max(1e-6, a.mass + b.mass);
      a.vz = v;
      b.vz = v;
    } else if ((aNear && a.vz > 0) || (!aNear && a.vz < 0)) {
      a.vz = 0;
    }
  }
  const pen = oz - SLOP;
  if (pen > 0) {
    const corr = Math.min(MAX, pen * PERCENT);
    const sign = aNear ? -1 : 1;
    if (both) {
      const invA = 1 / Math.max(a.mass, 0.05);
      const invB = 1 / Math.max(b.mass, 0.05);
      const s = invA + invB;
      a.z += sign * corr * (invA / s);
      b.z -= sign * corr * (invB / s);
    } else {
      a.z += sign * Math.min(MAX * 2, pen * PERCENT);
    }
  }
}

/**
 * Keep a charred-through stick as one rigid body until a join fails.
 * Positions snap back to rest-relative offsets around the group's COM.
 */
function weldStickGroups(pieces: Piece[]): Set<number> {
  const skip = new Set<number>();
  const seen = new Set<number>();
  for (const p of pieces) {
    if (!p.dynamic || !p.stickId || seen.has(p.id)) continue;
    if (p.kind !== "log" && p.kind !== "join") continue;
    const group = weldedGroup(pieces, p).filter((q) => q.dynamic);
    for (const q of group) seen.add(q.id);
    if (group.length < 2) continue;
    let m = 0;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    let vx = 0;
    let vy = 0;
    let vz = 0;
    let om = 0;
    let th = 0;
    let rcx = 0;
    let rcy = 0;
    let rcz = 0;
    for (const q of group) {
      m += q.mass;
      cx += q.mass * q.x;
      cy += q.mass * q.y;
      cz += q.mass * q.z;
      vx += q.mass * q.vx;
      vy += q.mass * q.vy;
      vz += q.mass * q.vz;
      om += q.mass * q.omega;
      th += q.mass * q.theta;
      rcx += q.mass * q.restX;
      rcy += q.mass * q.restY;
      rcz += q.mass * q.restZ;
    }
    if (m < 1e-6) continue;
    cx /= m;
    cy /= m;
    cz /= m;
    vx /= m;
    vy /= m;
    vz /= m;
    om /= m;
    th /= m;
    rcx /= m;
    rcy /= m;
    rcz /= m;
    const c = Math.cos(th);
    const s = Math.sin(th);
    for (const q of group) {
      const dx = q.restX - rcx;
      const dy = q.restY - rcy;
      const dz = q.restZ - rcz;
      q.x = cx + dx * c - dy * s;
      q.y = cy + dx * s + dy * c;
      q.z = cz + dz;
      q.vx = vx;
      q.vy = vy;
      q.vz = vz;
      q.omega = om;
      q.theta = th;
    }
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) skip.add(pairKey(group[i].id, group[j].id));
    }
  }
  return skip;
}

function capOmega(p: Piece): void {
  const len = Math.max(p.w, p.h, p.depth, 0.3);
  const cap = 1.6 / len;
  if (p.omega > cap) p.omega = cap;
  if (p.omega < -cap) p.omega = -cap;
}

/**
 * Gravity + collisions. Always 1x. Fire Speed does not call this faster.
 *
 * What: For every dynamic piece, vy -= G * dt, then move, then hit the
 * pit / ground / other pieces (SAT).
 * CRITIC: "You damped vx so it cannot tip."
 * Horizontal velocity is damped (wood on wood, not ice). Vertical is
 * gravity. A hinge tip-over needs a standing shaft, not rubble.
 *
 * CRITIC: "Walls jump like mexican jumping beans. Logs bounce in the pit.
 * The roof is still hopping 110 minutes after ignition."
 * SAT used to be 2D in x-y. Front and back panels share x,y. Without a z
 * test they detonated. The crib then got the opposite bug: preferring Z
 * shoved stacked logs into a ruled grid (boiling noodles from above).
 * Contacts now use true 3-axis AABB and prefer Y when the overlap is close.
 * Restitution is 0, and we mean it: overlap correction is millimetres,
 * closing velocity is mass-averaged, and nothing leaves a contact going up.
 * A piece that is supported and slow sleeps. Charcoal does not bounce.
 *
 * CRITIC: "Nothing rotates; is that beyond the engine?"
 * No. Pieces have theta and omega. Unlock seeds a real tumble; air damping
 * is light. Rotation is not a sideways kick.
 */
export function integratePieces(pieces: Piece[], pit: Pit | null, dt: number, width: number): number {
  let ke = 0;
  const dyn = pieces.filter((p) => p.dynamic);
  for (const p of dyn) {
    p.vy -= G * dt;
    p.vx *= Math.exp(-2.1 * dt);
    p.vz *= Math.exp(-2.1 * dt);
    p.omega *= Math.exp(-0.8 * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.theta += p.omega * dt;
    capOmega(p);
    ke += 0.5 * p.mass * (p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
  }

  const skip = weldStickGroups(pieces);
  const supported = new Set<number>();

  for (const p of dyn) {
    const gy = terrain(p.x, p.z, pit);
    const low = lowestY(p);
    if (low < gy) {
      p.y += gy - low;
      if (p.vy < 0) p.vy = 0;
      p.vx *= 0.35;
      p.vz *= 0.35;
      supported.add(p.id);
      flopOnGround(p, dt);
    }
    if (pit && p.y < 0.95) {
      const r = 0.22;
      if (p.x < pit.left + r) {
        p.x = pit.left + r;
        if (p.vx < 0) p.vx = 0;
      }
      if (p.x > pit.right - r) {
        p.x = pit.right - r;
        if (p.vx > 0) p.vx = 0;
      }
      if (p.z < pit.near + r) {
        p.z = pit.near + r;
        if (p.vz < 0) p.vz = 0;
      }
      if (p.z > pit.far - r) {
        p.z = pit.far - r;
        if (p.vz > 0) p.vz = 0;
      }
      p.vx *= Math.exp(-3.5 * dt);
      p.vz *= Math.exp(-3.5 * dt);
      p.omega *= Math.exp(-2.8 * dt);
    }
    if (lowestY(p) < terrain(p.x, p.z, pit) + 0.12) {
      p.vx *= Math.exp(-5.5 * dt);
      p.vz *= Math.exp(-5.5 * dt);
      p.omega *= Math.exp(-2.4 * dt);
      flopOnGround(p, dt);
      supported.add(p.id);
    }
    if (p.x < -0.4) {
      p.x = -0.4;
      if (p.vx < 0) p.vx = 0;
    }
    if (p.x > width + 0.4) {
      p.x = width + 0.4;
      if (p.vx > 0) p.vx = 0;
    }
    if (p.y < -1.6) {
      p.y = -1.6;
      p.vy = 0;
      supported.add(p.id);
    }
    capOmega(p);
  }

  weldStickGroups(pieces);

  const n = dyn.length;
  for (let i = 0; i < n; i++) {
    const a = dyn[i];
    for (let j = i + 1; j < n; j++) {
      const b = dyn[j];
      if (skip.has(pairKey(a.id, b.id))) continue;
      resolveAabb(a, b, true, supported);
    }
  }

  const toUnlock: Piece[] = [];
  for (const p of dyn) {
    for (const q of pieces) {
      if (q.dynamic || q.id === p.id) continue;
      if (p.stickId && q.stickId === p.stickId) continue;
      const ox = overlap1(p.x, p.w, q.x, q.w);
      const oy = overlap1(p.y, p.h, q.y, q.h);
      const oz = overlap1(p.z, p.depth, q.z, q.depth);
      if (ox <= 0 || oy <= 0 || oz <= 0) continue;
      resolveAabb(p, q, false, supported);
      const vn = p.vy;
      if (vn < -3 && (p.kind === "slab" || p.kind === "column") && q.y < p.y) {
        const groundSill = q.kind === "sill" && q.layer === 0;
        if (!groundSill) toUnlock.push(q);
      } else if (p.mass * vn * vn > capacityN(q) * 0.55 && vn < -1.5) {
        const groundSill = q.kind === "sill" && q.layer === 0;
        if (!groundSill) toUnlock.push(q);
      }
    }
  }
  for (const q of toUnlock) {
    if (!q.dynamic) unlockPiece(q, true);
  }

  // Charcoal does not bounce. Gravity is the only thing that should add
  // vertical speed, and gravity only goes down.
  for (const p of dyn) {
    if (p.vy > 0) p.vy = 0;
    if (supported.has(p.id)) {
      const spd2 = p.vx * p.vx + p.vy * p.vy + p.vz * p.vz;
      if (spd2 < 0.09 && Math.abs(p.omega) < 0.55) {
        p.vx = 0;
        p.vy = 0;
        p.vz = 0;
        p.omega *= Math.exp(-6 * dt);
      }
    }
  }

  weldStickGroups(pieces);
  return ke;
}

/**
 * Mass-weighted center of gravity. Not a drawn line that we place by hand.
 * The claim "it had to tip" is "CGrav left the base." This is that number.
 */
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

/**
 * What: Are we done?
 * A house is done when a majority of the roof has come down and the pile
 * is still — not when every last far gable board has charred, and not
 * one second after the first stud drops. Fuel-spent is a backup so a
 * 1-story cannot hang forever with a green far wall.
 */
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
    if (roofLoose < Math.max(1, Math.floor(roofs.length * 0.34))) return false;
  }
  if (roofs.length === 0) {
    const deadCols = pieces.filter((p) => p.kind === "column" && p.dynamic);
    if (deadCols.length >= 2 && dyn.length >= 8) {
      const lo = Math.min(...deadCols.map((p) => p.layer));
      const cols = new Set(deadCols.map((p) => p.col));
      const stack = pieces.filter((p) => p.layer >= lo && cols.has(p.col) && p.kind !== "sill");
      const down = stack.filter((p) => p.dynamic).length;
      if (stack.length > 0 && down >= stack.length * 0.4) return true;
    }
    if (dyn.length >= pieces.length * 0.35) return true;
  }
  const mid = restSum / Math.max(1, pieces.length);
  const structural = (p: Piece) => p.kind !== "sill" && p.kind !== "tree" && p.kind !== "couch" && p.kind !== "log" && p.kind !== "join";
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
