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
}
