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

  it("setSpeed clamps to 1..240 on wood, 1..2400 on WTC 7", () => {
    const e = new SimEngine(scenarioById("house1"));
    e.setSpeed(0);
    assert.equal(e.speed, 1);
    e.setSpeed(999);
    assert.equal(e.speed, 240);
    e.setSpeed(24);
    assert.equal(e.speed, 24);
    const seven = new SimEngine(scenarioById("wtc7"));
    seven.setSpeed(800);
    assert.equal(seven.speed, 800);
    seven.setSpeed(4000);
    assert.equal(seven.speed, 2400);
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

describe("impact only", () => {
  it("does not collapse if you leave it idle past the NIST clock", () => {
    const e = new SimEngine(scenarioById("nofire"));
    e.play();
    (e as unknown as { seedWound: (sever: boolean) => void }).seedWound(true);
    e.setSpeed(240);
    for (let i = 0; i < 2200; i++) e.step(1 / 60);
    assert.notEqual(e.phase, "collapse", `NIST clock must not keyframe a drop (t=${(e.t / 60).toFixed(0)} min, phase=${e.phase})`);
    assert.equal(e.block, null, "no falling block");
    assert.ok(
      e.events.some((ev) => /standing|Didn't collapse|not enough/i.test(ev.text)),
      `should have said it stood, got: ${e.events.map((ev) => ev.text).join(" | ")}`,
    );
    assert.ok(
      !e.events.some((ev) => /Settled as rubble|Progressive collapse/i.test(ev.text)),
      "must not call a standing tower rubble",
    );
  });
});

describe("tower fire is not a NIST keyframe", () => {
  const wound = (e: SimEngine) =>
    (e as unknown as { seedWound: (sever: boolean) => void }).seedWound(true);

  it("does not drop a cold North Tower at 108 minutes", () => {
    const e = new SimEngine(scenarioById("north"));
    e.play();
    wound(e);
    for (const f of e.floors) {
      for (const c of f.cols) {
        c.temp = 22;
        c.burning = 0;
        c.sag = 0;
        c.bow = 0;
      }
    }
    e.t = 108 * 60;
    e.setSpeed(1);
    e.paused = false;
    for (let i = 0; i < 8; i++) e.step(1 / 60);
    assert.equal(e.phase, "fire", `cold steel at 108 min must still stand (phase=${e.phase})`);
    assert.equal(e.block, null);
  });

  it("walks fire to the story above because that story is hot, not because the clock paid", () => {
    const e = new SimEngine(scenarioById("north"));
    e.play();
    wound(e);
    const above = e.scenario.impactLo; // 0-index: impactLo is story 93, floors[92], above is floors[93]
    const fireFloor = e.floors[e.scenario.impactLo - 1];
    const nextFloor = e.floors[e.scenario.impactLo];
    assert.ok(fireFloor.cols.some((c) => c.burning > 0.2), "impact story is the match");
    assert.ok(
      nextFloor.cols.every((c) => c.burning < 0.2),
      "story 94 is not pre-lit",
    );
    e.setSpeed(240);
    for (let i = 0; i < 400; i++) e.step(1 / 60);
    if (e.phase === "collapse") return;
    const hot = nextFloor.cols.filter((c) => c.temp > 80 || c.burning > 0.1);
    assert.ok(hot.length >= 1, `plume should warm story ${above + 1} (got ${hot.length} hot, t=${(e.t / 60).toFixed(0)} min)`);
  });

  it("drops when remaining yield cannot carry the load — not at a NIST timestamp", () => {
    const e = new SimEngine(scenarioById("north"));
    e.play();
    wound(e);
    const f = e.floors[e.scenario.impactLo - 1];
    for (const c of f.cols) {
      c.temp = 720;
      c.burning = 1;
      c.stripped = 1;
      c.sag = 0.8;
      c.bow = 0.7;
    }
    e.setSpeed(1);
    e.paused = false;
    for (let i = 0; i < 12; i++) e.step(1 / 60);
    assert.equal(e.phase, "collapse", "hot damaged belt must be a story mechanism");
    assert.ok(e.initiationT !== null);
    assert.ok(e.initiationT! < 5, `must not wait for 72% of 102 min (initiated at ${e.initiationT}s)`);
  });
});

describe("WTC 7", () => {
  const wound = (e: SimEngine) =>
    (e as unknown as { seedWound: (sever: boolean) => void }).seedWound(false);

  it("ignites with no plane and uncut columns", () => {
    const e = new SimEngine(scenarioById("wtc7"));
    e.play();
    assert.equal(e.phase, "fire");
    assert.equal(e.plane.alive, false);
    assert.equal(e.scenario.frame, "strut");
    const fireFloor = e.floors[6];
    assert.ok(fireFloor.cols.some((c) => c.burning > 0.2), "stories 7–9 start on fire");
    assert.ok(
      e.floors.every((f) => f.cols.every((c) => c.intact > 0.99)),
      "no airplane gash — intact stays 1",
    );
    const high = e.floors[20];
    assert.ok(high.cols.every((c) => c.burning < 0.05), "story 21 is not pre-lit");
    assert.ok(e.floors[12].eastSeated, "girder starts on the seat");
  });

  it("walks the girder off the seat at ~400 °C — expansion, not yield", () => {
    const e = new SimEngine(scenarioById("wtc7"));
    e.play();
    wound(e);
    const f = e.floors[12];
    f.cols[0].temp = 420;
    f.cols[0].burning = 0.8;
    e.setSpeed(1);
    for (let i = 0; i < 4; i++) e.step(1 / 60);
    assert.equal(f.eastSeated, false, "seat lost");
    assert.equal(f.eastDropped, true);
    assert.equal(e.phase, "fire", "the shell is still a building");
    assert.equal(e.floors[12].cols[4].failed, false, "perimeter has not failed");
    assert.ok(e.events.some((ev) => /walk-off/i.test(ev.text)));
  });

  it("does not walk off cold", () => {
    const e = new SimEngine(scenarioById("wtc7"));
    e.play();
    const f = e.floors[12];
    f.cols[0].temp = 180;
    e.setSpeed(1);
    for (let i = 0; i < 4; i++) e.step(1 / 60);
    assert.equal(f.eastSeated, true);
    assert.equal(f.eastDropped, false);
  });

  it("buckles column 79 from missing braces, then 80, then 81 — not the same frame", () => {
    const e = new SimEngine(scenarioById("wtc7"));
    e.play();
    wound(e);
    for (let i = 5; i <= 12; i++) {
      e.floors[i].eastDropped = true;
      e.floors[i].eastSeated = false;
    }
    e.setSpeed(1);
    e.step(1 / 60);
    assert.equal(e.floors[12].cols[0].failed, true, "79 goes first");
    assert.equal(e.floors[12].cols[1].failed, false, "80 is still up this step");
    assert.equal(e.phase, "fire");
    e.step(1 / 60);
    assert.equal(e.floors[12].cols[1].failed, true, "80 follows");
    assert.equal(e.floors[12].cols[2].failed, false);
    e.step(1 / 60);
    assert.equal(e.floors[12].cols[2].failed, true, "81 last of the east line");
    assert.equal(e.penthouseDropped, true);
    assert.equal(e.phase, "fire", "shell still standing");
    assert.equal(e.floors[12].cols[4].failed, false);
  });

  it("shell comes down only after the interior is gone", () => {
    const e = new SimEngine(scenarioById("wtc7"));
    e.play();
    wound(e);
    for (let i = 5; i <= 12; i++) {
      e.floors[i].eastDropped = true;
      e.floors[i].eastSeated = false;
    }
    e.setSpeed(1);
    for (let i = 0; i < 8; i++) e.step(1 / 60);
    assert.equal(e.phase, "collapse");
    assert.ok(e.block && !e.block.hinged);
    assert.ok(e.events.some((ev) => /penthouse|81/i.test(ev.text)));
  });

  it("does not walk off in the first hour — this is a 7-hour office fire", () => {
    const e = new SimEngine(scenarioById("wtc7"));
    e.play();
    e.setSpeed(2400);
    for (let i = 0; i < 90; i++) e.step(1 / 60);
    assert.ok(e.t / 60 > 50, "sim minutes actually advanced");
    assert.equal(e.phase, "fire");
    assert.ok(
      e.floors.every((f) => f.eastSeated),
      `no walk-off at ${(e.t / 60).toFixed(0)} min`,
    );
  });

  it("comes down after hours of fire, not the first hour", () => {
    const e = new SimEngine(scenarioById("wtc7"));
    e.play();
    e.setSpeed(2400);
    for (let i = 0; i < 1600 && e.phase !== "settled"; i++) e.step(1 / 60);
    assert.equal(e.phase, "settled");
    assert.ok(e.initiationT !== null);
    const min = e.initiationT! / 60;
    assert.ok(min > 180, `too fast: ${min.toFixed(0)} min`);
    assert.ok(min < 700, `too slow: ${min.toFixed(0)} min`);
    assert.ok(e.penthouseDropped, "east penthouse dropped before the shell");
  });
});
