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
}
