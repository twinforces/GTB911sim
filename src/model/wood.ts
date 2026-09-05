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
 *
 * CRITIC: “The logs don't darken.”
 * Colour used to wait on `intact`. A log can be 400 °C and still 90%
 * section — that's a black coal with a wood core, and it has to *look*
 * like one. Surface char tracks temperature from ~80 °C (browning) to
 * 380 °C (charcoal). Ember is a coal edge, not a floodlight.
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
  const section = Math.max(0, Math.min(1, 1 - intact));
  // Surface char: browning from 80 °C, charcoal by ignition, black by 380 °C.
  const heatChar = T <= 80 ? 0 : T >= 380 ? 1 : (T - 80) / 300;
  const char = Math.min(1, Math.max(section * 0.92, heatChar * 0.97));
  const r = 158 * (1 - char) + 14 * char;
  const g = 98 * (1 - char) + 9 * char;
  const b = 48 * (1 - char) + 7 * char;
  const ember = T > 520 && intact > 0.04 ? Math.min(0.18, (T - 520) / 700) : 0;
  return [r + ember * 55, g + ember * 14, b + ember * 4];
}
