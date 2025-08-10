import type { Tool } from './types';

export const APP_CONFIG = {
  tools: {
    attract: {
      radius: 8,
      strength: 0.9,
    },
    repel: {
      radius: 8,
      strength: -0.9,
      memoryStrength: -0.6,
    },
    wall: {
      radius: 8,
    },
    erase: {
      radius: 10,
      halveRadius: 10,
    },
  } as const satisfies Record<Tool, any>,

  animation: {
    pulsesDuration: 0.8,
    pulseStartRadius: 4,
    pulseEndRadius: 22,
    dashSpeed: 60,
    arrowSpeed: 40,
    chevronSpacing: 12,
    chevronSize: 2.5,
    progressSmoothingFactor: 0.2,
    goalOverlayBaseAlpha: 0.35,
    goalOverlayProgressAlpha: 0.65,
  },

  canvas: {
    minFieldWidth: 60,
    minFieldHeight: 60,
    cellSize: 5,
    maxDPR: 2,
  },

  mobile: {
    breakpoint: 768,
    smallScreenBreakpoint: 480,
  },

  hud: {
    fpsUpdateInterval: 10, // frames
  },
} as const;

export type AppToolConfig = typeof APP_CONFIG.tools[Tool];
