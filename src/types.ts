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

export interface ButtonConfig {
  icon: string;
  title: string;
  hotkey?: string;
  action?: 'toggle' | 'trigger';
  id?: string;
}

export interface ControlConfig {
  type: 'slider';
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  id: string;
}

export interface PopupConfig {
  icon: string;
  title: string;
  items: {
    buttons?: Record<string, ButtonConfig>;
    controls?: Record<string, ControlConfig>;
  };
}

// New row-based UI schema

export interface UILayoutConfig {
  rowHeight: number; // pixels
  gap: number; // pixels; both vertical padding and horizontal spacing
}

export interface BaseControlSpec {
  id: string;
  title: string;
  units?: number; // width measured in units; 1 unit = rowHeight - 2*gap
  hotkey?: string;
}

export interface ButtonSpec extends BaseControlSpec {
  type: 'button';
  icon: string;
}

export interface ToggleSpec extends BaseControlSpec {
  type: 'toggle';
  icon: string;
  group?: string; // e.g., 'tool' for exclusive tool selection
  initial?: boolean;
}

export interface SliderSpec extends BaseControlSpec {
  type: 'slider';
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface PopupButtonSpec extends BaseControlSpec {
  type: 'popup';
  icon: string;
  toolbar: ControlSpec[]; // child toolbar controls displayed in a new row above
}

export type ControlSpec = ButtonSpec | ToggleSpec | SliderSpec | PopupButtonSpec;

export interface UIConfigV2 {
  layout: UILayoutConfig;
  toolbar: ControlSpec[]; // base row controls
}
