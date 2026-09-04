export type Phase = "idle" | "approach" | "fire" | "collapse" | "settled";

export type FloorState = "stacked" | "block" | "crushed";

export type WorldKind = "pieces" | "tower";

export type Shape = "bonfire" | "house" | "apartment" | "tower";

export type Material = "wood" | "steel";

export type PieceKind =
  | "log"
  | "stud"
  | "plate"
  | "joist"
  | "rafter"
  | "sill"
  | "slab"
  | "column"
  | "wall"
  | "roof"
  | "tree"
  | "couch";

export interface Column {
  intact: number;
  temp: number;
  fuel: number;
  burning: number;
  stripped: number;
  failed: boolean;
  sag: number;
  bow: number;
}

export interface Floor {
  i: number;
  story: number;
  mass: number;
  state: FloorState;
  cols: Column[];
  xJitter: number;
  rotJitter: number;
}

export interface Piece {
  id: number;
  kind: PieceKind;
  material: Material;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  depth: number;
  theta: number;
  vx: number;
  vy: number;
  vz: number;
  omega: number;
  mass: number;
  temp: number;
  fuel: number;
  burning: number;
  stripped: number;
  intact: number;
  failed: boolean;
  dynamic: boolean;
  layer: number;
  col: number;
  restX: number;
  restY: number;
  restZ: number;
  alongZ: boolean;
}

export interface Pit {
  left: number;
  right: number;
  depth: number;
  near: number;
  far: number;
}

export interface PlaneState {
  alive: boolean;
  exploded: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
}

export interface Block {
  lo: number;
  hi: number;
  x: number;
  bottomY: number;
  theta: number;
  vx: number;
  vy: number;
  omega: number;
  mass: number;
  I: number;
  hinged: boolean;
  hingeX: number;
  hingeY: number;
}

export type BubbleKind = "info" | "fire" | "warn" | "critical" | "ok";

export interface Bubble {
  id: number;
  x: number;
  y: number;
  title: string;
  detail: string;
  kind: BubbleKind;
  born: number;
  ttl: number;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  kind: "fire" | "smoke" | "dust" | "spark";
}

export interface LogEvent {
  tMin: number;
  text: string;
  kind: BubbleKind;
}

export interface FaceStatus {
  temp: number;
  fire: number;
  cap: number;
  damage: number;
}

export interface Probe {
  label: string;
  temp: number;
  fy: number;
  ratio: number;
  burning: number;
  dynamic: boolean;
}

export interface SimSnapshot {
  phase: Phase;
  paused: boolean;
  simMin: number;
  clock: string;
  rotationDeg: number;
  maxRotationDeg: number;
  cgOffsetM: number;
  halfWidth: number;
  cgInside: boolean;
  leftCap: number;
  coreCap: number;
  rightCap: number;
  loadN: number;
  keJ: number;
  fallingMassKg: number;
  initiationMin: number | null;
  nistMinutes: number;
  faces: {
    impact: FaceStatus;
    sides: FaceStatus;
    core: FaceStatus;
    opposite: FaceStatus;
  };
  events: LogEvent[];
  bubbles: Bubble[];
  verdict: string;
  crush: boolean;
  storyFocus: number;
  impactLo: number;
  impactHi: number;
  hasAntenna: boolean;
  hasPlane: boolean;
  widthM: number;
  heightM: number;
  storeys: number;
  nextId: string | null;
  pathStep: number | null;
  world: WorldKind;
  shape: Shape;
  steps: number;
  probe: Probe | null;
  hatTruss: boolean;
  pieceCount: number;
  looseCount: number;
}

export interface Scenario {
  id: string;
  name: string;
  short: string;
  blurb: string;
  clockStart: string;
  nistMinutes: number;
  world: WorldKind;
  shape: Shape;
  floors: number;
  floorH: number;
  width: number;
  mass: number;
  viewScale: number;
  actionScale: number;
  defaultSpeed: number;
  hasPlane: boolean;
  group: "path" | "claim";
  pathStep: number | null;
  nextId: string | null;
  brief: string;
  impactLo: number;
  impactHi: number;
  /** Remaining section 0–1 after impact, per column group L→R. */
  impactIntact: [number, number, number, number, number];
  fireSpread: number;
  noFire: boolean;
  crush: boolean;
  hatTruss: boolean;
  planeAngle: number;
  hasAntenna: boolean;
  heatRate: number;
}
