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
    const vySlow = slow.pieces.reduce((a, p) => a + Math.abs(p.vy), 0);
    const vyFast = fast.pieces.reduce((a, p) => a + Math.abs(p.vy), 0);
    assert.ok(vySlow < 0.5, `locked house must not be falling at 8×, vy-sum=${vySlow}`);
    assert.ok(vyFast < 0.5, `locked house must not be falling at 80×, vy-sum=${vyFast}`);
    assert.ok(Math.abs(vySlow - vyFast) < 0.2, "Fire Speed must not scale gravity");
    assert.ok(fast.t > slow.t, "sim time (heating clock) advances faster at 80×");
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
