/**
 * Eurocode 3 knots — the “you made up 600 °C” file.
 *
 * What: fyFactor / eFactor / interp.
 * Why these tests exist: a hostile reader can run `npm test` and see that
 * 600 °C → 0.47 is the published table, not a plot point we picked so a
 * tower would fall. Steel is not “melted” here. Melt is ~1500 °C.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eFactor, fyFactor, interp } from "./steel.ts";

describe("interp", () => {
  const pts = [
    [0, 1],
    [10, 0],
  ] as const;

  it("clamps below the first knot", () => {
    assert.equal(interp(-5, pts), 1);
  });

  it("clamps above the last knot", () => {
    assert.equal(interp(99, pts), 0);
  });

  it("lerps between knots", () => {
    assert.equal(interp(5, pts), 0.5);
  });
});

describe("fyFactor (Eurocode 3 Table 3.1)", () => {
  it("is 1.0 from room temperature through 400 °C", () => {
    assert.equal(fyFactor(20), 1);
    assert.equal(fyFactor(400), 1);
  });

  it("is 0.47 at 600 °C — half the strength, not melted", () => {
    assert.equal(fyFactor(600), 0.47);
  });

  it("is 0.11 at 800 °C", () => {
    assert.equal(fyFactor(800), 0.11);
  });

  it("is already 0 at 1200 °C, before melting (~1500 °C)", () => {
    assert.equal(fyFactor(1200), 0);
    assert.equal(fyFactor(1500), 0);
  });

  it("never returns NaN or > 1", () => {
    for (const T of [0, 20, 250, 550, 725, 999, 1400]) {
      const f = fyFactor(T);
      assert.ok(Number.isFinite(f), `fy(${T}) was ${f}`);
      assert.ok(f >= 0 && f <= 1, `fy(${T}) out of range: ${f}`);
    }
  });
});

describe("eFactor", () => {
  it("starts dropping before yield does — sag then buckle, then yield", () => {
    assert.equal(eFactor(20), 1);
    assert.ok(eFactor(300) < 1, "modulus is already soft at 300 °C");
    assert.equal(fyFactor(300), 1);
    assert.ok(eFactor(600) < fyFactor(600), "at 600 °C, E has fallen further than fy");
  });
});
