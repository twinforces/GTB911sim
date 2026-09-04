import { interp } from "./steel";

/** Remaining wood strength vs °C. Char eats section separately. */
const WOOD_FY: readonly (readonly [number, number])[] = [
  [0, 1],
  [100, 1],
  [180, 0.82],
  [250, 0.5],
  [300, 0.22],
  [350, 0.08],
  [400, 0.02],
  [500, 0],
];

export function woodFy(T: number): number {
  return interp(T, WOOD_FY);
}

/** Fresh timber → charcoal. Ember glow is added by the mesh emissive, not here. */
export function woodRgb(T: number, intact: number): [number, number, number] {
  const char = Math.max(0, Math.min(1, 1 - intact));
  const ember = T > 380 && intact > 0.06 ? Math.min(0.55, (T - 380) / 500) : 0;
  const r = 168 * (1 - char) + 22 * char + ember * 110;
  const g = 104 * (1 - char) + 16 * char + ember * 28;
  const b = 48 * (1 - char) + 12 * char + ember * 4;
  return [r, g, b];
}
