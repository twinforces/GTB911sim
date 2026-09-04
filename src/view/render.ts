/**
 * 2D camera helpers the 3D view still uses for floor transforms.
 * Presentation math. Not strength, not gravity.
 */
import { ANTENNA, COLS, COL_X } from "@/model/constants";
import type { SimEngine } from "@/model/engine";
import { rgbCss, steelRgb } from "@/model/steel";
import type { Particle, Piece } from "@/model/types";
import { woodRgb } from "@/model/wood";

export interface View {
  x: number;
  y: number;
  scale: number;
  cssW: number;
  cssH: number;
}

export type ViewMode = "full" | "action";

export function makeView(
  engine: SimEngine,
  cssW: number,
  cssH: number,
  timeSec: number,
  mode: ViewMode,
): View {
  const shake = engine.reducedMotion ? 0 : engine.trauma * engine.trauma;
  const sx = Math.sin(timeSec * 41.3) * shake * (mode === "action" ? 7 : 3);
  const sy = Math.cos(timeSec * 33.1) * shake * (mode === "action" ? 5 : 2);
  const cx = mode === "full" ? engine.fullX : engine.camX;
  const cy = mode === "full" ? engine.fullY : engine.camY;
  const cs = mode === "full" ? engine.fullS : engine.camS;
  return {
    x: cx - sx / Math.max(cs, 0.01),
    y: cy + sy / Math.max(cs, 0.01),
    scale: cs,
    cssW,
    cssH,
  };
}

export function toScreen(view: View, wx: number, wy: number): { x: number; y: number } {
  return {
    x: (wx - view.x) * view.scale + view.cssW / 2,
    y: view.cssH / 2 - (wy - view.y) * view.scale,
  };
}

export function floorTransform(
  engine: SimEngine,
  i: number,
  crushedRank: number,
): { x: number; y: number; theta: number; h: number } {
  const f = engine.floors[i];
  const H = engine.floorH;
  const W = engine.width;
  const debrisH = Math.min(H * 0.18, 10 / Math.max(engine.n, 1));
  if (f.state === "crushed") {
    return {
      x: W / 2 + f.xJitter * 1.8,
      y: crushedRank * debrisH,
      theta: f.rotJitter,
      h: debrisH,
    };
  }
  const b = engine.block;
  if (f.state === "block" && b) {
    if (b.hinged) {
      const localY = (i - b.lo) * H;
      const sign = b.hingeX > W / 2 ? -1 : 1;
      const ang = b.theta;
      const lx = W / 2 - b.hingeX;
      const ly = localY;
      const rx = b.hingeX + lx * Math.cos(ang) - ly * Math.sin(ang) * sign;
      const ry = b.hingeY + lx * Math.sin(ang) * sign + ly * Math.cos(ang);
      return { x: rx, y: ry, theta: ang * sign, h: H };
    }
    // Rigid prism: floors stay parallel. The 0.15 shear + per-slab spin was an
    // accordion artifact — videos show the upper block dropping, not a bellows.
    const localY = (i - b.lo) * H + H * 0.5;
    const c = Math.cos(b.theta);
    const s = Math.sin(b.theta);
    return {
      x: b.x - localY * s,
      y: b.bottomY + localY * c - H * 0.5,
      theta: b.theta,
      h: H,
    };
  }
  // Remaining storeys stay plumb. Standing lean was a unit bug: eccentricity
  // in metres was fed to atan2 as if it were a force, which bent the shaft
  // into a banana. Videos of both towers show a vertical stack until the
  // upper block detaches.
  return { x: W / 2, y: i * H, theta: 0, h: H };
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  engine: SimEngine,
  view: View,
  timeSec: number,
  mode: ViewMode,
): void {
  const { cssW, cssH } = view;
  ctx.clearRect(0, 0, cssW, cssH);
  drawBackdrop(ctx, cssW, cssH);
  drawGround(ctx, engine, view);
  if (engine.isPieces) drawPieces(ctx, engine, view);
  else drawTower(ctx, engine, view);
  drawPlane(ctx, engine, view);
  drawParticles(ctx, engine, view);
  drawCgrav(ctx, engine, view);
  drawScale(ctx, engine, view);
  if (mode === "action") drawLegend(ctx, engine, cssW);
  if (mode === "full") drawEulerHud(ctx, engine, view);
  void timeSec;
}

function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#0e1014");
  g.addColorStop(1, "#08090b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    const x = ((i + 1) / 15) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGround(ctx: CanvasRenderingContext2D, engine: SimEngine, view: View): void {
  const W = engine.width;
  const pit = engine.pit;
  const gy = toScreen(view, 0, 0).y;
  ctx.fillStyle = "#14161c";
  ctx.fillRect(0, gy, view.cssW, view.cssH);

  if (pit) {
    const fl = toScreen(view, pit.left, 0);
    const fr = toScreen(view, pit.right, 0);
    const bl = toScreen(view, pit.left, -pit.depth);
    const br = toScreen(view, pit.right, -pit.depth);
    ctx.fillStyle = "#101218";
    ctx.beginPath();
    ctx.moveTo(fl.x, fl.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(fr.x, fr.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(197,205,216,0.35)";
    ctx.stroke();
    ctx.fillStyle = "rgba(236,235,230,0.4)";
    ctx.font = "500 11px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("pit", (fl.x + fr.x) / 2, bl.y + 16);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, gy);
  ctx.lineTo(view.cssW, gy);
  ctx.stroke();

  const left = toScreen(view, 0, 0);
  const right = toScreen(view, W, 0);
  ctx.fillStyle = "rgba(197,205,216,0.08)";
  ctx.fillRect(left.x, gy, right.x - left.x, 8);
  ctx.strokeStyle = "rgba(197,205,216,0.45)";
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(left.x, gy - 2, right.x - left.x, 6);
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(236,235,230,0.45)";
  ctx.font = "500 11px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  const noun = pit ? "pit" : "footprint";
  const label = W < 10 ? `${W.toFixed(1)} m ${noun}` : `${W.toFixed(1)} m ${noun}`;
  ctx.fillText(label, (left.x + right.x) / 2, gy + 22);
}

function drawPiece(ctx: CanvasRenderingContext2D, view: View, p: Piece): void {
  const c = toScreen(view, p.x, p.y);
  const s = view.scale;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(-p.theta);
  const w = p.w * s;
  const h = Math.max(1.2, p.h * s);
  if (p.burning > 0.12) {
    ctx.fillStyle = `rgba(226,88,34,${0.12 + p.burning * 0.28})`;
    ctx.fillRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
  }
  const rgb = p.material === "wood" ? woodRgb(p.temp, p.intact) : steelRgb(p.temp);
  ctx.fillStyle = rgbCss(rgb, p.dynamic ? 0.92 : 1);
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = p.failed ? "rgba(0,0,0,0.45)" : "rgba(10,12,16,0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  if (p.material === "wood" && p.w > p.h * 2 && s > 20) {
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 2, 0);
    ctx.lineTo(w / 2 - 2, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPieces(ctx: CanvasRenderingContext2D, engine: SimEngine, view: View): void {
  if (engine.phase === "collapse" || engine.phase === "settled") {
    const origin = toScreen(view, engine.width / 2, 0);
    const top = toScreen(view, engine.width / 2, engine.height);
    const left = toScreen(view, 0, 0);
    const right = toScreen(view, engine.width, 0);
    ctx.save();
    ctx.strokeStyle = "rgba(236,235,230,0.18)";
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    ctx.strokeRect(left.x, top.y, right.x - left.x, origin.y - top.y);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(236,235,230,0.28)";
    ctx.font = "500 10px 'IBM Plex Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("original", right.x + 8, top.y + 10);
    ctx.restore();
  }
  const locked = engine.pieces.filter((p) => !p.dynamic);
  const loose = engine.pieces.filter((p) => p.dynamic);
  for (const p of locked) drawPiece(ctx, view, p);
  for (const p of loose) drawPiece(ctx, view, p);
}

function drawTower(ctx: CanvasRenderingContext2D, engine: SimEngine, view: View): void {
  const s = view.scale;
  const showDetail = s > 3.2 || engine.n <= 12;
  const W = engine.width;
  const n = engine.floors.length;
  let crushedRank = 0;

  for (let i = 0; i < n; i++) {
    const f = engine.floors[i];
    if (!f) continue;
    const rank = f.state === "crushed" ? crushedRank : 0;
    if (f.state === "crushed") crushedRank += 1;
    const tf = floorTransform(engine, i, rank);
    const p = toScreen(view, tf.x, tf.y);
    const w = W * s;
    const h = Math.max(1.1, tf.h * s);
    const story = i + 1;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-tf.theta);

    if (f.state === "crushed") {
      ctx.fillStyle = "rgba(70,68,64,0.85)";
      ctx.fillRect(-w / 2, -h, w * 0.92, Math.max(h, 1.2));
      ctx.restore();
      continue;
    }

    const burning = Math.max(...f.cols.map((c) => c.burning));
    if (burning > 0.08) {
      ctx.fillStyle = `rgba(226,88,34,${0.08 + burning * 0.22})`;
      ctx.fillRect(-w / 2 - 4, -h - 1, w + 8, h + 2);
    }

    ctx.fillStyle =
      story >= engine.scenario.impactLo && story <= engine.scenario.impactHi && f.state === "stacked"
        ? "#4a4e56"
        : "#9aa3b0";
    ctx.fillRect(-w / 2, -h + 0.4, w, h - 0.6);

    ctx.fillStyle = "rgba(22,24,30,0.35)";
    ctx.fillRect(-w * 0.12, -h + 0.4, w * 0.24, h - 0.6);

    if (showDetail) {
      ctx.strokeStyle = "rgba(10,12,16,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(-w / 2, -h + 0.4, w, h - 0.6);
    }

    if (f.state === "stacked" && story >= engine.scenario.impactLo && story <= engine.scenario.impactHi) {
      const wound = (1 - f.cols[0].intact) * w * 0.22;
      ctx.fillStyle = "rgba(8,8,10,0.92)";
      ctx.fillRect(-w / 2, -h + 0.4, Math.max(wound, engine.scenario.hasPlane ? 0 : w * 0.04), h - 0.6);
    }

    for (let c = 0; c < COLS; c++) {
      const col = f.cols[c];
      const cx = (COL_X[c] - 0.5) * w;
      const rgb = steelRgb(col.temp);
      const alpha = col.failed ? 0.25 : 0.55 + col.intact * 0.45;
      ctx.strokeStyle = rgbCss(rgb, alpha);
      ctx.lineWidth = Math.max(1.6, (c === 2 ? 4.2 : 2.6) * Math.min(s / 5, 1.6));
      ctx.beginPath();
      const bow = col.bow * 6 * (s / 8);
      const side = c < 2 ? 1 : -1;
      ctx.moveTo(cx, 0);
      if (bow > 0.4 && showDetail) {
        ctx.quadraticCurveTo(cx + side * bow, -h / 2, cx, -h);
      } else {
        ctx.lineTo(cx, -h);
      }
      ctx.stroke();
    }

    const labelEvery = n <= 12 ? 1 : 10;
    if (showDetail && (story % labelEvery === 0 || story === engine.scenario.impactLo || story === n)) {
      ctx.fillStyle = "rgba(236,235,230,0.35)";
      ctx.font = "500 10px 'IBM Plex Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(`${story}`, w / 2 + 8, -h / 2 + 3);
    }

    ctx.restore();
  }

  if ((engine.phase === "collapse" || engine.phase === "settled") && n <= 12 && n > 0) {
    const origin = toScreen(view, W / 2, 0);
    const top = toScreen(view, W / 2, engine.height);
    const left = toScreen(view, 0, 0);
    const right = toScreen(view, W, 0);
    ctx.save();
    ctx.strokeStyle = "rgba(236,235,230,0.18)";
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    ctx.strokeRect(left.x, top.y, right.x - left.x, origin.y - top.y);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(236,235,230,0.28)";
    ctx.font = "500 10px 'IBM Plex Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("original", right.x + 8, top.y + 10);
    ctx.restore();
  }

  const topFloor = engine.floors[n - 1];
  if (engine.scenario.hasAntenna && topFloor && topFloor.state !== "crushed") {
    const tf = floorTransform(engine, n - 1, 0);
    const top = toScreen(view, tf.x, tf.y + engine.floorH);
    const tip = toScreen(view, tf.x, tf.y + engine.floorH + ANTENNA);
    ctx.strokeStyle = "rgba(180,186,196,0.7)";
    ctx.lineWidth = Math.max(1, view.scale * 0.08);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
  }

  for (const p of engine.pieces) drawPiece(ctx, view, p);
}

function drawPlane(ctx: CanvasRenderingContext2D, engine: SimEngine, view: View): void {
  const p = engine.plane;
  if (p.alive) {
    const s = toScreen(view, p.x, p.y);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(-p.angle);
    ctx.fillStyle = "#c5cdd8";
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-16, 5);
    ctx.lineTo(-12, 0);
    ctx.lineTo(-16, -5);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-4, -10, 3, 20);
    ctx.restore();
    return;
  }
  if (engine.planeFlash > 0) {
    const s = toScreen(view, engine.width * 0.12, p.y);
    const a = engine.planeFlash / 0.7;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillStyle = `rgba(255,220,160,${0.55 * a})`;
    ctx.beginPath();
    ctx.arc(0, 0, 18 + (1 - a) * 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, engine: SimEngine, view: View): void {
  for (const p of engine.particles) drawParticle(ctx, view, p);
}

function drawParticle(ctx: CanvasRenderingContext2D, view: View, p: Particle): void {
  const s = toScreen(view, p.x, p.y);
  const a = Math.max(0, p.life / p.maxLife);
  const r = p.size * (0.6 + (1 - a) * 0.8);
  if (p.kind === "fire") ctx.fillStyle = `rgba(226,120,40,${0.55 * a})`;
  else if (p.kind === "smoke") ctx.fillStyle = `rgba(90,90,96,${0.22 * a})`;
  else if (p.kind === "spark") ctx.fillStyle = `rgba(255,210,120,${0.8 * a})`;
  else ctx.fillStyle = `rgba(150,148,142,${0.28 * a})`;
  ctx.beginPath();
  ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawCgrav(ctx: CanvasRenderingContext2D, engine: SimEngine, view: View): void {
  if (engine.phase === "idle" || engine.phase === "approach") return;
  const W = engine.width;
  const cgx = W / 2 + engine.cgOffset();
  const cgy = Math.max(0.2, engine.cgravY());
  const top = toScreen(view, cgx, cgy);
  const bot = toScreen(view, cgx, engine.pit ? -engine.pit.depth : 0);
  const inside = Math.abs(engine.cgOffset()) < W / 2 - Math.min(1, W * 0.04);
  ctx.strokeStyle = inside ? "rgba(125,155,122,0.85)" : "rgba(196,92,74,0.9)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(bot.x, bot.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = inside ? "#7d9b7a" : "#c45c4a";
  ctx.beginPath();
  ctx.arc(top.x, top.y, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(236,235,230,0.7)";
  ctx.font = "500 10px 'IBM Plex Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText("CGrav", top.x + 8, top.y + 3);
}

function drawScale(ctx: CanvasRenderingContext2D, engine: SimEngine, view: View): void {
  const barM = engine.width < 4 ? 1 : engine.width < 8 ? 2 : engine.width < 30 ? 5 : 20;
  const p0 = toScreen(view, 0, 0.2);
  const p1 = toScreen(view, barM, 0.2);
  const len = p1.x - p0.x;
  if (len < 12) return;
  const x = 20;
  const y = view.cssH - 36;
  ctx.strokeStyle = "rgba(236,235,230,0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + len, y);
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x, y + 4);
  ctx.moveTo(x + len, y - 4);
  ctx.lineTo(x + len, y + 4);
  ctx.stroke();
  ctx.fillStyle = "rgba(236,235,230,0.45)";
  ctx.font = "500 10px 'IBM Plex Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(`${barM} m`, x, y - 8);
}

function drawEulerHud(ctx: CanvasRenderingContext2D, engine: SimEngine, view: View): void {
  ctx.save();
  ctx.font = "500 10px 'IBM Plex Mono', monospace";
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(236,235,230,0.42)";
  const line = `Euler ${engine.steps.toLocaleString()} · g 9.81 · dt 1/60`;
  ctx.fillText(line, view.cssW - 14, view.cssH - 14);
  ctx.restore();
}

function drawLegend(ctx: CanvasRenderingContext2D, engine: SimEngine, w: number): void {
  const wood = engine.scenario.shape === "bonfire" || engine.scenario.shape === "house";
  const items: [string, string][] = [
    [wood ? "#765636" : "#7a808c", wood ? "Wood" : "Intact steel"],
    ["#cc5630", "Heated"],
    ["#e25822", "Fire"],
    ["#7d9b7a", "CGrav plumb"],
  ];
  const x = w - 132;
  let y = 18;
  ctx.font = "500 10px 'IBM Plex Sans', sans-serif";
  ctx.textAlign = "left";
  for (const [color, label] of items) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 8, 8);
    ctx.fillStyle = "rgba(236,235,230,0.55)";
    ctx.fillText(label, x + 14, y + 8);
    y += 16;
  }
}
