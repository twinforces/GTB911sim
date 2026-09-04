import { COLS, COL_X, G, SF, TRIB } from "./constants";
import {
  buildPieces,
  evaluatePieces,
  fyOf,
  heatPieces,
  hottest,
  ignitePieces,
  integratePieces,
  pieceCgrav,
  piecesSettled,
  restackBonfire,
  spreadPieces,
} from "./pieces";
import { eFactor, fyFactor } from "./steel";
import type {
  Block,
  Bubble,
  BubbleKind,
  Column,
  FaceStatus,
  Floor,
  LogEvent,
  Particle,
  Phase,
  Piece,
  Pit,
  PlaneState,
  Probe,
  Scenario,
  SimSnapshot,
} from "./types";

const PARTICLE_CAP = 700;

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function parseClock(clock: string): number {
  const [h, m, s] = clock.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

function formatClock(start: string, simSec: number): string {
  const t = parseClock(start) + Math.max(0, simSec);
  const wrap = ((t % 86400) + 86400) % 86400;
  const h = Math.floor(wrap / 3600);
  const m = Math.floor((wrap % 3600) / 60);
  const s = Math.floor(wrap % 60);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function makeColumn(): Column {
  return {
    intact: 1,
    temp: 22,
    fuel: 1,
    burning: 0,
    stripped: 0,
    failed: false,
    sag: 0,
    bow: 0,
  };
}

export class SimEngine {
  scenario: Scenario;
  floors: Floor[] = [];
  pieces: Piece[] = [];
  pit: Pit | null = null;
  phase: Phase = "idle";
  paused = true;
  speed = 24;
  t = 0;
  steps = 0;
  impactAt = 0;
  particles: Particle[] = [];
  bubbles: Bubble[] = [];
  events: LogEvent[] = [];
  plane: PlaneState = { alive: false, exploded: false, x: 0, y: 0, vx: 0, vy: 0, angle: 0 };
  block: Block | null = null;
  crushLo = 0;
  trauma = 0;
  hitstop = 0;
  maxTheta = 0;
  initiationT: number | null = null;
  bubbleSeq = 1;
  lastBubble = -10;
  hatAnnounced = false;
  steelAnnounced = false;
  sagAnnounced = false;
  spreadAnnounced = false;
  treeAnnounced = false;
  couchAnnounced = false;
  fireFloorAnnounced = 0;
  energyAnnounced = false;
  cgAnnounced = false;
  stoodAnnounced = false;
  planeFlash = 0;
  camX = 2;
  camY = 3;
  camS = 40;
  camTX = 2;
  camTY = 3;
  camTS = 40;
  fullX = 2;
  fullY = 3;
  fullS = 40;
  fullTX = 2;
  fullTY = 3;
  fullTS = 40;
  settleHold = 0;
  reducedMotion = false;

  get n(): number {
    return this.scenario.world === "pieces" ? this.scenario.floors : this.floors.length;
  }
  get floorH(): number {
    return this.scenario.floorH;
  }
  get width(): number {
    return this.scenario.width;
  }
  get height(): number {
    if (this.scenario.world === "pieces") {
      if (this.scenario.shape === "bonfire") return 1.8;
      return Math.max(this.floorH, this.n * this.floorH + (this.scenario.shape === "house" ? 1.3 : 0.2));
    }
    return this.floors.length * this.floorH;
  }
  get mass(): number {
    return this.scenario.mass;
  }
  get isPieces(): boolean {
    return this.scenario.world === "pieces";
  }

  constructor(scenario: Scenario) {
    this.scenario = scenario;
    this.rebuild();
  }

  rebuild(): void {
    const s = this.scenario;
    this.pieces = [];
    this.pit = null;
    this.floors = [];
    if (s.world === "pieces") {
      const built = buildPieces(s);
      this.pieces = built.pieces;
      this.pit = built.pit;
    } else {
      const n = s.floors;
      const W = s.width;
      this.floors = Array.from({ length: n }, (_, i) => ({
        i,
        story: i + 1,
        mass: s.mass * (i > n - 5 ? 1.15 : 1),
        state: "stacked" as const,
        cols: Array.from({ length: COLS }, () => makeColumn()),
        xJitter: (hash(i + 11) - 0.5) * Math.min(4, W * 0.08),
        rotJitter: (hash(i + 91) - 0.5) * 0.12,
      }));
    }
    this.phase = "idle";
    this.paused = true;
    this.t = 0;
    this.steps = 0;
    this.impactAt = 0;
    this.particles = [];
    this.bubbles = [];
    this.events = [];
    this.block = null;
    this.crushLo = 0;
    this.trauma = 0;
    this.hitstop = 0;
    this.maxTheta = 0;
    this.initiationT = null;
    this.bubbleSeq = 1;
    this.lastBubble = -10;
    this.hatAnnounced = false;
    this.stoodAnnounced = false;
    this.planeFlash = 0;
    this.steelAnnounced = false;
    this.sagAnnounced = false;
    this.spreadAnnounced = false;
    this.treeAnnounced = false;
    this.couchAnnounced = false;
    this.fireFloorAnnounced = 0;
    this.energyAnnounced = false;
    this.cgAnnounced = false;
    this.settleHold = 0;
    this.plane = {
      alive: false,
      exploded: false,
      x: -Math.max(40, s.width),
      y: ((s.impactLo + s.impactHi) / 2) * s.floorH,
      vx: 0,
      vy: 0,
      angle: s.planeAngle,
    };
    this.fullTX = s.width / 2;
    this.fullTY = this.height * 0.42 + (s.shape === "bonfire" ? 0.15 : 1.2);
    this.fullTS = s.viewScale;
    this.fullX = this.fullTX;
    this.fullY = this.fullTY;
    this.fullS = this.fullTS;
    this.camTX = s.width / 2;
    this.camTY = this.isPieces
      ? s.shape === "bonfire"
        ? 0.38
        : this.height * 0.42
      : ((s.impactLo + s.impactHi) / 2) * s.floorH;
    this.camTS = s.actionScale;
    this.camX = this.camTX;
    this.camY = this.camTY;
    this.camS = this.camTS;
    this.speed = s.defaultSpeed;
    const label =
      s.shape === "bonfire"
        ? `${this.pieces.length} logs in a ${s.width.toFixed(1)} m pit`
        : s.world === "pieces"
          ? `${this.pieces.length} members · ${this.height.toFixed(1)} m · ${s.width.toFixed(1)} m base`
          : `${s.floors} storeys · ${this.height.toFixed(0)} m · ${s.width.toFixed(1)} m base`;
    this.log(0, `${label}. Live Euler step, g = 9.81. Not a video.`, "info");
  }

  designCap(storyIndex: number, col: number): number {
    const above = Math.max(1, this.n - storyIndex);
    return SF * TRIB[col] * above * this.mass * G;
  }

  reset(scenario?: Scenario): void {
    if (scenario) this.scenario = scenario;
    this.rebuild();
  }

  play(): void {
    if (this.phase === "idle") {
      if (this.scenario.hasPlane) {
        this.phase = "approach";
        this.armPlane();
      } else if (this.isPieces) {
        ignitePieces(this.pieces, this.scenario);
        this.phase = "fire";
        this.t = 0;
        const hot = hottest(this.pieces);
        this.pushBubble(
          hot ? hot.x : this.width * 0.25,
          hot ? hot.y : this.height * 0.4,
          "Ignition",
          this.scenario.shape === "bonfire"
            ? "One match, one log. Fire has to walk. The pit still holds the pile."
            : this.scenario.shape === "apartment"
              ? "One unit on the third storey. Heat walks to the next room, then the floor above."
              : "Dry tree, one match. Tree, then the couch, then the timber. When the wood is charcoal, the roof comes down in the footprint.",
          "critical",
          6.5,
        );
        this.log(
          0,
          this.scenario.shape === "bonfire"
            ? "One match. Fire has to spread from a single log."
            : this.scenario.shape === "apartment"
              ? "Ignition in one corner unit. Fire spreads room to room."
              : "Dry Christmas tree ignited. Fire has to walk.",
          "critical",
        );
        this.frameActionOnFire();
      } else {
        this.seedWound(false);
        this.phase = "fire";
      }
    }
    this.paused = false;
  }

  pause(): void {
    this.paused = true;
  }

  setSpeed(v: number): void {
    this.speed = clamp(v, 1, 240);
  }

  step(dt: number): void {
    const d = Math.min(dt, 0.1);
    this.stepCamera(d);
    if (this.hitstop > 0) {
      this.hitstop -= d;
      this.decayTrauma(d);
      this.stepParticles(d);
      this.ageBubbles(d);
      return;
    }
    const running = !this.paused || this.phase === "approach";
    if (running) this.steps += 1;
    if (running) {
      if (this.isPieces && (this.phase === "fire" || this.phase === "collapse")) {
        let remain = d * this.speed;
        while (remain > 0) {
          const chunk = Math.min(remain, 2.5);
          this.stepPieceHeat(chunk);
          this.t += chunk;
          remain -= chunk;
        }
        this.stepPieceMotion(d);
      } else {
        switch (this.phase) {
          case "approach":
            this.stepApproach(d);
            this.t += d;
            break;
          case "fire": {
            let remain = d * this.speed;
            while (remain > 0 && this.phase === "fire") {
              const chunk = Math.min(remain, 2.5);
              this.stepFire(chunk);
              this.t += chunk;
              remain -= chunk;
            }
            break;
          }
          case "collapse":
            this.stepCollapse(d);
            this.integrateDebris(d);
            this.t += d;
            break;
          default:
            break;
        }
      }
    }
    if (this.isPieces && this.phase === "settled") this.integrateDebris(d);
    this.stepParticles(d);
    this.ageBubbles(d);
    this.decayTrauma(d);
    this.planeFlash = Math.max(0, this.planeFlash - d);
    this.emitAmbient();
  }

  private stepPieceHeat(dt: number): void {
    const s = this.scenario;
    if (!s.noFire) {
      heatPieces(this.pieces, s, dt);
      spreadPieces(this.pieces, s, dt);
    }
    if (s.shape === "bonfire" && this.pit) restackBonfire(this.pieces, this.pit);
    const failed = evaluatePieces(this.pieces, s);
    const logCrumble = failed?.kind === "log";
    const furniture = failed?.kind === "tree" || failed?.kind === "couch";
    if (failed && this.phase === "fire" && !logCrumble && !furniture) {
      this.phase = "collapse";
      this.initiationT = this.t;
      this.trauma = 0.7;
      this.hitstop = this.reducedMotion ? 0 : 0.08;
      this.pushBubble(
        failed.x,
        failed.y,
        s.shape === "house" ? "Timber charred through" : "Member failed",
        s.shape === "house"
          ? "Wood remaining dropped below what the load needs. That piece unlocks and drops in the footprint. A house burning down, not a hinge."
          : "Load exceeded remaining strength. That piece unlocks and gravity takes it. Nothing is keyframed.",
        "critical",
        7,
      );
      this.log(this.t / 60, `First member fail (${failed.kind} #${failed.id}) at ${failed.temp.toFixed(0)}°C.`, "critical");
    }
    if (this.phase === "collapse") {
      evaluatePieces(this.pieces, s);
      evaluatePieces(this.pieces, s);
    }
    if (s.shape === "bonfire" && !this.sagAnnounced) {
      const bottoms = this.pieces.filter((p) => p.kind === "log" && p.layer === 0);
      if (bottoms.length > 0) {
        let intact = 0;
        for (const p of bottoms) intact += p.intact;
        if (intact / bottoms.length < 0.6) {
          this.sagAnnounced = true;
          this.pushBubble(
            this.width / 2,
            0.2,
            "Bottom layer eaten",
            "Bonfires fall because the logs underneath are consumed. The crib sags into the pit. Nothing explodes.",
            "fire",
            7,
          );
          this.log(this.t / 60, "Bottom layer consumed. Pile sagging into the pit.", "fire");
        }
      }
    }
    if (s.shape === "bonfire" && (this.phase === "fire" || this.phase === "collapse")) {
      const logs = this.pieces.filter((p) => p.kind === "log");
      const n = logs.length || 1;
      let fuel = 0;
      for (const p of logs) fuel += p.fuel;
      if (fuel / n < 0.16 && this.t > 80) this.settlePieces();
    }
    if (s.shape === "house" && this.phase === "fire") {
      if (!this.treeAnnounced) {
        const tree = this.pieces.find((p) => p.kind === "tree" && p.burning > 0.4);
        if (tree) {
          this.treeAnnounced = true;
          this.pushBubble(
            tree.x,
            tree.y + tree.h * 0.35,
            "Christmas tree",
            "Dry tree, one match. This is the UL living-room demo: the tree goes first.",
            "fire",
            6.5,
          );
          this.log(this.t / 60, "Dry Christmas tree ignited. One match.", "fire");
        }
      }
      if (!this.couchAnnounced) {
        const couch = this.pieces.find((p) => p.kind === "couch" && p.burning > 0.28);
        if (couch) {
          this.couchAnnounced = true;
          this.pushBubble(
            couch.x,
            couch.y + 0.4,
            "Couch caught",
            "Heat walked off the tree onto the furniture. The room is next, not the whole house at once.",
            "fire",
            6.5,
          );
          this.log(this.t / 60, "Couch caught from the tree.", "fire");
        }
      }
    }
    if (s.shape === "house" && this.phase === "fire" && this.spreadAnnounced && this.t > 280) {
      const roof = this.pieces.filter((p) => p.kind === "roof");
      const roofDown = roof.length > 0 && roof.every((p) => p.dynamic);
      let fuel = 0;
      for (const p of this.pieces) fuel += p.fuel;
      if (roofDown && fuel / Math.max(1, this.pieces.length) < 0.28) this.settlePieces();
    }
    if (this.phase === "fire" && !this.spreadAnnounced && s.fireSpread > 0 && s.shape !== "apartment") {
      const right = this.pieces.filter((p) => p.x > this.width * 0.55 && p.burning > 0.12);
      if (right.length > 0) {
        this.spreadAnnounced = true;
        const p = right[0];
        this.pushBubble(
          p.x,
          p.y,
          "Fire spreads",
          "It did not start on this side. Heat walked. One-sided ignition is not one-sided fire.",
          "fire",
          6.5,
        );
        this.log(this.t / 60, "Fire spread to the far side.", "fire");
      }
    }
    if (s.shape === "apartment" && this.phase === "fire" && !this.spreadAnnounced) {
      const up = this.pieces.filter((p) => p.layer >= s.impactLo && p.burning > 0.2);
      if (up.length > 0) {
        this.spreadAnnounced = true;
        const p = up[0];
        this.pushBubble(
          p.x,
          p.y,
          "Fire walked up",
          "The unit above caught from the one below. Same neighbor-heat rule as the house, just a taller stack.",
          "fire",
          6.5,
        );
        this.log(this.t / 60, `Fire climbed to storey ${p.layer + 1}.`, "fire");
      }
    }
  }

  private stepPieceMotion(dt: number): void {
    const fast = this.pieces.some((p) => p.dynamic && Math.abs(p.vy) > 8);
    const n = fast ? 2 : 1;
    const sdt = dt / n;
    for (let i = 0; i < n; i++) integratePieces(this.pieces, this.pit, sdt, this.width);
    this.pieceFireParticles();
    this.frameActionOnFire();
    const loose = this.pieces.filter((p) => p.dynamic).length;
    if (!this.cgAnnounced && loose > 2) {
      this.cgAnnounced = true;
      const cg = pieceCgrav(this.pieces);
      const inside = cg.x > 0 && cg.x < this.width;
      this.pushBubble(
        cg.x,
        Math.max(0.3, cg.y),
        inside ? "CGrav still over the base" : "CGrav left the base",
        inside
          ? `Center Gravity at ${cg.x.toFixed(2)} m. The footprint is 0–${this.width.toFixed(1)} m. Pieces fall down, not out.`
          : "Mass walked off the pit — that would take a hinge, not rubble.",
        inside ? "ok" : "critical",
        6,
      );
    }
    if (this.phase === "collapse") {
      if (piecesSettled(this.pieces) && loose > 0) {
        this.settleHold += dt;
        if (this.settleHold > 1.1) this.settlePieces();
      } else {
        this.settleHold = 0;
      }
      if (this.initiationT !== null && this.t - this.initiationT > 240 && piecesSettled(this.pieces)) {
        this.settlePieces();
      }
    }
  }

  private settlePieces(): void {
    if (this.phase === "settled") return;
    this.phase = "settled";
    this.paused = true;
    const cg = pieceCgrav(this.pieces);
    const inside = cg.x > this.width * 0.08 && cg.x < this.width * 0.92;
    const min = this.t / 60;
    const loose = this.pieces.filter((p) => p.dynamic).length;
    const roofDown =
      this.scenario.shape === "house" &&
      this.pieces.some((p) => p.kind === "roof") &&
      this.pieces.filter((p) => p.kind === "roof").every((p) => p.dynamic);
    const houseStanding = this.scenario.shape === "house" && !roofDown && loose < this.pieces.length * 0.25;
    const bonfire = this.scenario.shape === "bonfire";
    this.pushBubble(
      this.width / 2,
      Math.max(0.4, this.height * 0.2),
      bonfire ? "In the pit" : houseStanding ? "Still a house" : this.scenario.shape === "house" ? "Burned down" : "Rubble",
      bonfire
        ? `The crib sagged as the bottom logs were eaten. Charcoal stays in the pit. CGrav x = ${cg.x.toFixed(2)} m.`
        : houseStanding
          ? `Fire ran ${min.toFixed(0)} min. Tree, then the couch, then the timber. The roof is still a roof. CGrav stayed over the footprint.`
          : this.scenario.shape === "house"
            ? `Fire ran ${min.toFixed(0)} min. Timber charred, roof in the footprint. CGrav x = ${cg.x.toFixed(2)} m.`
            : inside
              ? `Fire ran ${min.toFixed(0)} min. Things made of pieces form a pile. CGrav stayed over the ${this.pit ? "pit" : "footprint"}.`
              : "The pile walked — check crush / hinge assumptions.",
      inside ? "ok" : "warn",
      10,
    );
    this.log(
      min,
      bonfire
        ? `Bottom logs consumed. Charcoal in the pit. CGrav x = ${cg.x.toFixed(2)} m.`
        : houseStanding
          ? `Fire spread through the house. Roof stayed. CGrav x = ${cg.x.toFixed(2)} m.`
          : this.scenario.shape === "house"
            ? `House burned down. Roof in the footprint. CGrav x = ${cg.x.toFixed(2)} m.`
            : `Settled as rubble. CGrav x = ${cg.x.toFixed(2)} m.`,
      inside ? "ok" : "warn",
    );
  }

  private integrateDebris(dt: number): void {
    if (this.pieces.length === 0) return;
    integratePieces(this.pieces, this.pit, dt, this.width);
  }

  private pieceFireParticles(): void {
    if (this.particles.length > PARTICLE_CAP - 40) return;
    const indoor = this.scenario.shape === "house" || this.scenario.shape === "apartment";
    for (const p of this.pieces) {
      if (p.burning < 0.2) continue;
      if (p.kind === "wall" || p.kind === "roof" || p.kind === "joist" || p.kind === "sill" || p.kind === "plate") continue;
      if (hash(this.t * 0.02 + p.id) > 0.62) continue;
      const lift = indoor ? Math.min(0.35, p.h * 0.2) : p.h * 0.3;
      this.spawn("fire", p.x + (hash(p.id) - 0.5) * Math.min(p.w, 1.2) * 0.25, p.y + lift, indoor ? 0.6 : 3, indoor ? 7 : 12, p.z);
      if (p.burning > 0.45) this.spawn("smoke", p.x, p.y + (indoor ? 0.45 : 0.2), indoor ? 0.8 : 2, indoor ? 8 : 10, p.z);
    }
  }

  private frameActionOnFire(): void {
    const s = this.scenario;
    if (s.shape === "bonfire") {
      // Standing at the rim, watching the fire — not lying in the pit looking up.
      this.camTX = s.width / 2;
      this.camTY = 0.38;
      this.camTS = s.actionScale;
      return;
    }
    let x = 0;
    let y = 0;
    let n = 0;
    for (const p of this.pieces) {
      if (p.burning > 0.15 || p.dynamic) {
        x += p.x;
        y += p.y;
        n += 1;
      }
    }
    if (n === 0) {
      this.camTX = s.width * 0.32;
      this.camTY = Math.max(0.35, this.height * 0.35);
    } else {
      this.camTX = x / n;
      this.camTY = y / n;
    }
    this.camTS = s.actionScale;
  }

  private spawnDebris(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const w = 0.4 + hash(i + y) * 1.2;
      const h = 0.12 + hash(i + 4) * 0.18;
      this.pieces.push({
        id: 10000 + this.pieces.length + i,
        kind: "slab",
        material: "steel",
        x: x + (hash(i + 2) - 0.5) * this.width * 0.5,
        y: y + hash(i) * 0.4,
        z: (hash(i + 11) - 0.5) * this.width * 0.7,
        w,
        h,
        depth: w,
        theta: (hash(i + 8) - 0.5) * 0.8,
        vx: (hash(i + 1) - 0.5) * 6,
        vy: -2 - hash(i + 5) * 4,
        vz: (hash(i + 13) - 0.5) * 5,
        omega: (hash(i + 6) - 0.5) * 4,
        mass: Math.max(80, this.mass * 0.02),
        temp: 200,
        fuel: 0.2,
        burning: 0.1,
        stripped: 1,
        intact: 0.3,
        failed: true,
        dynamic: true,
        layer: 0,
        col: i % 5,
        restX: x,
        restY: y,
        restZ: 0,
        alongZ: false,
      });
    }
    if (this.pieces.length > 180) this.pieces.splice(0, 40);
  }

  private armPlane(): void {
    const s = this.scenario;
    const y = ((s.impactLo + s.impactHi) / 2) * this.floorH;
    this.plane = {
      alive: true,
      exploded: false,
      x: -Math.max(80, this.width * 1.6),
      y,
      vx: 95,
      vy: Math.sin(s.planeAngle) * 18,
      angle: s.planeAngle,
    };
    this.camTX = this.width * 0.25;
    this.camTY = y;
    this.camTS = Math.max(6.2, s.actionScale);
    this.log(0, "Aircraft inbound.", "info");
  }

  private stepApproach(dt: number): void {
    const p = this.plane;
    if (!p.alive) return;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    this.camTX = clamp(p.x, 8, this.width * 0.4);
    this.camTY = p.y;
    if (p.x >= this.width * 0.08) this.doImpact();
  }

  private doImpact(): void {
    this.plane.alive = false;
    this.plane.exploded = true;
    this.plane.x = this.width * 0.12;
    this.planeFlash = 0.7;
    this.trauma = 1;
    this.hitstop = this.reducedMotion ? 0 : 0.09;
    this.seedWound(true);
  }

  private seedWound(sever: boolean): void {
    const s = this.scenario;
    this.phase = "fire";
    this.t = 0;
    this.impactAt = 0;
    const midY = ((s.impactLo + s.impactHi) / 2) * this.floorH;

    for (let story = s.impactLo; story <= s.impactHi; story++) {
      const f = this.floors[story - 1];
      if (!f) continue;
      const span = Math.max(1, s.impactHi - s.impactLo);
      const edge = 1 - Math.abs(story - (s.impactLo + s.impactHi) / 2) / (span + 2);
      for (let c = 0; c < COLS; c++) {
        if (sever) {
          const remain = s.impactIntact[c] + (1 - s.impactIntact[c]) * (1 - edge) * 0.25;
          f.cols[c].intact = clamp(remain, 0.04, 1);
        }
        if (s.noFire) {
          f.cols[c].stripped = 0;
        } else if (sever) {
          f.cols[c].stripped = clamp(1.05 - s.impactIntact[c], 0, 1) * Math.max(edge, 0.4);
        } else if (this.n <= 8) {
          f.cols[c].stripped = 0.9;
        } else {
          f.cols[c].stripped = (c <= 2 ? 0.92 : 0.4) * Math.max(edge, 0.5);
        }
        if (!s.noFire && (sever ? c <= 2 : this.n <= 8 || c <= 3)) {
          // Jet fuel lights the lowest impact storey hard. The rest of the
          // gash is stripped and waiting — fire has to walk up, one floor
          // at a time, over the hour. "Fire stays put" lights the whole belt.
          const seedNow = !sever || s.fireSpread <= 0 || story === s.impactLo || this.n <= 8;
          if (seedNow) {
            f.cols[c].burning = sever
              ? 0.52 + 0.2 * (1 - s.impactIntact[c])
              : this.n <= 8
                ? 0.78
                : 0.7 * (c === 0 ? 1 : 0.72);
            f.cols[c].fuel = 1;
          }
        }
      }
    }

    this.fireFloorAnnounced = s.impactLo;

    for (let i = 0; i < 50; i++) {
      const y = midY + (hash(i) - 0.5) * this.floorH * 3;
      this.spawn(sever ? "spark" : "fire", this.width * 0.1 + hash(i + 3) * this.width * 0.3, y, 24, 60);
      this.spawn("dust", this.width * 0.15 + hash(i + 7) * this.width * 0.4, y, 18, 40);
    }

    const gash = s.impactHi - s.impactLo + 1;
    const hourNote = s.nistMinutes > 0
      ? ` Historically ${s.nistMinutes} min of fire. Elevator shafts are chimneys — it walks up one storey at a time.`
      : "";
    this.pushBubble(
      this.width * 0.18,
      midY,
      sever ? "Impact" : "Ignition",
      sever
        ? `${gash} floors punched. Perimeter + core severed on the inbound face. Fire on storey ${s.impactLo}.${hourNote}`
        : `Fire on storey ${s.impactLo}. The floors above are sitting on this one. They will not hover.`,
      "critical",
      6.5,
    );
    this.log(
      0,
      sever
        ? `Impact floors ${s.impactLo}–${s.impactHi}. Columns cut on the inbound face and into the core. Fire starts on storey ${s.impactLo}.${s.nistMinutes > 0 ? ` NIST stand time ${s.nistMinutes} min.` : ""}`
        : `Ignition on storey ${s.impactLo}. Insulation stripped on the fire face.`,
      "critical",
    );
    this.camTX = this.width * 0.28;
    this.camTY = midY;
    this.camTS = s.actionScale;
  }

  private stepFire(dt: number): void {
    const s = this.scenario;
    if (s.noFire) {
      this.idleHeat(dt);
      this.evaluateStructure();
      return;
    }

    const heatMul = s.heatRate;
    for (let i = 0; i < this.floors.length; i++) {
      const f = this.floors[i];
      if (f.state !== "stacked") continue;
      for (let c = 0; c < COLS; c++) {
        const col = f.cols[c];
        if (col.failed) continue;
        const gas = 20 + 900 * col.burning;
        const tau = (col.stripped > 0.45 ? 6700 : 16000) / heatMul;
        col.temp += ((gas - col.temp) / tau) * dt;
        if (col.burning > 0 && col.fuel > 0) {
          col.fuel = Math.max(0, col.fuel - 0.00012 * col.burning * dt);
          if (col.fuel < 0.08) col.burning *= Math.exp(-dt / 900);
        } else if (col.burning > 0 && col.fuel <= 0) {
          col.burning *= Math.exp(-dt / 400);
        }

        const e = eFactor(col.temp);
        col.sag = clamp(col.sag + (1 - e) * 0.00016 * dt, 0, 1);
        col.bow = clamp(col.sag * (c === 0 || c === 4 ? 1.15 : 0.7), 0, 1);
      }
    }

    this.spreadFire(dt);
    this.trackFireFront();
    this.ambientFireParticles();
    this.evaluateStructure();
  }

  private idleHeat(dt: number): void {
    for (const f of this.floors) {
      for (const col of f.cols) {
        col.temp += (22 - col.temp) * (1 - Math.exp(-dt / 8000));
      }
    }
    this.evaluateStructure();
  }

  private climbMinutes(): number {
    const s = this.scenario;
    if (s.nistMinutes <= 0) return 8;
    // North 102 min, South 56 min. Walk the impact belt plus a few floors
    // above so the hour is a climbing front, not a single flash.
    const walk = Math.max(8, s.impactHi - s.impactLo + 6);
    return Math.max(4, (s.nistMinutes * 0.88) / walk);
  }

  private igniteStorey(story: number, intensity: number): boolean {
    const f = this.floors[story - 1];
    if (!f || f.state !== "stacked") return false;
    let any = false;
    for (let c = 0; c < COLS; c++) {
      if (f.cols[c].fuel < 0.06) continue;
      const face = c <= 2 ? 1 : 0.28;
      f.cols[c].burning = Math.max(f.cols[c].burning, intensity * face);
      f.cols[c].stripped = Math.max(f.cols[c].stripped, 0.35 * face);
      f.cols[c].fuel = Math.max(f.cols[c].fuel, 0.88);
      any = true;
    }
    return any;
  }

  private spreadFire(dt: number): void {
    const s = this.scenario;
    const spread = s.fireSpread;
    const alight = this.floors.map((f) => f.cols.map((c) => c.burning > 0.22 && c.fuel > 0.05));
    const minutes = this.t / 60;
    const climbMin = this.climbMinutes();

    for (let i = 0; i < this.floors.length; i++) {
      const f = this.floors[i];
      if (!f || f.state !== "stacked") continue;
      for (let c = 0; c < COLS; c++) {
        if (!alight[i][c]) continue;
        const col = f.cols[c];
        const horiz = spread > 0 ? spread : 1;
        if (c + 1 < COLS) {
          const nbr = f.cols[c + 1];
          const leak = c < 2 ? 1 : horiz;
          nbr.temp += 0.09 * col.burning * leak * dt;
          if (nbr.temp > 180 && nbr.fuel > 0.1) {
            nbr.burning = Math.max(nbr.burning, 0.22 * Math.max(leak, 0.4));
            nbr.stripped = Math.max(nbr.stripped, 0.3);
          }
        }
        if (c > 0) {
          const nbr = f.cols[c - 1];
          nbr.temp += 0.06 * col.burning * dt;
          if (nbr.temp > 210 && nbr.fuel > 0.1) {
            nbr.burning = Math.max(nbr.burning, 0.18);
            nbr.stripped = Math.max(nbr.stripped, 0.24);
          }
        }
        const dn = this.floors[i - 1];
        if (dn) {
          const nbr = dn.cols[c];
          nbr.temp += 0.025 * col.burning * (c === 2 ? 0.8 : 0.35) * dt;
          if (nbr.temp > 320 && nbr.fuel > 0.1) {
            nbr.burning = Math.max(nbr.burning, 0.12);
            nbr.stripped = Math.max(nbr.stripped, 0.18);
          }
        }
      }
    }

    if (spread <= 0) return;

    const unlocked = s.impactLo + Math.floor(minutes / climbMin);
    const cap = Math.min(this.floors.length, s.impactHi + 7);
    const next = this.fireFloorAnnounced + 1;
    if (next <= unlocked && next <= cap) {
      if (this.igniteStorey(next, 0.7)) {
        this.fireFloorAnnounced = next;
        this.trauma = Math.max(this.trauma, 0.55);
        const y = next * this.floorH;
        this.camTY = y;
        this.camTX = this.width * 0.34;
        this.pushBubble(
          this.width * 0.5,
          y,
          `Fire on storey ${next}`,
          next <= s.impactHi
            ? `Storey ${next} flashes over. Jet fuel opened the belt; the hour is the fire walking it.`
            : "One floor at a time. Elevator shafts are chimneys. The hour is the fire walking up.",
          "fire",
          7,
        );
        this.log(minutes, `Fire on storey ${next} at ${minutes.toFixed(0)} min.`, "fire");
        for (let k = 0; k < 18; k++) {
          this.spawn("fire", this.width * (0.12 + hash(k + next) * 0.7), y + (hash(k) - 0.3) * this.floorH, 10, 22);
          this.spawn("smoke", this.width * (0.2 + hash(k + 9) * 0.55), y + this.floorH * 0.6, 4, 14);
        }
      }
    }
  }

  private trackFireFront(): void {
    if (this.isPieces || this.phase !== "fire") return;
    let hi = this.scenario.impactLo;
    for (let i = 0; i < this.floors.length; i++) {
      if (this.floors[i].cols.some((c) => c.burning > 0.2)) hi = i + 1;
    }
    this.camTY = hi * this.floorH;
    this.camTX = this.width * 0.32;
  }

  private ambientFireParticles(): void {
    if (this.particles.length > PARTICLE_CAP - 40) return;
    const lo = 1;
    const hi = this.floors.length;
    for (let story = lo; story <= hi; story++) {
      const f = this.floors[story - 1];
      if (!f) continue;
      for (let c = 0; c < COLS; c++) {
        const col = f.cols[c];
        if (col.burning < 0.2) continue;
        if (hash(this.t * 0.01 + story * 3 + c) > 0.72) continue;
        const x = COL_X[c] * this.width + (hash(story + c + this.t) - 0.5) * Math.min(6, this.width * 0.2);
        const y = story * this.floorH;
        this.spawn("fire", x, y, 4, 14, (hash(story * 19 + c) - 0.5) * this.width * 0.9);
        if (col.burning > 0.4) this.spawn("smoke", x, y + 2, 2, 10, (hash(story * 7 + c) - 0.5) * this.width * 0.7);
      }
    }
  }

  private evaluateStructure(): void {
    const s = this.scenario;
    if (this.floors.length < 2) return;

    for (let i = 0; i < this.floors.length - 1; i++) {
      const f = this.floors[i];
      if (f.state !== "stacked") continue;
      const above = this.floors.length - i;
      const load = above * this.mass * G;
      let cap = 0;
      let moment = 0;
      for (let c = 0; c < COLS; c++) {
        const cc = this.colCapacity(i, c);
        cap += cc;
        const x = (COL_X[c] - 0.5) * this.width;
        moment += cc * x;
      }
      let hat = 1;
      // Hat truss: steel belt at the roof tying the core to the outer columns.
      // After the plane cut columns it hung the damaged side from the intact
      // side — like a picture wire. Load path, not a demolition charge. ~6%.
      if (s.hatTruss && this.floors.length > 20 && i >= s.impactLo - 1 && i <= this.floors.length - 4) {
        const sag = Math.max(...f.cols.map((c) => c.sag));
        hat = sag > 0.62 ? 1 : 1.06;
      }
      cap *= hat;
      const ratio = cap / Math.max(load, 1);

      if (ratio < 1.08) {
        for (let c = 0; c < COLS; c++) {
          const col = f.cols[c];
          if (col.failed) continue;
          const share = this.colCapacity(i, c);
          const demand = load * (share / Math.max(cap, 1));
          if (demand > share * 1.02) {
            col.failed = true;
            col.intact = 0;
            this.spawn("spark", COL_X[c] * this.width, (i + 1) * this.floorH, 20, 40);
          }
        }
      }

      if (ratio < 1) {
        if (s.nistMinutes > 0 && this.t / 60 < s.nistMinutes * 0.72) {
          continue;
        }
        const cgSupport = cap > 1 ? moment / cap : 0;
        const theta = Math.atan2(-cgSupport, this.width * 0.45);
        this.initiate(i, theta);
        return;
      }
    }
    if (s.nistMinutes > 0 && this.t / 60 >= s.nistMinutes * 1.05) {
      this.initiate(s.impactLo - 1, 0);
    }
  }

  colCapacity(floorIndex: number, c: number): number {
    const f = this.floors[floorIndex];
    if (!f) return 0;
    const col = f.cols[c];
    if (col.failed || col.intact < 0.03) return 0;
    const fy = fyFactor(col.temp);
    const em = eFactor(col.temp);
    const bow = 1 / (1 + 4 * col.bow * col.bow);
    const axial = fy * col.intact * this.designCap(floorIndex, c);
    const buckle = em * bow * col.intact * this.designCap(floorIndex, c);
    return Math.min(axial, buckle);
  }

  private initiate(floorIndex: number, theta: number): void {
    if (this.phase !== "fire") return;
    const s = this.scenario;
    this.phase = "collapse";
    this.initiationT = this.t;
    this.trauma = 1;
    this.hitstop = this.reducedMotion ? 0 : 0.12;

    const n = this.floors.length;
    const lo = Math.min(floorIndex + 1, n - 1);
    let mass = 0;
    for (let i = lo; i < n; i++) {
      this.floors[i].state = "block";
      mass += this.floors[i].mass;
    }
    if (mass < 1) mass = this.floors[Math.max(0, n - 1)].mass;
    const h = Math.max(this.floorH, (n - lo) * this.floorH);
    const cgDist = h * 0.5;
    const I = (mass * (this.width * this.width + h * h)) / 12 + mass * cgDist * cgDist * 0.15;

    // North videos: plumb at collapse. South: the UPPER BLOCK leaned a few
    // degrees, then dropped through the footprint. Rotational inertia of a
    // 110-storey tube snaps any impact wobble back to vertical long before
    // fire failure — do not feed planeAngle into the standing shaft.
    const lean = s.crush
      ? clamp(s.planeAngle, -0.14, 0.14)
      : theta === 0
        ? -0.05
        : clamp(theta, -1.2, 1.2);
    this.maxTheta = Math.max(this.maxTheta, Math.abs(lean));
    const hingeX = lean < 0 ? this.width * 0.88 : this.width * 0.12;
    this.block = {
      lo,
      hi: n - 1,
      x: this.width / 2 + Math.sin(lean) * this.floorH * 2,
      bottomY: lo * this.floorH,
      theta: lean,
      vx: s.crush ? lean * 2.4 : lean * this.width * 0.06,
      vy: 0.4,
      omega: s.crush ? lean * 0.05 : lean * 0.15,
      mass,
      I,
      hinged: !s.crush,
      hingeX,
      hingeY: lo * this.floorH,
    };
    this.crushLo = floorIndex;
    const blockH = (n - lo) * this.floorH;
    this.camTX = this.width / 2;
    this.camTY = Math.max(this.floorH * 2, lo * this.floorH - this.floorH * 2.2);
    this.camTS = n <= 12 ? s.actionScale : clamp(380 / Math.max(blockH + lo * this.floorH * 0.25, 8), 0.8, s.actionScale);

    const min = this.t / 60;
    this.pushBubble(
      this.width * 0.55,
      lo * this.floorH + this.floorH,
      "Initiation",
      s.crush
        ? "Storey mechanism. The upper block is attached — it drops with the floor that failed."
        : "Hinge forms. Crush is disabled — this is the cartoon chimney.",
      "critical",
      7,
    );
    this.log(
      min,
      `Initiation at floor ${floorIndex + 1} after ${min.toFixed(0)} min. Tilt ${((Math.abs(lean) * 180) / Math.PI).toFixed(1)}°.`,
      "critical",
    );
    for (let i = 0; i < 60; i++) {
      this.spawn("dust", this.width * (0.2 + hash(i) * 0.6), lo * this.floorH, 20, 55);
      this.spawn("spark", this.width * (0.15 + hash(i + 4) * 0.7), lo * this.floorH + 4, 10, 40);
    }
  }

  private stepCollapse(dt: number): void {
    const b = this.block;
    if (!b) return;
    if (b.hinged) this.stepTree(dt, b);
    else this.stepCrush(dt, b);
  }

  private stepTree(dt: number, b: Block): void {
    const h = (b.hi - b.lo + 1) * this.floorH;
    const cgDist = h * 0.48;
    const sign = b.hingeX > this.width / 2 ? -1 : 1;
    if (Math.abs(b.theta) < 0.03) b.theta = sign * 0.03;
    const torque = b.mass * G * cgDist * Math.sin(b.theta);
    const I = b.I + b.mass * cgDist * cgDist;
    b.omega += (torque / I) * dt;
    b.theta += b.omega * dt;
    this.maxTheta = Math.max(this.maxTheta, Math.abs(b.theta));
    const cgx = b.hingeX + sign * cgDist * Math.sin(b.theta);
    const cgy = b.hingeY + cgDist * Math.cos(b.theta);
    b.x = cgx;
    b.bottomY = cgy - cgDist * Math.cos(b.theta);
    this.camTX = clamp(cgx, this.width * 0.2, this.width);
    this.camTY = Math.max(this.floorH * 2, cgy);
    this.camTS = this.floors.length > 40 ? 3.2 : this.scenario.actionScale * 0.7;
    if (Math.abs(b.theta) > 1.15 || cgy < this.floorH * 2) {
      this.settle("tipped");
    }
    if (hash(this.t * 3) > 0.7) {
      this.spawn("dust", cgx, Math.max(4, cgy - 10), 8, 20);
    }
  }

  private stepCrush(dt: number, b: Block): void {
    b.vy += G * dt;
    b.bottomY -= b.vy * dt;
    // Snap the block back toward vertical as it drops. Inertia of the
    // 110-storey mass does this; the videos are a vertical crush, not a lean.
    b.theta *= Math.exp(-1.1 * dt);
    b.omega *= Math.exp(-2.4 * dt);
    b.x += b.vx * dt;
    b.vx += (this.width / 2 - b.x) * 0.8 * dt;
    b.vx *= Math.exp(-0.8 * dt);
    this.maxTheta = Math.max(this.maxTheta, Math.abs(b.theta));

    let guard = 0;
    while (this.crushLo >= 0 && b.bottomY <= (this.crushLo + 1) * this.floorH + 0.05 && guard < this.floors.length) {
      this.eatFloor(b);
      guard += 1;
    }

    const blockH = Math.max(this.floorH, (b.hi - b.lo + 1) * this.floorH);
    if (this.floors.length <= 12) {
      this.camTX = this.width / 2;
      this.camTY = Math.max(this.floorH, b.bottomY - this.floorH * 2);
      this.camTS = this.scenario.actionScale * 0.85;
    } else {
      this.camTX = this.width / 2 + (b.x - this.width / 2) * 0.25;
      this.camTY = Math.max(this.floorH * 2.5, b.bottomY - this.floorH * 2.5);
      const span = Math.max(this.floorH * 14, blockH * 0.35 + this.floorH * 8);
      this.camTS = clamp(400 / span, 0.85, this.scenario.actionScale);
    }

    if (this.crushLo < 0 && b.bottomY <= Math.max(0.8, this.floorH * 0.4)) this.settle("pancake");

    if (this.particles.length < PARTICLE_CAP - 20) {
      for (let i = 0; i < 3; i++) {
        this.spawn("dust", this.width * (0.12 + hash(this.t + i) * 0.76), b.bottomY + 2, 40, 90);
      }
    }
  }

  private eatFloor(b: Block): void {
    if (this.crushLo < 0) return;
    const idx = this.crushLo;
    const f = this.floors[idx];
    if (f && f.state === "stacked") {
      f.state = "crushed";
      b.mass += f.mass;
    }
    this.spawnDebris(this.width / 2, Math.max(0.4, b.bottomY), 5);
    const ke = 0.5 * b.mass * b.vy * b.vy;
    let cap = 0;
    if (f) {
      for (let c = 0; c < COLS; c++) cap += this.colCapacity(idx, c);
    }
    const eFail = Math.max(cap, 0.15 * this.designCap(Math.max(0, idx), 2)) * this.floorH * 0.22;
    const leftover = Math.max(0, ke - eFail) * 0.38;
    b.vy = Math.sqrt((2 * leftover) / Math.max(b.mass, 1));
    // Collapse videos: the top tilts, then the block drops through the footprint.
    b.theta *= 0.86;
    b.omega *= 0.55;
    b.x += (this.width / 2 - b.x) * 0.14;
    this.crushLo -= 1;
    this.trauma = Math.min(1, this.trauma + 0.12);

    if (!this.energyAnnounced && idx <= this.scenario.impactLo) {
      this.energyAnnounced = true;
      const ratio = ke / Math.max(eFail, 1);
      this.pushBubble(
        this.width * 0.7,
        b.bottomY + this.floorH,
        `${Math.max(2, ratio).toFixed(0)}× floor capacity`,
        "The floors above are still attached. They fall with the storey that failed — they do not hover.",
        "warn",
        6.5,
      );
      this.log(this.t / 60, `Crush front: impact energy ${ratio.toFixed(1)}× storey capacity.`, "warn");
    }

    if (!this.cgAnnounced) {
      const cgx = b.x - this.width / 2;
      this.cgAnnounced = true;
      const inside = Math.abs(cgx) < this.width / 2;
      this.pushBubble(
        b.x,
        b.bottomY + this.floorH,
        inside ? "CGrav still inside the footprint" : "CGrav left the base",
        inside
          ? `Center Gravity ${Math.abs(cgx).toFixed(1)} m off center. Half-width is ${(this.width / 2).toFixed(1)} m.`
          : "This only happens in rigid-tree mode.",
        inside ? "ok" : "critical",
        6,
      );
    }

    for (let i = 0; i < 10; i++) {
      this.spawn("dust", COL_X[i % COLS] * this.width, b.bottomY, 24, 70);
    }
  }

  private settle(how: "pancake" | "tipped"): void {
    this.phase = "settled";
    this.paused = true;
    if (this.block && !this.block.hinged) {
      for (let i = 0; i <= Math.max(0, this.crushLo + 1); i++) {
        if (this.floors[i]?.state === "stacked") this.floors[i].state = "crushed";
      }
      for (let i = 0; i < this.floors.length; i++) {
        if (this.floors[i].state === "block") this.floors[i].state = "crushed";
      }
    }
    const min = this.t / 60;
    const rot = (this.maxTheta * 180) / Math.PI;
    if (how === "pancake") {
      this.pushBubble(
        this.width / 2,
        Math.max(this.floorH * 2, this.height * 0.12),
        "Progressive collapse",
        `Fire ran ${min.toFixed(0)} min, then the crush. Peak tilt ${rot.toFixed(0)}°. Pieces, not a cartoon tip.`,
        "critical",
        10,
      );
      this.log(min, `Settled as a debris pile. Peak rotation ${rot.toFixed(1)}°.`, "critical");
    } else {
      this.pushBubble(
        this.width * 0.8,
        Math.max(this.floorH * 3, this.height * 0.2),
        "Tipped — because crush was off",
        "This is the model that produces the video in your head. It requires floors that cannot fail.",
        "warn",
        10,
      );
      this.log(min, `Rigid-tree tip-over at ${rot.toFixed(0)}°. Crush was disabled.`, "warn");
    }
    this.camTX = this.width / 2;
    this.camTY = how === "tipped" ? Math.max(8, this.height * 0.2) : Math.max(3, Math.min(this.height * 0.14, 50));
    this.camTS = this.floors.length > 40 ? (how === "tipped" ? 2.0 : 2.4) : this.scenario.actionScale * 0.7;
    this.trauma = 0.45;
    for (let i = 0; i < 80; i++) {
      this.spawn("dust", this.width * hash(i + 2), 8 + hash(i + 5) * 30, 10, 40);
    }
  }

  private emitAmbient(): void {
    if (this.phase !== "fire") return;
    const s = this.scenario;
    const min = this.t / 60;
    if (this.isPieces) {
      const hot = hottest(this.pieces);
      if (hot && !this.steelAnnounced && hot.temp > (hot.material === "wood" ? 280 : 520)) {
        this.steelAnnounced = true;
        this.pushBubble(
          hot.x,
          hot.y,
          `${hot.temp.toFixed(0)}°C — ${(fyOf(hot) * 100).toFixed(0)}% strength`,
          hot.material === "wood"
            ? "Wood does not need to vanish. Char eats the section. Remaining timber carries less."
            : "Steel does not need to melt. Office fires run 600–1000°C. Melting is 1500°C.",
          "fire",
          7,
        );
      }
      return;
    }
    const mid = clamp(Math.floor((s.impactLo + s.impactHi) / 2) - 1, 0, Math.max(0, this.floors.length - 1));
    const f = this.floors[mid];
    if (!f) return;
    let hot = 0;
    let farFire = 0;
    for (let c = 0; c < COLS; c++) {
      hot = Math.max(hot, f.cols[c].temp);
      if (c >= 3 && f.cols[c].burning > 0.15) farFire++;
    }
    const sag = f.cols[0].sag;

    if (!this.hatAnnounced && s.hatTruss && min > Math.min(8, Math.max(0.6, this.n * 0.04))) {
      this.hatAnnounced = true;
      this.pushBubble(
        this.width * 0.5,
        Math.max(this.floorH, this.height - this.floorH),
        "Roof belt",
        "Load is walking around the wound through the roof belt.",
        "info",
        8,
      );
      this.log(min, "Roof belt redistributing load around the wound.", "info");
    }
    if (!this.steelAnnounced && hot > 520) {
      this.steelAnnounced = true;
      this.pushBubble(
        COL_X[0] * this.width,
        (mid + 1) * this.floorH,
        `${hot.toFixed(0)}°C — ~${(fyFactor(hot) * 100).toFixed(0)}% yield`,
        "Steel does not need to melt. Office fires run 600–1000°C. Melting is 1500°C.",
        "fire",
        7,
      );
      this.log(min, `Unprotected steel in the impact belt at ${hot.toFixed(0)}°C.`, "fire");
    }
    if (!this.sagAnnounced && sag > 0.28) {
      this.sagAnnounced = true;
      this.pushBubble(
        this.width * 0.22,
        (mid + 1) * this.floorH - 4,
        "Floors sagging",
        "Joists pull the perimeter inward. Bowed columns buckle at a fraction of their design load.",
        "warn",
        7,
      );
      this.log(min, "Sagging floors pulling perimeter columns inward.", "warn");
    }
    if (s.noFire && !this.stoodAnnounced && min > 20) {
      this.stoodAnnounced = true;
      this.pushBubble(
        this.width * 0.55,
        ((s.impactLo + s.impactHi) / 2) * this.floorH,
        "Still standing",
        "Same gash, no fire. Residual capacity is still ~2×. Impact was not enough.",
        "ok",
        8,
      );
      this.log(min, "No fire. Tower remains standing on residual capacity.", "ok");
    }
    if (!this.spreadAnnounced && farFire > 0 && s.fireSpread > 0) {
      this.spreadAnnounced = true;
      this.pushBubble(
        COL_X[4] * this.width,
        (mid + 1) * this.floorH,
        "Fire spreads",
        "It did not have to start there. Heat walked. Four sides do not have to be hit to be on fire.",
        "fire",
        7,
      );
      this.log(min, "Fire reached the opposite face.", "fire");
    }
  }

  private pushBubble(
    x: number,
    y: number,
    title: string,
    detail: string,
    kind: BubbleKind,
    ttl: number,
  ): void {
    if (this.t - this.lastBubble < 50 && kind !== "critical") return;
    this.lastBubble = this.t;
    this.bubbles.push({
      id: this.bubbleSeq++,
      x,
      y,
      title,
      detail,
      kind,
      born: this.t,
      ttl,
    });
    if (this.bubbles.length > 5) this.bubbles.shift();
  }

  private log(tMin: number, text: string, kind: BubbleKind): void {
    this.events.push({ tMin, text, kind });
    if (this.events.length > 40) this.events.shift();
  }

  private ageBubbles(dt: number): void {
    for (const b of this.bubbles) b.ttl -= dt;
    this.bubbles = this.bubbles.filter((b) => b.ttl > 0);
  }

  private spawn(kind: Particle["kind"], x: number, y: number, speed: number, life: number, z = 0): void {
    if (this.particles.length >= PARTICLE_CAP) {
      this.particles.splice(0, 40);
    }
    const indoor = this.scenario.shape === "house" || this.scenario.shape === "apartment";
    const rise = indoor ? 0.12 : 1;
    const a = hash(x + y + this.t + this.particles.length) * Math.PI * 2;
    const sp = speed * (0.4 + hash(y + 9) * 0.8);
    const vx =
      kind === "smoke"
        ? (hash(x + 1) - 0.5) * 6 * (indoor ? 0.15 : 1)
        : kind === "dust"
          ? (hash(x + 2) - 0.5) * sp
          : Math.cos(a) * sp * (indoor ? 0.12 : 0.4);
    const vy =
      kind === "smoke"
        ? (6 + hash(y) * 10) * (indoor ? 0.16 : 1)
        : kind === "fire"
          ? (4 + hash(y + 3) * 10) * rise
          : kind === "dust"
            ? (hash(y + 4) - 0.2) * sp
            : Math.sin(a) * sp;
    this.particles.push({
      x,
      y,
      z: z + (hash(x + 17) - 0.5) * (indoor ? 0.12 : Math.max(0.4, this.width * 0.08)),
      vx,
      vy,
      vz: (hash(y + 21) - 0.5) * speed * (indoor ? 0.06 : 0.4),
      life,
      maxLife: life,
      size: kind === "smoke" ? 6 + hash(x) * 10 : kind === "dust" ? 3 + hash(x) * 5 : 2 + hash(x) * 3,
      kind,
    });
  }

  private stepParticles(dt: number): void {
    const g = this.phase === "collapse" || this.phase === "settled" ? 18 : 4;
    for (const p of this.particles) {
      p.life -= dt * 18;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.kind === "dust") p.vy -= g * dt;
      if (p.kind === "spark") p.vy -= 30 * dt;
      if (p.kind === "smoke" || p.kind === "fire") {
        p.vx *= Math.exp(-0.4 * dt);
        p.vz *= Math.exp(-0.4 * dt);
      }
    }
    if (this.particles.length > 80) {
      this.particles = this.particles.filter((p) => p.life > 0);
    }
  }

  private decayTrauma(dt: number): void {
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }

  private stepCamera(dt: number): void {
    const k = this.phase === "approach" ? 6 : 3.2;
    const a = 1 - Math.exp(-k * dt);
    this.camX += (this.camTX - this.camX) * a;
    this.camY += (this.camTY - this.camY) * a;
    this.camS += (this.camTS - this.camS) * a;
    this.fullX += (this.fullTX - this.fullX) * a;
    this.fullY += (this.fullTY - this.fullY) * a;
    this.fullS += (this.fullTS - this.fullS) * a;
  }

  standingLean(): number {
    if (this.isPieces) {
      const cg = pieceCgrav(this.pieces);
      return clamp(Math.atan2(cg.x - this.width / 2, Math.max(0.4, cg.y)), -0.2, 0.2);
    }
    // Standing tower is plumb. Capacity eccentricity is a CGrav offset in
    // metres, shown as the CGrav line — not a banana lean of the shaft.
    return 0;
  }

  tilt(): number {
    if (this.block) return this.block.theta;
    return this.standingLean();
  }

  cgOffset(): number {
    if (this.isPieces) return pieceCgrav(this.pieces).x - this.width / 2;
    if (this.block) return this.block.x - this.width / 2;
    return this.capacityEcc();
  }

  private capacityEcc(): number {
    const s = this.scenario;
    const mid = clamp(Math.floor((s.impactLo + s.impactHi) / 2) - 1, 0, Math.max(0, this.floors.length - 1));
    let moment = 0;
    let cap = 0;
    for (let c = 0; c < COLS; c++) {
      const cc = this.colCapacity(mid, c);
      cap += cc;
      moment += cc * (COL_X[c] - 0.5) * this.width;
    }
    return cap > 1 ? moment / cap : 0;
  }

  cgravY(): number {
    if (this.isPieces) return pieceCgrav(this.pieces).y;
    if (this.block) return this.block.bottomY + ((this.block.hi - this.block.lo + 1) * this.floorH) / 2;
    return ((this.scenario.impactLo + this.n) / 2) * this.floorH;
  }

  private face(cols: number[]): FaceStatus {
    if (this.isPieces) {
      let temp = 0;
      let fire = 0;
      let cap = 0;
      let dmg = 0;
      let n = 0;
      for (const p of this.pieces) {
        if (!cols.includes(Math.max(0, Math.min(4, p.col)))) continue;
        n += 1;
        temp = Math.max(temp, p.temp);
        fire = Math.max(fire, p.burning);
        cap += fyOf(p);
        dmg += 1 - p.intact;
      }
      return {
        temp,
        fire,
        cap: n > 0 ? cap / n : 1,
        damage: n > 0 ? dmg / n : 0,
      };
    }
    const s = this.scenario;
    const mid = clamp(Math.floor((s.impactLo + s.impactHi) / 2) - 1, 0, Math.max(0, this.floors.length - 1));
    const f = this.floors[mid];
    if (!f) return { temp: 22, fire: 0, cap: 1, damage: 0 };
    let temp = 0;
    let fire = 0;
    let cap = 0;
    let dmg = 0;
    for (const c of cols) {
      temp = Math.max(temp, f.cols[c].temp);
      fire = Math.max(fire, f.cols[c].burning);
      cap += this.colCapacity(mid, c);
      dmg += 1 - f.cols[c].intact;
    }
    const design = cols.reduce((a, c) => a + this.designCap(mid, c), 0);
    return {
      temp,
      fire,
      cap: design > 0 ? cap / design : 0,
      damage: dmg / cols.length,
    };
  }

  probe(): Probe | null {
    if (this.isPieces) {
      const p = hottest(this.pieces);
      if (!p) return null;
      return {
        label: `${p.kind} #${p.id}`,
        temp: p.temp,
        fy: fyOf(p),
        ratio: fyOf(p),
        burning: p.burning,
        dynamic: p.dynamic,
      };
    }
    if (this.floors.length === 0) return null;
    const s = this.scenario;
    const mid = clamp(Math.floor((s.impactLo + s.impactHi) / 2) - 1, 0, this.floors.length - 1);
    const col = this.floors[mid].cols[0];
    const cap = this.colCapacity(mid, 0);
    const des = this.designCap(mid, 0);
    return {
      label: `impact-face storey ${mid + 1}`,
      temp: col.temp,
      fy: fyFactor(col.temp) * col.intact,
      ratio: des > 0 ? cap / des : 1,
      burning: col.burning,
      dynamic: false,
    };
  }

  snapshot(): SimSnapshot {
    const s = this.scenario;
    const theta = this.tilt();
    const cg = this.cgOffset();
    const half = this.width / 2;
    const faces = {
      impact: this.face([0]),
      sides: this.face([1, 3]),
      core: this.face([2]),
      opposite: this.face([4]),
    };
    let load = 0;
    let left = 0;
    let core = 0;
    let right = 0;
    let leftDes = 1;
    let coreDes = 1;
    let rightDes = 1;
    if (!this.isPieces && this.floors.length > 0) {
      const mid = clamp(Math.floor((s.impactLo + s.impactHi) / 2) - 1, 0, this.floors.length - 1);
      load = (this.floors.length - mid) * this.mass * G;
      left = this.colCapacity(mid, 0) + this.colCapacity(mid, 1);
      core = this.colCapacity(mid, 2);
      right = this.colCapacity(mid, 3) + this.colCapacity(mid, 4);
      leftDes = this.designCap(mid, 0) + this.designCap(mid, 1);
      coreDes = this.designCap(mid, 2);
      rightDes = this.designCap(mid, 3) + this.designCap(mid, 4);
    } else {
      left = faces.impact.cap;
      core = faces.core.cap;
      right = faces.opposite.cap;
    }
    let ke = this.block ? 0.5 * this.block.mass * this.block.vy * this.block.vy : 0;
    if (this.isPieces) {
      for (const p of this.pieces) {
        if (p.dynamic) ke += 0.5 * p.mass * (p.vx * p.vx + p.vy * p.vy);
      }
    }
    const simMin = this.phase === "idle" || this.phase === "approach" ? 0 : this.t / 60;
    const rot = Math.abs(theta);
    const loose = this.pieces.filter((p) => p.dynamic).length;

    let verdict = s.hasPlane ? "Awaiting impact." : "Awaiting ignition.";
    if (s.noFire && this.phase === "fire") {
      verdict = "Impact only. Remaining capacity still above 2×. It stands.";
    } else if (this.phase === "fire") {
      verdict =
        rot > 0.05
          ? "The fire side is the soft side. CGrav has shifted — still well inside the base."
          : this.isPieces
            ? "Heating members. Strength is a function of temperature. Nothing is painted on."
            : "Heating. The roof belt is carrying the wound.";
    } else if (this.phase === "collapse" && this.block?.hinged) {
      verdict = "Rigid tree: the upper block is rotating off a hinge because crush is forbidden.";
    } else if (this.phase === "collapse") {
      verdict =
        Math.abs(cg) < half
          ? this.isPieces
            ? "Members unlocking. Gravity is integrating. CGrav is still over the footprint."
            : `Upper block is dropping through the footprint. Rotation is a rounding error on a ${this.width.toFixed(this.width < 10 ? 0 : 1)} m base.`
          : "CGrav left the base — that is the tree model.";
    } else if (this.phase === "settled") {
      verdict = this.block?.hinged
        ? "Tipped, because floors were not allowed to fail. That assumption is the whole trick."
        : s.shape === "house"
          ? "Burned down. Timber charred, roof in the footprint. Center Gravity stayed over the base."
          : `Rubble. Peak tilt ${((this.maxTheta * 180) / Math.PI).toFixed(0)}°. Center Gravity never needed to leave the square.`;
    }

    return {
      phase: this.phase,
      paused: this.paused,
      simMin,
      clock: formatClock(s.clockStart, this.phase === "approach" || this.phase === "idle" ? 0 : this.t),
      rotationDeg: (theta * 180) / Math.PI,
      maxRotationDeg: (this.maxTheta * 180) / Math.PI,
      cgOffsetM: cg,
      halfWidth: half,
      cgInside: Math.abs(cg) < half - Math.min(1, half * 0.08),
      leftCap: leftDes > 0 ? left / leftDes : left,
      coreCap: coreDes > 0 ? core / coreDes : core,
      rightCap: rightDes > 0 ? right / rightDes : right,
      loadN: load,
      keJ: ke,
      fallingMassKg: this.block?.mass ?? this.pieces.filter((p) => p.dynamic).reduce((a, p) => a + p.mass, 0),
      initiationMin: this.initiationT === null ? null : this.initiationT / 60,
      nistMinutes: s.nistMinutes,
      faces,
      events: this.events.slice(-12),
      bubbles: this.bubbles,
      verdict,
      crush: s.crush,
      storyFocus: Math.floor((s.impactLo + s.impactHi) / 2),
      impactLo: s.impactLo,
      impactHi: s.impactHi,
      hasAntenna: s.hasAntenna,
      hasPlane: s.hasPlane,
      widthM: this.width,
      heightM: this.height,
      storeys: this.n,
      nextId: s.nextId,
      pathStep: s.pathStep,
      world: s.world,
      shape: s.shape,
      steps: this.steps,
      probe: this.probe(),
      hatTruss: s.hatTruss,
      pieceCount: this.pieces.length,
      looseCount: loose,
    };
  }
}
