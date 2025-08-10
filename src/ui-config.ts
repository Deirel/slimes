import { ButtonConfig, ControlConfig, PopupConfig } from './types';

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
  
  buttons: {
    pause: { 
      icon: '⏸️', 
      title: 'Пауза', 
      hotkey: 'p', 
      action: 'toggle' as const, 
      id: 'btn-pause' 
    },
    reset: { 
      icon: '🔄', 
      title: 'Сброс сцены', 
      action: 'trigger' as const, 
      id: 'btn-reset' 
    },
    reseed: { 
      icon: '🎲', 
      title: 'Новые семена', 
      action: 'trigger' as const, 
      id: 'btn-reseed' 
    }
  },
  
  controls: {
    tempo: { 
      type: 'slider' as const, 
      label: 'Темп', 
      min: 0.2,
      max: 3,
      step: 0.1,
      default: 1,
      id: 'tempo' 
    }
  },

  popups: {
    advanced: {
      icon: '⚙️',
      title: 'Расширенные настройки',
      items: {
        buttons: {
          save: { icon: '💾', title: 'Сохранить состояние', action: 'trigger' as const },
          load: { icon: '📁', title: 'Загрузить состояние', action: 'trigger' as const }
        },
        controls: {
          agentCount: { type: 'slider' as const, label: 'Агенты', min: 100, max: 5000, step: 100, default: 1000, id: 'agentCount' }
        }
      }
    },
    effects: {
      icon: '✨',
      title: 'Эффекты',
      items: {
        buttons: {
          rainbow: { icon: '🌈', title: 'Радужный режим', action: 'toggle' as const },
          trails: { icon: '〰️', title: 'Длинные следы', action: 'toggle' as const }
        }
      }
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
  }
} as const;

export type ToolType = keyof typeof UI_CONFIG.tools;