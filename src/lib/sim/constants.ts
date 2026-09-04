export const FLOORS = 110;
export const FLOOR_H = 3.66; // m
export const WIDTH = 63.4; // m
export const HEIGHT = FLOORS * FLOOR_H;
export const COLS = 5;
/** Fraction of width, left (impact face) → right (opposite face). */
export const COL_X = [0.07, 0.28, 0.5, 0.72, 0.93];
/** Gravity-load tribute. Perimeter ~50%, core ~50%, four faces split. */
export const TRIB = [0.14, 0.18, 0.36, 0.18, 0.14];
export const MASS = 3.1e6; // kg per storey, order-of-magnitude
export const G = 9.81;
/** Residual factor on dead load after live load is gone. */
export const SF = 2.75;
export const STEP = 1 / 60;
export const ANTENNA = 110; // m, North Tower only

export const COL_LABELS = [
  "Impact face",
  "Side peri",
  "Core",
  "Far side",
  "Opposite face",
] as const;
