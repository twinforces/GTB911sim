/**
 * The “you picked a convenient g” file.
 *
 * G is 9.81. It is not a per-scenario slider. Fire Speed is not here.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { COLS, G, STEP, TRIB, WIDTH } from "./constants.ts";

describe("constants", () => {
  it("uses standard gravity", () => {
    assert.equal(G, 9.81);
  });

  it("steps at 1/60 s of wall clock", () => {
    assert.equal(STEP, 1 / 60);
  });

  it("lumps the tube into five column groups that still sum to 1", () => {
    assert.equal(COLS, 5);
    const sum = TRIB.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `tribute summed to ${sum}, not 1`);
  });

  it("uses the 63.4 m WTC square, not a skinny chimney", () => {
    assert.equal(WIDTH, 63.4);
  });
});
