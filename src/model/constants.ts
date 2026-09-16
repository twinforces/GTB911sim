/**
 * World constants.
 *
 * What: The numbers that do not change between runs — gravity, WTC massing,
 * the Euler step, column tribute.
 * Why they live in their own file: if someone claims we faked gravity, this
 * is the entire file they need. `G` is not a slider. Fire Speed is not here.
 *
 * WTC figures are order-of-magnitude (NIST NCSTAR 1 / Bazant). This lab is
 * a teaching model, not a reconstruction of 236 perimeter columns.
 */

/**
 * CRITIC: “You picked a convenient g.”
 * What: 9.81 m/s².
 * Why: Standard gravity. Same value on the bonfire and on the North Tower.
 * Changing this would change every run the same way — there is no per-scenario g.
 */
export const G = 9.81;

/** Euler step, seconds of *wall clock*. Heating may consume speed × this; falling does not. */
export const STEP = 1 / 60;
/** Fire Speed ceiling for tube / wood runs. Strut (WTC 7) uses MAX_HEAT_STRUT. */
export const MAX_HEAT = 240;

export const FLOORS = 110;
export const FLOOR_H = 3.66; // m, typical WTC story
export const WIDTH = 63.4; // m, the square tube
export const HEIGHT = FLOORS * FLOOR_H;
export const COLS = 5;
/** Fraction of width, left (impact face) → right (opposite face). */
export const COL_X = [0.07, 0.28, 0.5, 0.72, 0.93];
/**
 * Gravity-load tribute. Perimeter ~50%, core ~50%, four faces split.
 * Why lumped: five groups keep the Model small enough to read. Real WTC had
 * 236 perimeter columns + 47 core. Lumping does not invent a hinge.
 */
export const TRIB = [0.14, 0.18, 0.36, 0.18, 0.14];
/** kg per story, order-of-magnitude. */
export const MASS = 3.1e6;
/** Residual factor on dead load after live load is gone. Buildings are not designed at 1.0. */
export const SF = 2.75;
/** North Tower antenna, metres. Cosmetic massing, not a demolition fuse. */
export const ANTENNA = 110;

export const COL_LABELS = [
  "Impact face",
  "Side peri",
  "Core",
  "Far side",
  "Opposite face",
] as const;
