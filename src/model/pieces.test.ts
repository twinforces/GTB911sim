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
    assert.ok(tree!.burning >= 1, "tree is the match");
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
    const stud = pieces.find((p) => p.kind === "stud")!;
    tree.burning = 1;
    tree.temp = 700;
    tree.fuel = 1;
    couch.burning = 0.4;
    couch.temp = 300;
    couch.fuel = 1;
    const t0 = stud.temp;
    for (let i = 0; i < 20; i++) spreadPieces(pieces, s, 1);
    assert.ok(stud.temp > t0, `studs should warm once the couch is a source (was ${t0}, now ${stud.temp})`);
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
