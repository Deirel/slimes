export type Tool = 'attract' | 'repel' | 'wall' | 'erase';

export interface Agent {
  x: number;
  y: number;
  angle: number;
}

export interface SimParams {
  diffusionBase: number; // base diffusion coefficient
  evaporationBase: number; // base evaporation coefficient
  diffusionDriftAmp: number;
  evaporationDriftAmp: number;
  diffusionDriftPeriod: number; // seconds
  evaporationDriftPeriod: number; // seconds
  sensorOffset: number; // distance from agent
  sensorAngle: number; // radians left/right
  sensorRadius: number; // averaging radius
  speed: number; // px per second
  turnSpeed: number; // rad per second
  turnNoise: number; // added random variation
  depositPerStep: number;
  fieldMin: number;
  fieldMax: number;
  // Hidden memory layer parameters (Iteration 01)
  memoryInfluence: number; // weight of memory in sensors
  memoryDepositFactor: number; // how much memory accumulates per agent deposit unit
  memoryDecayPerSecond: number; // exponential decay per second (0..1)
  // Iteration 02 — latent flow (vector field) parameters
  flowInfluence: number; // weight of latent flow added to velocity (px/s multiplier)
  flowDepositPerSecond: number; // how fast agents imprint direction into flow (units per second)
  flowDecayPerSecond: number; // exponential decay per second (0..1)
  flowMaxMagnitude: number; // clamp per-cell flow vector magnitude (px/s equivalent)
}
