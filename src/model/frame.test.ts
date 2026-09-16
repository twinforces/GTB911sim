/**
 * Column 79 fails from a missing brace, not from a clock and not from melt.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { girderWalk, TRIB_WTC7, WTC7_SEAT } from "./frame.ts";

describe("girder walk-off", () => {
  it("stays on the seat at office-warm, walks at ~400 °C", () => {
    assert.ok(girderWalk(200) < WTC7_SEAT, "200 °C is not a walk-off");
    assert.ok(girderWalk(400) > WTC7_SEAT, "400 °C expands past remaining bearing");
    assert.equal(girderWalk(20), 0);
  });
});

describe("WTC7 tribute", () => {
  it("sums to 1 — the shell is not a free lunch", () => {
    const sum = TRIB_WTC7.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    assert.ok(TRIB_WTC7[4] > TRIB_WTC7[0], "perimeter moment frame carries more than one interior strut");
  });
});
