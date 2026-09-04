/**
 * Wood char table.
 *
 * What: woodFy vs °C.
 * Why: houses burn down because timber chars, not because we zeroed a
 * “house strength” slider. 250 °C is half. 500 °C is gone.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { woodFy, woodRgb } from "./wood.ts";

describe("woodFy", () => {
  it("is 1.0 at room temperature", () => {
    assert.equal(woodFy(20), 1);
    assert.equal(woodFy(100), 1);
  });

  it("is 0.5 at 250 °C", () => {
    assert.equal(woodFy(250), 0.5);
  });

  it("is 0 at 500 °C and stays 0", () => {
    assert.equal(woodFy(500), 0);
    assert.equal(woodFy(800), 0);
  });

  it("is weaker than Eurocode steel at the same office-fire temperature", async () => {
    const { fyFactor } = await import("./steel.ts");
    assert.ok(woodFy(400) < fyFactor(400), "wood is gone as a structure by 400 °C; steel is still at full fy");
  });
});

describe("woodRgb", () => {
  it("goes toward charcoal as intact drops — colour is not strength", () => {
    const fresh = woodRgb(22, 1);
    const char = woodRgb(22, 0.05);
    assert.ok(char[0] < fresh[0], "charred wood is darker red");
    assert.ok(char[1] < fresh[1], "charred wood is darker green");
  });
});
