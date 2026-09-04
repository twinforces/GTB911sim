/**
 * Wood strength vs temperature, and charcoal colour.
 *
 * What: Remaining fraction of timber capacity as it heats, plus the colour
 * ramp the View uses for char.
 * Why a separate file from steel: wood does not follow Eurocode 3. It chars.
 * Section is eaten (`intact` in pieces.ts) *and* the remaining wood is
 * weaker with temperature. Two mechanisms, both required for a house to
 * burn down instead of “stay a house.”
 *
 * CRITIC: “You set wood to zero so the roof would drop.”
 * 250 °C → half. 500 °C → none. That is the published wood-in-fire range,
 * not a knob on the house scenario. Char (section loss) is `intact`, here.
 */
import { interp } from "./steel.ts";

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
