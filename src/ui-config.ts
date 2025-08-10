import type { UIConfigV2, ControlSpec } from './types';

export const UI_CONFIG: UIConfigV2 = {
  layout: {
    rowHeight: 56,
    gap: 8
  },
  toolbar: [
    { id: 'attract', type: 'toggle', title: 'Притяжение', icon: '➕', group: 'tool', initial: true, units: 1 },
    { id: 'repel', type: 'toggle', title: 'Отталкивание', icon: '➖', group: 'tool', units: 1 },
    { id: 'wall', type: 'toggle', title: 'Стена', icon: '⬛', group: 'tool', units: 1 },
    { id: 'erase', type: 'toggle', title: 'Ластик', icon: '❌', group: 'tool', units: 1 },

    { id: 'tempo', type: 'slider', title: 'Темп', min: 0.2, max: 3, step: 0.1, defaultValue: 1, units: 3 },

    { id: 'pause', type: 'toggle', title: 'Пауза', icon: '⏸️', units: 1 },
    { id: 'reset', type: 'button', title: 'Сброс', icon: '🔄', units: 1 },
    { id: 'reseed', type: 'button', title: 'Семена', icon: '🎲', units: 1 },

    {
      id: 'advanced', type: 'popup', title: 'Расширенные', icon: '⚙️', units: 1,
      toolbar: [
        { id: 'save', type: 'button', title: 'Сохранить', icon: '💾', units: 2 },
        { id: 'load', type: 'button', title: 'Загрузить', icon: '📁', units: 2 },
        { id: 'agentCount', type: 'slider', title: 'Агенты', min: 100, max: 5000, step: 100, defaultValue: 1000, units: 4 },
      ]
    },
    {
      id: 'effects', type: 'popup', title: 'Эффекты', icon: '✨', units: 1,
      toolbar: [
        { id: 'rainbow', type: 'toggle', title: 'Радуга', icon: '🌈', units: 2 },
        { id: 'trails', type: 'toggle', title: 'Следы', icon: '〰️', units: 2 },
      ]
    },
  ]
};

export type ToolType = 'attract' | 'repel' | 'wall' | 'erase';