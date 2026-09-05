/**
 * Piece-world laws: ignition, neighbor heat, drop-only unlock, gravity, CGrav.
 *
 * These tests do not draw. If fire is “painted on,” they fail. If members
 * kick sideways, they fail. If g is not 9.81, they fail.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { G } from "./constants.ts";
import {
  buildPieces,
  evaluatePieces,
  heatPieces,
  ignitePieces,
  integratePieces,
  pieceCgrav,
  piecesSettled,
  spreadPieces,
  unlockPiece,
  LOG_SECTIONS,
  LOG_JOINS,
} from "./pieces.ts";
import { scenarioById } from "./scenarios.ts";

const house = () => scenarioById("house1");

describe("ignitePieces", () => {
  it("lights only the Christmas tree in a house — not the wall, not the couch", () => {
    const s = house();
    const { pieces } = buildPieces(s);
    ignitePieces(pieces, s);
    const tree = pieces.find((p) => p.kind === "tree");
    const couch = pieces.find((p) => p.kind === "couch");
    assert.ok(tree, "house has a tree");
    assert.ok(couch, "house has a couch");
    assert.ok(tree!.burning >= 0.3, "tree is the match");
    assert.equal(couch!.burning, 0, "couch is not pre-lit");
    const lit = pieces.filter((p) => p.burning > 0);
    assert.equal(lit.length, 1, `only the tree should be burning, got ${lit.map((p) => p.kind).join(",")}`);
  });

  it("lights one lowest log in the bonfire, not the whole crib", () => {
    const s = scenarioById("bonfire");
    const { pieces } = buildPieces(s);
    ignitePieces(pieces, s);
    const lit = pieces.filter((p) => p.burning > 0);
    assert.equal(lit.length, 1);
    assert.equal(lit[0].kind, "log");
  });
});

describe("spreadPieces neighbor heat", () => {
  it("lets the tree heat the couch, and refuses to heat studs until the couch is lit", () => {
    const s = house();
    const { pieces } = buildPieces(s);
    ignitePieces(pieces, s);
    const tree = pieces.find((p) => p.kind === "tree")!;
    const couch = pieces.find((p) => p.kind === "couch")!;
    const stud = pieces.find((p) => p.kind === "stud")!;
    tree.temp = 700;
    tree.burning = 1;
    const studT0 = stud.temp;
    const couchT0 = couch.temp;
    for (let i = 0; i < 30; i++) spreadPieces(pieces, s, 1);
    assert.ok(couch.temp > couchT0, `couch should warm from the tree (was ${couchT0}, now ${couch.temp})`);
    assert.equal(stud.burning, 0, "studs cannot catch from the tree before the couch is lit");
    assert.equal(stud.temp, studT0, "tree must not leak onto studs before couchLit");
  });

  it("after the couch is lit, heat can walk onto the room", () => {
    const s = house();
    const { pieces } = buildPieces(s);
    const tree = pieces.find((p) => p.kind === "tree")!;
    const couch = pieces.find((p) => p.kind === "couch")!;
    const near =
      pieces.find((p) => p.kind === "stud" && Math.abs(p.x - couch.x) < 1.3 && Math.abs(p.z - couch.z) < 1.6) ??
      pieces.find((p) => p.kind === "wall" && Math.abs(p.x - couch.x) < 1.4)!;
    tree.burning = 1;
    tree.temp = 700;
    tree.fuel = 1;
    couch.burning = 0.4;
    couch.temp = 300;
    couch.fuel = 1;
    const t0 = near.temp;
    for (let i = 0; i < 20; i++) spreadPieces(pieces, s, 1);
    assert.ok(near.temp > t0, `neighbors of the couch should warm (was ${t0}, now ${near.temp})`);
  });

  it("tree burns a while before the couch lights, then foam runs hotter", () => {
    const s = house();
    const { pieces } = buildPieces(s);
    ignitePieces(pieces, s);
    const tree = pieces.find((p) => p.kind === "tree")!;
    const couch = pieces.find((p) => p.kind === "couch")!;
    for (let i = 0; i < 45; i++) {
      heatPieces(pieces, s, 1);
      spreadPieces(pieces, s, 1);
    }
    assert.ok(tree.burning > 0.3, "tree is still the fire");
    assert.ok(couch.burning < 0.25, `couch should still be waiting at 45 s, burning=${couch.burning.toFixed(2)} T=${couch.temp.toFixed(0)}`);
    for (let i = 0; i < 280; i++) {
      heatPieces(pieces, s, 1);
      spreadPieces(pieces, s, 1);
    }
    assert.ok(couch.burning > 0.25, `couch should catch after a few minutes, burning=${couch.burning.toFixed(2)} T=${couch.temp.toFixed(0)}`);
    const couchT = couch.temp;
    const treeT = tree.temp;
    for (let i = 0; i < 40; i++) heatPieces(pieces, s, 1);
    assert.ok(couch.temp > tree.temp, `foam should outrun the needles (couch ${couch.temp.toFixed(0)} vs tree ${tree.temp.toFixed(0)}; was couch ${couchT.toFixed(0)} tree ${treeT.toFixed(0)})`);
  });

  it("bonfire: a burning log warms its join, not a log 2 m away", () => {
    const s = scenarioById("bonfire");
    const { pieces } = buildPieces(s);
    const src = pieces.find((p) => p.kind === "log")!;
    src.burning = 1;
    src.temp = 800;
    src.fuel = 1;
    const join = pieces.find((p) => p.kind === "join" && p.stickId === src.stickId);
    assert.ok(join, "stick has a join");
    const joinT0 = join!.temp;
    let far = src;
    let farD = 0;
    for (const p of pieces) {
      if (p.kind !== "log" || p.id === src.id) continue;
      const d = Math.hypot(p.x - src.x, p.y - src.y, p.z - src.z);
      if (d > farD) {
        farD = d;
        far = p;
      }
    }
    const farT0 = far.temp;
    for (let i = 0; i < 12; i++) spreadPieces(pieces, s, 0.5);
    assert.ok(farD > 1.2, `crib has a far log (${farD.toFixed(2)} m)`);
    assert.ok(join!.temp > joinT0 + 20, `join on the same stick should warm (was ${joinT0}, now ${join!.temp})`);
    assert.ok(far.temp < farT0 + 8, `2 m is too far — far log temp ${far.temp} (was ${farT0})`);
    assert.equal(far.burning, 0, "far log must not catch from a 2 m bubble");
  });

  it("house fire does not jump 2 m of open air", () => {
    const s = house();
    const { pieces } = buildPieces(s);
    const face = pieces.filter((p) => p.kind === "wall" && p.z > 1 && p.y < 1.6);
    const src = face.reduce((a, b) => (a.x < b.x ? a : b));
    src.burning = 1;
    src.temp = 800;
    src.fuel = 1;
    const far = face.reduce((a, b) => (a.x > b.x ? a : b));
    assert.ok(far.x - src.x > 4, `same face has a far bay (${(far.x - src.x).toFixed(1)} m)`);
    const farT0 = far.temp;
    for (let i = 0; i < 16; i++) spreadPieces(pieces, s, 0.5);
    assert.ok(far.temp < farT0 + 8, `open air is not a 2 m fuse — far wall ${far.temp.toFixed(0)} (was ${farT0})`);
    assert.equal(far.burning, 0, "far bay must not catch from across the room");
  });

  it("2-story house: fire walks up to the second story", () => {
    const s = scenarioById("house2");
    const { pieces } = buildPieces(s);
    ignitePieces(pieces, s);
    for (let i = 0; i < 220; i++) {
      heatPieces(pieces, s, 1);
      spreadPieces(pieces, s, 1);
    }
    const upper = pieces.filter(
      (p) => p.restY > 2.6 && (p.kind === "wall" || p.kind === "stud" || p.kind === "joist"),
    );
    const lit = upper.filter((p) => p.burning > 0.12 || p.temp > 200);
    assert.ok(upper.length > 8, "2-story house has a second story");
    assert.ok(
      lit.length >= 3,
      `second story should be involved (got ${lit.length}/${upper.length} hot, maxT=${Math.max(...upper.map((p) => p.temp)).toFixed(0)})`,
    );
  });

  it("apartment corner fire heats steel in the room and walks next door", () => {
    const s = scenarioById("apartment");
    const { pieces } = buildPieces(s);
    ignitePieces(pieces, s);
    const fireLayer = s.impactLo - 1;
    const walls = pieces.filter((p) => p.kind === "wall" && p.layer === fireLayer && p.col === 0 && p.burning > 0.2);
    assert.ok(walls.length >= 4, "corner unit walls are the match");
    const col = pieces.find((p) => p.kind === "column" && p.layer === fireLayer && p.col === 0)!;
    assert.ok(col.burning < 0.05, "steel is not the fuel");
    for (let i = 0; i < 180; i++) {
      heatPieces(pieces, s, 1);
      spreadPieces(pieces, s, 1);
    }
    assert.ok(col.temp > 80, `compartment should warm the column (T=${col.temp.toFixed(0)})`);
    const next = pieces.filter((p) => p.kind === "wall" && p.layer === fireLayer && p.col === 1);
    assert.ok(
      next.some((p) => p.burning > 0.1 || p.temp > 70),
      "fire should walk to the next room",
    );
    const above = pieces.filter((p) => p.layer === fireLayer + 1 && p.kind === "wall" && p.burning > 0.2);
    assert.ok(above.length < 3, `story above should still be dark at 3 min (lit ${above.length})`);
  });

  it("apartment does not climb two stories in the first minute", () => {
    const s = scenarioById("apartment");
    const { pieces } = buildPieces(s);
    ignitePieces(pieces, s);
    for (let i = 0; i < 60; i++) {
      heatPieces(pieces, s, 1);
      spreadPieces(pieces, s, 1);
      evaluatePieces(pieces, s);
    }
    const story4 = pieces.filter((p) => p.layer === 3);
    const lit = story4.filter((p) => p.burning > 0.2);
    assert.ok(story4.length > 0, "apartment has a fourth story");
    assert.ok(
      lit.length < Math.max(2, story4.length * 0.25),
      `story 4 should still be mostly dark at 1 min (lit ${lit.length}/${story4.length})`,
    );
    const loose = pieces.filter((p) => p.dynamic);
    assert.equal(
      loose.length,
      0,
      `steel does not fail in the first minute, got ${loose.map((p) => `${p.kind}#${p.id}@${p.temp.toFixed(0)}`).join(",")}`,
    );
  });

  it("bonfire: fire rises — a log above warms more than one beside at the same range", () => {
    const s = scenarioById("bonfire");
    const { pieces } = buildPieces(s);
    const src = pieces.find((p) => p.kind === "log" && p.layer === 0)!;
    src.burning = 1;
    src.temp = 800;
    src.fuel = 1;
    const above = pieces
      .filter((p) => p.kind === "log" && p.y > src.y + 0.05 && p.stickId !== src.stickId)
      .sort((a, b) => Math.hypot(a.x - src.x, a.y - src.y, a.z - src.z) - Math.hypot(b.x - src.x, b.y - src.y, b.z - src.z))[0];
    const beside = pieces
      .filter((p) => p.kind === "log" && Math.abs(p.y - src.y) < 0.05 && p.id !== src.id && p.stickId !== src.stickId)
      .sort((a, b) => Math.hypot(a.x - src.x, a.z - src.z) - Math.hypot(b.x - src.x, b.z - src.z))[0];
    assert.ok(above, "crib has a log above the match");
    assert.ok(beside, "crib has a log beside the match");
    for (let i = 0; i < 10; i++) spreadPieces(pieces, s, 0.5);
    assert.ok(above.temp > beside.temp, `fire rises: above ${above.temp.toFixed(1)} °C vs beside ${beside.temp.toFixed(1)} °C`);
  });
});

describe("unlockPiece drop-only", () => {
  it("zeroes horizontal kick when drop is true — no demolition shove", () => {
    const s = house();
    const { pieces } = buildPieces(s);
    const joist = pieces.find((p) => p.kind === "joist")!;
    joist.vx = 4;
    joist.vz = 3;
    unlockPiece(joist, true);
    assert.equal(joist.dynamic, true);
    assert.equal(joist.vx, 0);
    assert.equal(joist.vz, 0);
    assert.ok(joist.vy < 0, "drop is downward");
  });
});

describe("evaluatePieces house", () => {
  it("will not unlock a green stud", () => {
    const s = house();
    const { pieces } = buildPieces(s);
    const stud = pieces.find((p) => p.kind === "stud")!;
    assert.equal(stud.intact, 1);
    evaluatePieces(pieces, s);
    assert.equal(stud.dynamic, false, "fresh timber stays locked");
  });

  it("unlocks a charred stud with drop-only (vx = 0)", () => {
    const s = house();
    const { pieces } = buildPieces(s);
    const stud = pieces.find((p) => p.kind === "stud")!;
    stud.intact = 0.2;
    stud.temp = 420;
    stud.fuel = 0.2;
    evaluatePieces(pieces, s);
    assert.equal(stud.dynamic, true, "charcoal stud must drop");
    assert.equal(stud.vx, 0, "house unlock is drop-only");
    assert.equal(stud.vz, 0);
  });
});

describe("integratePieces gravity", () => {
  it("applies g = 9.81 to dynamic members", () => {
    const s = house();
    const { pieces, pit } = buildPieces(s);
    const stud = pieces.find((p) => p.kind === "stud")!;
    // Park it above the roof so SAT against the house cannot hide g.
    stud.x = s.width / 2;
    stud.y = 12;
    stud.z = 0;
    unlockPiece(stud, true);
    const y0 = stud.y;
    const dt = 1 / 60;
    integratePieces(pieces, pit, dt, s.width);
    const expectedVy = -0.15 - G * dt;
    assert.ok(Math.abs(stud.vy - expectedVy) < 1e-9, `vy ${stud.vy} vs ${expectedVy} (g=${G})`);
    assert.ok(stud.y < y0, "member moved down");
    assert.equal(stud.vx, 0, "in free fall, drop-only stays vertical");
  });
});

describe("pieceCgrav", () => {
  it("is the mass-weighted mean, not a drawn line", () => {
    const s = house();
    const { pieces } = buildPieces(s);
    const cg = pieceCgrav(pieces);
    let m = 0;
    let x = 0;
    for (const p of pieces) {
      m += p.mass;
      x += p.mass * p.x;
    }
    assert.ok(m > 0);
    assert.equal(cg.mass, m);
    assert.ok(Math.abs(cg.x - x / m) < 1e-9);
    assert.ok(cg.x > 0 && cg.x < s.width, "empty-house CGrav is over the footprint");
  });
});

describe("piecesSettled", () => {
  it("refuses to settle a house while the roof is still a roof", () => {
    const s = house();
    const { pieces } = buildPieces(s);
    for (const p of pieces) {
      if (p.kind !== "roof") {
        p.dynamic = true;
        p.vx = 0;
        p.vy = 0;
      }
    }
    assert.equal(piecesSettled(pieces), false);
  });

  it("allows settle once a majority of roof pieces are down and the pile is still", () => {
    const s = house();
    const { pieces } = buildPieces(s);
    for (const p of pieces) {
      p.dynamic = true;
      p.vx = 0;
      p.vy = 0;
    }
    assert.equal(piecesSettled(pieces), true);
  });
});

describe("heatPieces", () => {
  it("raises temperature of a burning member and eats fuel", () => {
    const s = house();
    const { pieces } = buildPieces(s);
    const tree = pieces.find((p) => p.kind === "tree")!;
    tree.burning = 1;
    tree.temp = 200;
    tree.fuel = 1;
    heatPieces(pieces, s, 10);
    assert.ok(tree.temp > 200, "burning wood heats");
    assert.ok(tree.fuel < 1, "burning wood is consumed");
    assert.ok(tree.intact < 1, "section chars");
  });
});

describe("bonfire sections", () => {
  it("builds each log as four length sections plus three joins", () => {
    const { pieces } = buildPieces(scenarioById("bonfire"));
    const logs = pieces.filter((p) => p.kind === "log");
    const joins = pieces.filter((p) => p.kind === "join");
    assert.equal(logs.length, 10 * 4 * LOG_SECTIONS, "10 layers × 4 sticks × 4 sections");
    assert.equal(joins.length, 10 * 4 * LOG_JOINS, "3 joins per stick");
    const longest = Math.max(...logs.map((p) => Math.max(p.w, p.depth)));
    assert.ok(longest < 0.7, `a section is ~0.4 m, not 1.92 m (got ${longest})`);
  });

  it("does not shrink a burning log — charcoal falls, it does not melt", () => {
    const s = scenarioById("bonfire");
    const { pieces } = buildPieces(s);
    const log = pieces.find((p) => p.kind === "log")!;
    const w0 = log.w;
    const h0 = log.h;
    const d0 = log.depth;
    log.burning = 1;
    log.fuel = 1;
    heatPieces(pieces, s, 40);
    assert.equal(log.w, w0);
    assert.equal(log.h, h0);
    assert.equal(log.depth, d0);
    assert.ok(log.intact < 0.95, "section chars");
  });

  it("keeps a green stick together — sections do not fall independently", () => {
    const s = scenarioById("bonfire");
    const { pieces } = buildPieces(s);
    evaluatePieces(pieces, s);
    assert.equal(pieces.filter((p) => p.dynamic).length, 0);
    const stick = pieces.find((p) => p.kind === "log" && p.layer === 0)!;
    const mates = pieces.filter((p) => p.stickId === stick.stickId && p.kind === "log");
    assert.equal(mates.length, LOG_SECTIONS);
    for (const m of mates) m.intact = 0.9;
    evaluatePieces(pieces, s);
    assert.equal(
      pieces.filter((p) => p.stickId === stick.stickId && p.dynamic).length,
      0,
      "90% wood still holds as one log",
    );
  });

  it("splits a stick when either side of a join is more than half charcoal", () => {
    const s = scenarioById("bonfire");
    const { pieces } = buildPieces(s);
    const stickId = pieces.find((p) => p.kind === "log" && p.layer === 0)!.stickId;
    const left = pieces.find((p) => p.stickId === stickId && p.kind === "log" && p.seg === 0)!;
    left.intact = 0.4;
    left.temp = 400;
    evaluatePieces(pieces, s);
    assert.equal(left.dynamic, true, "charred section drops");
    const join = pieces.find((p) => p.stickId === stickId && p.kind === "join" && p.seg === 0)!;
    assert.equal(join.dynamic, true, "join fails when a neighbour is half charcoal");
    const right = pieces.find((p) => p.stickId === stickId && p.kind === "log" && p.seg === 3)!;
    assert.equal(right.dynamic, false, "the far end is still one log");
    assert.equal(left.vx, 0);
    assert.equal(left.vz, 0);
  });

  it("unlocks a fully charred bottom stick so gravity can take it", () => {
    const s = scenarioById("bonfire");
    const { pieces } = buildPieces(s);
    const log = pieces.find((p) => p.kind === "log" && p.layer === 0)!;
    for (const p of pieces.filter((q) => q.stickId === log.stickId)) {
      p.intact = 0.3;
      p.temp = 500;
    }
    evaluatePieces(pieces, s);
    const group = pieces.filter((p) => p.stickId === log.stickId);
    assert.ok(group.every((p) => p.dynamic), "charcoal stick drops as a group");
    assert.ok(group.every((p) => p.vx === 0 && p.vz === 0));
  });

  it("leaves a green log locked — Newton's first law is not 'everything falls at t=0'", () => {
    const s = scenarioById("bonfire");
    const { pieces } = buildPieces(s);
    evaluatePieces(pieces, s);
    const loose = pieces.filter((p) => p.dynamic);
    assert.equal(loose.length, 0);
  });
});

describe("Newton's first law", () => {
  it("never invents a sideways kick, even if drop is false", () => {
    const s = house();
    const { pieces } = buildPieces(s);
    const stud = pieces.find((p) => p.kind === "stud")!;
    stud.vx = 9;
    unlockPiece(stud, false);
    assert.equal(stud.vx, 0);
    assert.equal(stud.vz, 0);
    assert.ok(stud.vy < 0);
  });
});

describe("rotation is in the engine", () => {
  it("unlocks with a bounded flop — spin is not a sideways kick and not a centrifuge", () => {
    const s = house();
    const { pieces } = buildPieces(s);
    const stud = pieces.find((p) => p.kind === "stud")!;
    unlockPiece(stud, true);
    assert.ok(Math.abs(stud.omega) >= 0.12, `omega ${stud.omega} should be a flop`);
    assert.ok(Math.abs(stud.omega) < 1.6, `omega ${stud.omega} must not cartwheel`);
    assert.equal(stud.vx, 0);
    assert.equal(stud.vz, 0);
  });

  it("a falling log actually rotates in free fall", () => {
    const s = scenarioById("bonfire");
    const { pieces, pit } = buildPieces(s);
    const log = pieces.find((p) => p.kind === "log")!;
    log.x = s.width / 2;
    log.y = 8;
    log.z = 0;
    log.stickId = 0;
    unlockPiece(log, true);
    const theta0 = log.theta;
    for (let i = 0; i < 45; i++) integratePieces(pieces, pit, 1 / 60, s.width);
    assert.ok(Math.abs(log.theta - theta0) > 0.12, `theta moved ${log.theta - theta0}, expected a visible tumble`);
    assert.ok(Math.abs(log.vx) < 0.15, `Newton 1 still holds in free fall (vx=${log.vx})`);
  });
});

describe("SAT is z-aware", () => {
  it("does not detonate opposite wall panels that share x,y but not z", () => {
    const s = house();
    const { pieces, pit } = buildPieces(s);
    const walls = pieces.filter((p) => p.kind === "wall" && Math.abs(p.x - s.width / 2) < 0.6);
    assert.ok(walls.length >= 2, "front and back mid panels");
    const x0 = walls.map((w) => w.x);
    const z0 = walls.map((w) => w.z);
    for (const w of walls) unlockPiece(w, true);
    for (let i = 0; i < 24; i++) integratePieces(pieces, pit, 1 / 60, s.width);
    for (let i = 0; i < walls.length; i++) {
      assert.ok(Math.abs(walls[i].x - x0[i]) < 1.1, `wall ${i} jumped in x (${walls[i].x} vs ${x0[i]})`);
      assert.ok(Math.abs(walls[i].z - z0[i]) < 0.6, `wall ${i} jumped in z`);
      assert.ok(Math.abs(walls[i].vx) < 5, `wall ${i} launched (vx=${walls[i].vx})`);
    }
  });
});

describe("apartment story mechanism", () => {
  it("drops the brick shell once two fire-floor columns lose yield", () => {
    const s = scenarioById("apartment");
    const { pieces } = buildPieces(s);
    const fireLayer = s.impactLo - 1;
    const cols = pieces.filter((p) => p.kind === "column" && p.layer === fireLayer && p.col === 0);
    assert.ok(cols.length >= 2, "corner bay has columns");
    for (const c of cols) {
      c.temp = 700;
      c.burning = 1;
    }
    evaluatePieces(pieces, s);
    const dead = pieces.filter((p) => p.kind === "column" && p.layer === fireLayer && p.dynamic);
    assert.ok(dead.length >= 2, `hot columns must unlock, got ${dead.length}`);
    evaluatePieces(pieces, s);
    const walls = pieces.filter((p) => p.kind === "wall" && p.layer === fireLayer && p.dynamic);
    assert.ok(walls.length >= 1, "brick shell drops once the bay fails");
    assert.ok(dead.every((p) => p.vx === 0 && p.vz === 0), "Newton 1 on the unlocked columns");
    for (let i = 0; i < 6; i++) evaluatePieces(pieces, s);
    const above = pieces.filter((p) => p.kind === "column" && p.layer > fireLayer && p.col === 0 && p.dynamic);
    assert.ok(above.length >= 1, `stack above a dead bay must drop, got ${above.length}`);
  });

  it("does not drop a cold apartment", () => {
    const s = scenarioById("apartment");
    const { pieces } = buildPieces(s);
    evaluatePieces(pieces, s);
    assert.equal(pieces.filter((p) => p.dynamic).length, 0);
  });

  it("does not build a facade the width of the building", () => {
    const s = scenarioById("apartment");
    const { pieces } = buildPieces(s);
    const long = pieces.filter((p) => p.kind === "wall" && p.w > p.depth * 2);
    assert.ok(long.length > 8, "bay panels, not two giant faces");
    for (const w of long) {
      assert.ok(w.w < s.width * 0.22, `facade piece ${w.w} m wide on a ${s.width} m building`);
    }
    const fireFace = long.filter((p) => p.layer === 0 && p.z > 0);
    assert.ok(fireFace.length >= 12, "bays × courses, not one story-high ribbon");
  });
});

describe("stick weld and SAT", () => {
  it("keeps a falling green stick collinear — sections do not become noodles", () => {
    const s = scenarioById("bonfire");
    const { pieces, pit } = buildPieces(s);
    const stickId = pieces.find((p) => p.kind === "log" && p.layer === 3)!.stickId;
    const group = pieces.filter((p) => p.stickId === stickId);
    for (const p of group) unlockPiece(p, true);
    for (let i = 0; i < 40; i++) integratePieces(pieces, pit, 1 / 60, s.width);
    const logs = group.filter((p) => p.kind === "log");
    const xs = logs.map((p) => p.x);
    const zs = logs.map((p) => p.z);
    const alongZ = logs[0].alongZ;
    if (alongZ) {
      const spreadX = Math.max(...xs) - Math.min(...xs);
      assert.ok(spreadX < 0.12, `along-Z stick stayed a line in x (spread ${spreadX})`);
    } else {
      const spreadZ = Math.max(...zs) - Math.min(...zs);
      assert.ok(spreadZ < 0.12, `along-X stick stayed a line in z (spread ${spreadZ})`);
    }
  });

  it("stacked logs separate in Y, not a Z grid", () => {
    const s = scenarioById("bonfire");
    const { pieces, pit } = buildPieces(s);
    const a = pieces.find((p) => p.kind === "log" && p.layer === 0 && p.alongZ)!;
    const b = pieces.find((p) => p.kind === "log" && p.layer === 1 && !p.alongZ && Math.abs(p.x - a.x) < 0.5)!;
    assert.ok(b, "crossing log on the next layer");
    const z0a = a.z;
    const z0b = b.z;
    unlockPiece(a, true);
    unlockPiece(b, true);
    a.y = 0.4;
    b.y = 0.45;
    a.vy = 0;
    b.vy = 0;
    for (let i = 0; i < 20; i++) integratePieces(pieces, pit, 1 / 60, s.width);
    assert.ok(Math.abs(a.z - z0a) < 0.25, `lower log z drifted ${a.z - z0a}`);
    assert.ok(Math.abs(b.z - z0b) < 0.25, `upper log z drifted ${b.z - z0b}`);
  });

  it("a log that hits the pit stays down — collisions are inelastic", () => {
    const s = scenarioById("bonfire");
    const { pieces, pit } = buildPieces(s);
    const log = pieces.find((p) => p.kind === "log")!;
    log.stickId = 0;
    unlockPiece(log, true);
    log.x = s.width / 2;
    log.y = 1.2;
    log.z = 0;
    log.vy = -6;
    log.vx = 0;
    log.vz = 0;
    log.omega = 0;
    for (let i = 0; i < 180; i++) integratePieces(pieces, pit, 1 / 60, s.width);
    assert.ok(log.vy <= 0.02, `log bounced (vy=${log.vy})`);
    const y1 = log.y;
    for (let i = 0; i < 60; i++) integratePieces(pieces, pit, 1 / 60, s.width);
    assert.ok(Math.abs(log.y - y1) < 0.06, `log still hopping (${log.y - y1} m)`);
  });

  it("a dropped roof settles instead of bouncing for minutes", () => {
    const s = house();
    const { pieces, pit } = buildPieces(s);
    const roof = pieces.find((p) => p.kind === "roof")!;
    unlockPiece(roof, true);
    roof.y = 3.2;
    roof.vy = -5;
    roof.vx = 0;
    roof.vz = 0;
    roof.omega = 0;
    for (let i = 0; i < 180; i++) integratePieces(pieces, pit, 1 / 60, s.width);
    assert.ok(roof.vy <= 0.02, `roof bounced (vy=${roof.vy})`);
    const y1 = roof.y;
    for (let i = 0; i < 90; i++) integratePieces(pieces, pit, 1 / 60, s.width);
    assert.ok(Math.abs(roof.y - y1) < 0.08, `roof still hopping at t+1.5s (${roof.y - y1} m)`);
  });
});
