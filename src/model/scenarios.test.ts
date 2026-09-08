/**
 * Runs are data. Rigid tree vs North Tower is a flag, not a second renderer.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CLAIM, PATH, SCENARIOS, scenarioById } from "./scenarios.ts";

describe("teaching path", () => {
  it("walks bonfire → 1-story → 2-story → apartment", () => {
    assert.deepEqual(
      PATH.map((s) => s.id),
      ["bonfire", "house1", "house2", "apartment"],
    );
  });

  it("chains nextId along that path", () => {
    assert.equal(scenarioById("bonfire").nextId, "house1");
    assert.equal(scenarioById("house1").nextId, "house2");
    assert.equal(scenarioById("house2").nextId, "apartment");
    assert.equal(scenarioById("apartment").nextId, "north");
  });
});

describe("claim runs", () => {
  it("keeps crush on for the real towers and off for the cartoon", () => {
    assert.equal(scenarioById("north").crush, true);
    assert.equal(scenarioById("south").crush, true);
    assert.equal(scenarioById("tree").crush, false);
  });

  it("north impact belt is 93–99, south is 77–85", () => {
    assert.equal(scenarioById("north").impactLo, 93);
    assert.equal(scenarioById("north").impactHi, 99);
    assert.equal(scenarioById("south").impactLo, 77);
    assert.equal(scenarioById("south").impactHi, 85);
  });

  it("impact-only actually turns fire off", () => {
    assert.equal(scenarioById("nofire").noFire, true);
    assert.equal(scenarioById("north").noFire, false);
  });

  it("WTC 7 is fire, no plane, 47 stories, columns not pre-cut", () => {
    const s = scenarioById("wtc7");
    assert.equal(s.hasPlane, false);
    assert.equal(s.noFire, false);
    assert.equal(s.floors, 47);
    assert.equal(s.crush, true);
    assert.ok(s.impactIntact.every((v) => v === 1), "no airplane gash");
    assert.equal(scenarioById("south").nextId, "wtc7");
  });

  it("fire-stays-put still has fire, but fireSpread = 0", () => {
    const s = scenarioById("stays");
    assert.equal(s.noFire, false);
    assert.equal(s.fireSpread, 0);
  });
});

describe("scenarioById", () => {
  it("falls back to the first run rather than throwing — the View can always paint", () => {
    const s = scenarioById("not-a-real-id");
    assert.equal(s.id, SCENARIOS[0].id);
  });

  it("exposes every claim run in CLAIM", () => {
    assert.ok(CLAIM.some((s) => s.id === "tree"));
    assert.ok(CLAIM.some((s) => s.id === "north"));
  });
});
