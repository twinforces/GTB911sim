/**
 * ViewModel — the only object the View is allowed to talk to.
 *
 * What: Owns the Model (`SimEngine`). Turns play / pause / speed / which-run
 * into commands, and turns `SimSnapshot` into the labels the UI paints.
 * Why: The View (React + WebGL) must not construct or step the engine. If a
 * critic finds gravity inside a button handler, we have mixed the argument
 * with the chrome. Tests in this folder run the same commands without a GPU.
 *
 * The 3D canvas may *read* `vm.engine` to draw members. It must not `new
 * SimEngine` and it must not call `engine.step` — it calls `vm.advance(dt)`.
 */
import { SimEngine } from "../model/engine.ts";
import { SCENARIOS, scenarioById } from "../model/scenarios.ts";
import type { LogEvent, Scenario, SimSnapshot } from "../model/types.ts";

const DEFAULT_ID = "bonfire";

export interface LabViewModelOptions {
  /**
   * What: skip hit-stop and camera punch.
   * Why: vestibular / motion-sensitivity. Does not change temperatures,
   * strength, or whether a member unlocks.
   */
  reducedMotion?: boolean;
}

/**
 * What the View binds to. One object, one frame.
 *
 * Why a wrapper instead of `SimSnapshot` alone: the snapshot is the Model’s
 * report. Playing / mid-run / “this is wood” / next-run are *UI decisions*
 * about that report. Keeping them here means the View does not re-derive
 * policy from raw fields — and tests can assert the labels without React.
 */
export interface LabViewState {
  snap: SimSnapshot;
  scenarioId: string;
  scenario: Scenario;
  speed: number;
  playing: boolean;
  midRun: boolean;
  /** Bonfire / house / apartment: wood char. Towers: Eurocode 3 steel. */
  wood: boolean;
  next: Scenario | null;
  latest: LogEvent | null;
  igniteLabel: string;
  fireSpeedCaption: string;
  gravityCaption: string;
}

export class LabViewModel {
  /**
   * The physics object. Public so the 3D View can read piece positions.
   * Construction and `step()` stay in this class.
   */
  readonly engine: SimEngine;
  private scenarioId: string;
  private speedValue: number;

  constructor(scenarioId: string = DEFAULT_ID, opts: LabViewModelOptions = {}) {
    const scenario = scenarioById(scenarioId);
    this.scenarioId = scenario.id;
    this.speedValue = scenario.defaultSpeed;
    this.engine = new SimEngine(scenario);
    this.engine.setSpeed(this.speedValue);
    this.engine.reducedMotion = Boolean(opts.reducedMotion);
  }

  get speed(): number {
    return this.speedValue;
  }

  getScenarioId(): string {
    return this.scenarioId;
  }

  /**
   * What: the labels + snapshot the View is allowed to render.
   * Why: one function, so a test can ask “what would the user see?” without
   * mounting React. If a caption is wrong, the bug is here, not in JSX.
   */
  getState(): LabViewState {
    const snap = this.engine.snapshot();
    const scenario = scenarioById(this.scenarioId);
    const phase = snap.phase;
    const playing = !snap.paused && phase !== "idle" && phase !== "settled";
    const midRun = phase !== "idle" && phase !== "settled";
    const wood = scenario.shape === "bonfire" || scenario.shape === "house" || scenario.shape === "apartment";
    const next = scenario.nextId ? scenarioById(scenario.nextId) : null;
    const latest = snap.events.length ? snap.events[snap.events.length - 1] : null;
    return {
      snap,
      scenarioId: this.scenarioId,
      scenario,
      speed: this.speedValue,
      playing,
      midRun,
      wood,
      next,
      latest,
      igniteLabel: scenario.hasPlane ? "Impact" : "Ignite",
      fireSpeedCaption:
        "Heating time-scale only. Gravity and collapse always run at 1×. 8× means fire walks eight times faster than the clock.",
      gravityCaption: "9.81 m/s². Not a slider. Fire Speed does not touch this.",
    };
  }

  /** Model snapshot, unchanged. Tests that only care about physics can skip getState(). */
  snapshot(): SimSnapshot {
    return this.engine.snapshot();
  }

  /**
   * What: one Euler slice of wall-clock time.
   * Why: the RAF loop lives in the View (it has to, it owns the canvas) but
   * the View is forbidden from calling `engine.step` itself. All time
   * advances through this method so a test can drive the same path.
   */
  advance(dt: number): SimSnapshot {
    this.engine.step(dt);
    return this.engine.snapshot();
  }

  /**
   * What: idle → fire (or approach, if there is a plane). Resume if paused.
   * Why: ignition is a command, not a temperature the View writes. The Model
   * decides *which* member lights (`ignitePieces`).
   */
  play(): void {
    this.engine.play();
  }

  pause(): void {
    this.engine.pause();
  }

  /**
   * What: Space-bar / Play button.
   * Why: Settled is a finished run, not a paused one. Hitting play there
   * resets to idle so the user can read the brief again — it does not
   * secretly continue integrating.
   */
  togglePlay(): void {
    if (this.engine.phase === "settled") {
      this.reset();
      return;
    }
    if (this.engine.paused || this.engine.phase === "idle") {
      this.play();
      return;
    }
    this.pause();
  }

  reset(): void {
    this.engine.reset(scenarioById(this.scenarioId));
    this.engine.setSpeed(this.speedValue);
  }

  /**
   * What: Fire Speed slider, 1–240.
   * Why the name is not “sim speed”: it must not be mistaken for a gravity
   * multiplier. The clamp lives in the Model (`SimEngine.setSpeed`).
   */
  setSpeed(v: number): void {
    this.engine.setSpeed(v);
    this.speedValue = this.engine.speed;
  }

  /**
   * What: swap the run (bonfire → house → …) and rebuild the world.
   * Why: a scenario is a set of *initial conditions*, not a different
   * renderer. Same three laws, different members.
   */
  selectScenario(id: string): void {
    const scenario = scenarioById(id);
    this.scenarioId = scenario.id;
    this.speedValue = scenario.defaultSpeed;
    this.engine.reset(scenario);
    this.engine.setSpeed(this.speedValue);
  }

  /** Digit keys 1–9 in the View. Unknown digits are ignored. */
  selectScenarioByIndex(index: number): boolean {
    const scenario = SCENARIOS[index];
    if (!scenario) return false;
    this.selectScenario(scenario.id);
    return true;
  }
}
