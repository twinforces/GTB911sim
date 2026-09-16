/**
 * Model — the argument.
 *
 * What: Numbers, members, and the Euler step. No React. No WebGL. No buttons.
 * Why: A hostile reader who thinks this is a video should be able to open one
 * small file and see the law they are accusing. If they have to wade through
 * canvas code to find gravity, we have hidden the argument. See README.md
 * in this folder for the accusation → file map.
 */
export { G, STEP, FLOORS, FLOOR_H, WIDTH, HEIGHT, COLS, COL_X, TRIB, MASS, SF, ANTENNA, COL_LABELS } from "./constants.ts";
export { girderWalk, TRIB_WTC7, COL_X_WTC7, WTC7_SEAT } from "./frame.ts";
export { interp, fyFactor, eFactor, steelRgb, rgbCss } from "./steel.ts";
export { woodFy, woodRgb } from "./wood.ts";
export {
  buildPieces,
  ignitePieces,
  heatPieces,
  spreadPieces,
  evaluatePieces,
  integratePieces,
  pieceCgrav,
  piecesSettled,
  fyOf,
  hottest,
  restackBonfire,
  LOG_SECTIONS,
  LOG_JOINS,
  unlockPiece,
} from "./pieces.ts";
export { SimEngine } from "./engine.ts";
export { SCENARIOS, PATH, CLAIM, scenarioById } from "./scenarios.ts";
export type {
  Phase,
  FloorState,
  WorldKind,
  Shape,
  Material,
  PieceKind,
  Column,
  Floor,
  Piece,
  Pit,
  PlaneState,
  Block,
  BubbleKind,
  Bubble,
  Particle,
  LogEvent,
  FaceStatus,
  Probe,
  SimSnapshot,
  Scenario,
} from "./types.ts";
