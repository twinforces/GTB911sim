/**
 * WTC 7 is not a short twin.
 *
 * What: Interior columns are struts, braced by floors, loosely coupled.
 * Why a separate file: the twins are a tube + hat. 7 is a seated girder
 * at column 79. Mixing those in evaluateStructure is how you fake a
 * pancake with the wrong building.
 *
 * Sequence (NIST NCSTAR 1A, teaching-scale):
 *   beams expand → girder walks off the seat at 79
 *   floors cascade down to the thick 5th
 *   79 is then a slender unbraced strut → Euler buckle
 *   80, then 81 (they only share load through those floors)
 *   east penthouse drops
 *   west interior, then the shell
 */
export const WTC7_SPAN = 24;
/** Remaining bearing after the connection fails, metres. ~4 in of an 11 in seat. */
export const WTC7_SEAT = 0.105;
/** Thermal expansion of steel, 1/°C. */
export const WTC7_ALPHA = 12e-6;
/** Thick transfer floor. Cascade stops here. Story number, 1-based. */
export const WTC7_SLAB = 5;
/** Stories of missing brace before 79 is a Euler problem. */
export const WTC7_UNBRACED = 6;
/** Fire Speed ceiling. 7 hours of office fire has to be watchable. */
export const MAX_HEAT_STRUT = 2400;

/** 79, 80, 81, west interior, perimeter shell. Sum = 1. */
export const TRIB_WTC7 = [0.18, 0.16, 0.14, 0.22, 0.3];
/** East interior cluster, then west, then the moment-frame shell. */
export const COL_X_WTC7 = [0.26, 0.34, 0.42, 0.64, 0.9];

export const WTC7_LABELS = ["Col 79", "Col 80", "Col 81", "West", "Shell"] as const;

/**
 * Walk of the east girder, metres, from beam temperature.
 * α L ΔT. At ~400 °C this exceeds the seat. That is expansion, not yield.
 */
export function girderWalk(temp: number): number {
  return WTC7_ALPHA * WTC7_SPAN * Math.max(0, temp - 20);
}
