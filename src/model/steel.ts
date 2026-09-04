/**
 * Eurocode 3 steel — remaining strength vs temperature.
 *
 * What: Interpolation tables for effective yield (`fy`) and elastic modulus
 * (`E`) as a function of °C, plus a colour ramp for the View.
 * Why: The claim “steel melts at office-fire temperatures” is the thing we
 * are answering. We do not melt anything. We *reduce yield*. Eurocode 3
 * Table 3.1 is the published reduction. Steel melts near 1500 °C. These
 * tables are already at zero by 1200 °C.
 *
 * CRITIC: “You made up the 600 °C number.”
 * 600 °C → fy ≈ 0.47. That is the table, not a plot point we picked so the
 * tower would fall. `npm test` asserts the knots.
 */

/** Linear interpolation through sorted [x, y] knots. */
export function interp(x: number, pts: readonly (readonly [number, number])[]): number {
  if (x <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (x <= b[0]) {
      const t = (x - a[0]) / (b[0] - a[0]);
      return a[1] + t * (b[1] - a[1]);
    }
  }
  return last[1];
}

/** Eurocode 3 Table 3.1 — remaining effective yield vs °C. */
const FY: readonly (readonly [number, number])[] = [
  [0, 1],
  [400, 1],
  [500, 0.78],
  [600, 0.47],
  [700, 0.23],
  [800, 0.11],
  [900, 0.06],
  [1000, 0.04],
  [1100, 0.02],
  [1200, 0],
];

/** Elastic modulus reduction vs °C — drives sag and buckling. */
const EMOD: readonly (readonly [number, number])[] = [
  [0, 1],
  [100, 1],
  [200, 0.9],
  [300, 0.8],
  [400, 0.7],
  [500, 0.6],
  [600, 0.31],
  [700, 0.13],
  [800, 0.09],
  [900, 0.0675],
  [1000, 0.045],
  [1100, 0.0225],
  [1200, 0],
];

/** Remaining yield strength as a fraction of room-temperature fy. */
export function fyFactor(T: number): number {
  return interp(T, FY);
}

/** Remaining elastic modulus as a fraction of room-temperature E. */
export function eFactor(T: number): number {
  return interp(T, EMOD);
}

/**
 * Colour only. Does not affect strength.
 * Why it lives next to the tables: so nobody has to hunt the View for a
 * “secret heat” that is actually just a gradient.
 */
export function steelRgb(T: number): [number, number, number] {
  const pts: readonly (readonly [number, number, number, number])[] = [
    [20, 210, 220, 232],
    [250, 186, 142, 118],
    [450, 204, 96, 58],
    [600, 232, 92, 36],
    [750, 248, 148, 42],
    [900, 255, 214, 92],
    [1100, 255, 248, 220],
  ];
  if (T <= pts[0][0]) return [pts[0][1], pts[0][2], pts[0][3]];
  const last = pts[pts.length - 1];
  if (T >= last[0]) return [last[1], last[2], last[3]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (T <= b[0]) {
      const t = (T - a[0]) / (b[0] - a[0]);
      return [
        a[1] + t * (b[1] - a[1]),
        a[2] + t * (b[2] - a[2]),
        a[3] + t * (b[3] - a[3]),
      ];
    }
  }
  return [last[1], last[2], last[3]];
}

export function rgbCss(rgb: [number, number, number], a = 1): string {
  return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`;
}
