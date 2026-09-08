/**
 * ViewModel commands. No React. No canvas.
 *
 * What: play / pause / reset / speed / which-run, and the labels the View
 * would bind to.
 * Why: if a caption is a lie, it should fail here, not in a screenshot.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LabViewModel } from "./LabViewModel.ts";

describe("LabViewModel construction", () => {
  it("does not construct via the View — this test is the allowed caller", () => {
    const vm = new LabViewModel("bonfire");
    assert.equal(vm.getScenarioId(), "bonfire");
    const state = vm.getState();
    assert.equal(state.snap.phase, "idle");
    assert.equal(state.snap.paused, true);
    assert.equal(state.playing, false);
    assert.equal(state.midRun, false);
    assert.equal(state.wood, true);
    assert.equal(state.igniteLabel, "Ignite");
    assert.equal(state.next?.id, "house1");
  });

  it("unknown id falls back rather than crashing the chrome", () => {
    const vm = new LabViewModel("nope");
    assert.equal(vm.getState().scenarioId, "bonfire");
  });
});

describe("commands", () => {
  it("play then pause then togglePlay", () => {
    const vm = new LabViewModel("house1");
    vm.play();
    assert.equal(vm.snapshot().phase, "fire");
    assert.equal(vm.snapshot().paused, false);
    assert.equal(vm.getState().playing, true);
    vm.pause();
    assert.equal(vm.snapshot().paused, true);
    assert.equal(vm.getState().playing, false);
    vm.togglePlay();
    assert.equal(vm.snapshot().paused, false);
  });

  it("togglePlay on a settled run resets to idle, it does not keep integrating", () => {
    const vm = new LabViewModel("bonfire");
    vm.play();
    vm.engine.phase = "settled";
    vm.engine.paused = true;
    vm.togglePlay();
    assert.equal(vm.snapshot().phase, "idle");
    assert.equal(vm.snapshot().paused, true);
  });

  it("reset restores the same scenario, paused", () => {
    const vm = new LabViewModel("house1");
    vm.play();
    vm.advance(1 / 60);
    vm.reset();
    const snap = vm.snapshot();
    assert.equal(snap.phase, "idle");
    assert.equal(snap.paused, true);
    assert.equal(snap.shape, "house");
    assert.equal(vm.getScenarioId(), "house1");
  });

  it("setSpeed is Fire Speed, clamped, and shows up on getState", () => {
    const vm = new LabViewModel("house1");
    vm.setSpeed(40);
    assert.equal(vm.speed, 40);
    assert.equal(vm.getState().speed, 40);
    vm.setSpeed(0);
    assert.equal(vm.speed, 1);
    vm.setSpeed(1000);
    assert.equal(vm.speed, 240);
    assert.match(vm.getState().fireSpeedCaption, /Gravity and collapse always run at 1×/);
    assert.match(vm.getState().gravityCaption, /9\.81/);
  });

  it("selectScenario rebuilds the world (bonfire logs → house timber)", () => {
    const vm = new LabViewModel("bonfire");
    const logs = vm.engine.pieces.filter((p) => p.kind === "log").length;
    assert.ok(logs > 10);
    vm.selectScenario("house1");
    assert.equal(vm.getScenarioId(), "house1");
    assert.equal(vm.snapshot().shape, "house");
    assert.ok(vm.engine.pieces.some((p) => p.kind === "tree"));
    assert.equal(vm.snapshot().phase, "idle");
    assert.ok(vm.getState().wood);
  });

  it("selectScenarioByIndex walks 1–9 and ignores junk", () => {
    const vm = new LabViewModel();
    assert.equal(vm.selectScenarioByIndex(1), true);
    assert.equal(vm.getScenarioId(), "house1");
    assert.equal(vm.selectScenarioByIndex(99), false);
    assert.equal(vm.getScenarioId(), "house1");
  });

  it("tower runs label the button Impact, not Ignite", () => {
    const vm = new LabViewModel("north");
    const state = vm.getState();
    assert.equal(state.igniteLabel, "Impact");
    assert.equal(state.wood, false);
    assert.equal(state.scenario.hasPlane, true);
  });

  it("WTC 7 labels the button Ignite — there is no airplane", () => {
    const vm = new LabViewModel("wtc7");
    const state = vm.getState();
    assert.equal(state.igniteLabel, "Ignite");
    assert.equal(state.scenario.hasPlane, false);
    assert.equal(state.wood, false);
  });
});

describe("advance", () => {
  it("is the only way the View is allowed to step time", () => {
    const vm = new LabViewModel("house1");
    vm.play();
    const t0 = vm.engine.t;
    vm.advance(1 / 60);
    assert.ok(vm.engine.t > t0);
    assert.equal(vm.engine.speed, vm.speed);
  });
});
