export const UI_CONFIG = {
  tools: {
    attract: { 
      radius: 8, 
      strength: 0.9, 
      icon: '➕', 
      hotkey: '1',
      title: 'Притяжение'
    },
    repel: { 
      radius: 8, 
      strength: -0.9, 
      memoryStrength: -0.6, 
      icon: '➖', 
      hotkey: '2',
      title: 'Отталкивание'
    },
    wall: { 
      radius: 8, 
      icon: '⬛', 
      hotkey: '3',
      title: 'Стена'
    },
    erase: { 
      radius: 10, 
      halveRadius: 10,
      icon: '❌', 
      hotkey: '4',
      title: 'Ластик'
    }
  },
  
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
    goalOverlayProgressAlpha: 0.65
  },
  
  canvas: {
    minFieldWidth: 60,
    minFieldHeight: 60,
    cellSize: 5,
    maxDPR: 2
  },
  
  mobile: {
    toolbarHeight: 60,
    breakpoint: 768,
    smallScreenBreakpoint: 480
  },
  
  hud: {
    fpsUpdateInterval: 10 // frames
  },
  
  tempo: {
    min: 0.2,
    max: 3,
    step: 0.1,
    default: 1
  }
} as const;

export type ToolType = keyof typeof UI_CONFIG.tools;