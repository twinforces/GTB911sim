/**
 * Engine orchestration — Fire Speed vs gravity, play/pause, standing lean.
 *
 * CRITIC: “Fire Speed also speeds up the collapse.”
 * Two engines, same wall-clock second, 8× vs 80×. The hotter Fire Speed
 * must heat more. Locked members must not pick up extra vy.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SimEngine } from "./engine.ts";
import { hottest } from "./pieces.ts";
import { scenarioById } from "./scenarios.ts";

describe("SimEngine play/pause/speed", () => {
  it("starts idle and paused", () => {
    const e = new SimEngine(scenarioById("bonfire"));
    assert.equal(e.phase, "idle");
    assert.equal(e.paused, true);
    const snap = e.snapshot();
    assert.equal(snap.phase, "idle");
    assert.equal(snap.paused, true);
  });

  it("play on a bonfire ignites one log and enters fire", () => {
    const e = new SimEngine(scenarioById("bonfire"));
    e.play();
    assert.equal(e.phase, "fire");
    assert.equal(e.paused, false);
    const lit = e.pieces.filter((p) => p.burning > 0);
    assert.equal(lit.length, 1);
  });

  it("pause freezes the clock", () => {
    const e = new SimEngine(scenarioById("house1"));
    e.play();
    e.pause();
    const t0 = e.t;
    const temp0 = hottest(e.pieces)!.temp;
    for (let i = 0; i < 30; i++) e.step(1 / 60);
    assert.equal(e.t, t0);
    assert.equal(hottest(e.pieces)!.temp, temp0);
  });

  it("setSpeed clamps to 1..240", () => {
    const e = new SimEngine(scenarioById("house1"));
    e.setSpeed(0);
    assert.equal(e.speed, 1);
    e.setSpeed(999);
    assert.equal(e.speed, 240);
    e.setSpeed(24);
    assert.equal(e.speed, 24);
  });
});

describe("Fire Speed vs gravity", () => {
  it("higher Fire Speed heats faster and does not add gravity on locked members", () => {
    const slow = new SimEngine(scenarioById("house1"));
    const fast = new SimEngine(scenarioById("house1"));
    slow.play();
    fast.play();
    slow.setSpeed(8);
    fast.setSpeed(80);
    for (let i = 0; i < 60; i++) {
      slow.step(1 / 60);
      fast.step(1 / 60);
    }
    const ts = hottest(slow.pieces)!.temp;
    const tf = hottest(fast.pieces)!.temp;
    assert.ok(tf > ts + 15, `80× must heat more than 8× over the same wall-clock second (${tf} vs ${ts})`);
    const lockedVy = (e: SimEngine) =>
      e.pieces.filter((p) => !p.dynamic).reduce((a, p) => a + Math.abs(p.vy), 0);
    assert.ok(lockedVy(slow) < 0.05, "still-locked members do not fall");
    assert.ok(lockedVy(fast) < 0.05, "still-locked members do not fall at 80× either");
    const falling = fast.pieces.filter((p) => p.dynamic);
    for (const p of falling) {
      // 1 s of wall-clock at g=9.81 → |vy| ~ 10 m/s, not 80× that.
      assert.ok(Math.abs(p.vy) < 25, `falling at 1× g, not Fire Speed × g (vy=${p.vy} kind=${p.kind})`);
      assert.ok(Math.abs(p.vx) < 8, `Newton 1: no demolition kick (vx=${p.vx})`);
    }
    assert.ok(fast.t > slow.t, "sim time (heating clock) advances faster at 80×");
  });
});

describe("house action camera", () => {
  it("holds the living room on tree and couch, then pulls outside when the house falls", () => {
    const e = new SimEngine(scenarioById("house1"));
    e.play();
    assert.equal(e.houseCam, "room");
    const couch = e.pieces.find((p) => p.kind === "couch")!;
    couch.burning = 0.5;
    e.step(1 / 60);
    assert.equal(e.houseCam, "room", "couch catching does not jump behind the couch");
    const stud = e.pieces.find((p) => p.kind === "stud")!;
    stud.dynamic = true;
    e.phase = "collapse";
    e.step(1 / 60);
    assert.equal(e.houseCam, "outside");
  });
});

describe("apartment action camera", () => {
  it("holds a static shot of the building — it does not hunt the fire", () => {
    const e = new SimEngine(scenarioById("apartment"));
    e.play();
    const x0 = e.camTX;
    const y0 = e.camTY;
    const fire = e.pieces.find((p) => p.kind === "column" && p.layer === e.scenario.impactLo - 1)!;
    fire.burning = 1;
    fire.temp = 700;
    fire.x = 1;
    fire.y = 20;
    for (let i = 0; i < 30; i++) e.step(1 / 60);
    assert.ok(Math.abs(e.camTX - x0) < 0.05, `action cam chased in x (${e.camTX} vs ${x0})`);
    assert.ok(Math.abs(e.camTY - y0) < 0.05, `action cam chased in y (${e.camTY} vs ${y0})`);
  });
});

describe("apartment actually collapses", () => {
  it("a hot corner bay drops columns, then the story", () => {
    const e = new SimEngine(scenarioById("apartment"));
    e.play();
    const fireLayer = e.scenario.impactLo - 1;
    for (const p of e.pieces) {
      if (p.kind === "column" && p.layer === fireLayer && p.col === 0) {
        p.temp = 720;
        p.burning = 1;
        p.stripped = 1;
      }
    }
    for (let i = 0; i < 12; i++) e.step(1 / 60);
    const deadCols = e.pieces.filter((p) => p.kind === "column" && p.dynamic);
    assert.ok(deadCols.length >= 2, `columns must drop, got ${deadCols.length}`);
    const loose = e.pieces.filter((p) => p.dynamic);
    assert.ok(loose.length >= 20, `failed bay and the stack above should come down, got ${loose.length} loose`);
    const standing = e.pieces.filter((p) => !p.dynamic && (p.kind === "column" || p.kind === "wall"));
    assert.ok(standing.length > loose.length, "the rest of the building is still a building");
    assert.ok(loose.every((p) => Math.abs(p.vx) < 8), "no demolition kick");
  });
});

describe("standingLean", () => {
  it("is 0 on a standing tower — we do not pre-lean the shaft so it will tip", () => {
    const e = new SimEngine(scenarioById("north"));
    assert.equal(e.standingLean(), 0);
    assert.equal(e.tilt(), 0);
  });
});

describe("snapshot", () => {
  it("reports CGrav inside the house footprint at t=0", () => {
    const e = new SimEngine(scenarioById("house1"));
    const snap = e.snapshot();
    assert.equal(snap.cgInside, true);
    assert.ok(Math.abs(snap.cgOffsetM) < snap.halfWidth);
    assert.equal(snap.shape, "house");
    assert.ok(snap.pieceCount > 10);
    assert.equal(snap.looseCount, 0);
  });
});

describe("pieces fall instead of shrinking", () => {
  it("drops bonfire sections into the pit once they char", () => {
    const e = new SimEngine(scenarioById("bonfire"));
    const y0 = Math.min(...e.pieces.map((p) => p.y));
    const size0 = e.pieces[0].w + e.pieces[0].h + e.pieces[0].depth;
    e.play();
    e.setSpeed(40);
    for (let i = 0; i < 240; i++) e.step(1 / 60);
    const loose = e.pieces.filter((p) => p.dynamic && p.kind === "log");
    assert.ok(loose.length >= 4, `charred sections must fall, got ${loose.length} loose`);
    const y1 = Math.min(...e.pieces.map((p) => p.y));
    assert.ok(y1 < y0 + 0.05, `something should be lower (was ${y0.toFixed(2)}, now ${y1.toFixed(2)})`);
    const size1 = e.pieces[0].w + e.pieces[0].h + e.pieces[0].depth;
    assert.equal(size1, size0, "the stick did not shrink; a section fell");
  });

  it("drops house timber after it chars — green wood stays, charcoal does not hover", () => {
    const e = new SimEngine(scenarioById("house1"));
    e.play();
    e.setSpeed(40);
    for (let i = 0; i < 300; i++) e.step(1 / 60);
    const loose = e.pieces.filter((p) => p.dynamic);
    assert.ok(loose.length >= 1, `furniture or timber should have dropped, got ${loose.length}`);
    assert.ok(loose.every((p) => Math.abs(p.vx) < 8), "no demolition kick");
    const greenLocked = e.pieces.filter((p) => !p.dynamic && p.intact > 0.8);
    assert.ok(greenLocked.length > 0, "green timber is still a house");
  });
});
