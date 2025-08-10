# План рефакторинга UI/UX

## Фаза 1: Минимальный рефакторинг

### 1. Создание модуля конфигурации (ui-config.ts)

#### Создать файл `src/ui-config.ts`
```typescript
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
```

#### Изменения в main.ts
- Импортировать `UI_CONFIG` и `ToolType`
- Заменить все магические числа на ссылки на конфигурацию:
  - Строка 59: `const cellSize = 5` → `const cellSize = UI_CONFIG.canvas.cellSize`
  - Строка 64: `const toolbarHeight = isMobile ? 60 : 0` → `const toolbarHeight = isMobile ? UI_CONFIG.mobile.toolbarHeight : 0`
  - Строка 70-71: минимальные размеры → `UI_CONFIG.canvas.minFieldWidth/Height`
  - Строка 184: `field.addCircle(x, y, 8, +0.9)` → `field.addCircle(x, y, UI_CONFIG.tools.attract.radius, UI_CONFIG.tools.attract.strength)`
  - Строки 185-194: аналогично для других инструментов
  - Строка 209: `Math.min(2, ...)` → `Math.min(UI_CONFIG.canvas.maxDPR, ...)`
  - Строки 261-268: параметры пульсов
  - Строки 277, 302, 308-309: параметры анимации

#### Изменения в hud.ts
- Импортировать `UI_CONFIG`
- Строка 17: `if (this.frameCounter >= 10)` → `if (this.frameCounter >= UI_CONFIG.hud.fpsUpdateInterval)`
- Строка 19: `(10 * 1000)` → `(UI_CONFIG.hud.fpsUpdateInterval * 1000)`

#### Изменения в index.html
- Строка 197: использовать значения из конфигурации для атрибутов range input

### 2. Унифицированная обработка ввода (input-handler.ts)

#### Создать файл `src/input-handler.ts`
```typescript
import { Field } from './field';
import { UI_CONFIG, ToolType } from './ui-config';

export interface PointerPosition {
  x: number;
  y: number;
}

export type PointerHandler = (pos: PointerPosition, tool: ToolType) => void;

export class InputHandler {
  private isDrawing = false;
  private currentTool: ToolType = 'attract';
  
  constructor(
    private canvas: HTMLCanvasElement,
    private field: Field,
    private onDraw: PointerHandler
  ) {
    this.initListeners();
  }
  
  private initListeners() {
    // Pointer Events API - работает для mouse, touch, pen
    this.canvas.addEventListener('pointerdown', this.handleStart.bind(this));
    this.canvas.addEventListener('pointermove', this.handleMove.bind(this));
    this.canvas.addEventListener('pointerup', this.handleEnd.bind(this));
    this.canvas.addEventListener('pointercancel', this.handleEnd.bind(this));
    this.canvas.addEventListener('pointerleave', this.handleEnd.bind(this));
    
    // Предотвращение контекстного меню на долгое нажатие
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    
    // Отключение скроллинга на touch устройствах
    this.canvas.style.touchAction = 'none';
  }
  
  setTool(tool: ToolType) {
    this.currentTool = tool;
  }
  
  private toFieldCoords(e: PointerEvent): PointerPosition {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * this.field.width;
    const y = ((e.clientY - rect.top) / rect.height) * this.field.height;
    return { x, y };
  }
  
  private handleStart(e: PointerEvent) {
    this.isDrawing = true;
    const pos = this.toFieldCoords(e);
    this.onDraw(pos, this.currentTool);
  }
  
  private handleMove(e: PointerEvent) {
    if (!this.isDrawing) return;
    const pos = this.toFieldCoords(e);
    this.onDraw(pos, this.currentTool);
  }
  
  private handleEnd() {
    this.isDrawing = false;
  }
}
```

#### Изменения в main.ts
- Импортировать `InputHandler`
- Удалить функцию `canvasToFieldCoords` (строки 141-157)
- Удалить дублированные обработчики событий (строки 159-180)
- Заменить на:
```typescript
const inputHandler = new InputHandler(canvas, field, (pos, tool) => {
  const config = UI_CONFIG.tools[tool];
  if (tool === 'attract') {
    field.addCircle(pos.x, pos.y, config.radius, config.strength);
  } else if (tool === 'repel') {
    field.addCircle(pos.x, pos.y, config.radius, config.strength);
    field.addMemoryCircle(pos.x, pos.y, config.radius, config.memoryStrength);
  } else if (tool === 'wall') {
    field.drawWallCircle(pos.x, pos.y, config.radius);
  } else if (tool === 'erase') {
    field.eraseWallCircle(pos.x, pos.y, config.radius);
    field.halveCircle(pos.x, pos.y, config.halveRadius);
  }
});
```
- В функции `setTool` добавить: `inputHandler.setTool(t)`
- Удалить функцию `handleTool` (строки 182-195)

### 3. CSS переменные и внешние стили

#### Создать файл `src/styles.css`
```css
:root {
  /* Цветовая схема */
  --color-bg: #0a0e13;
  --color-text: #d8e6ee;
  --color-panel-bg: rgba(10, 14, 19, 0.8);
  --color-button-bg: #15222c;
  --color-button-hover: #1a2a35;
  --color-button-active: #1e3746;
  --color-button-border: #243544;
  --color-button-border-active: #4a9eff;
  --color-slider-thumb: #4a9eff;
  --color-slider-bg: #243544;
  --color-label-text: #aab6c3;
  --color-wall: #1c232c;
  
  /* Размеры */
  --hud-padding: 8px 10px;
  --hud-font-size: 12px;
  --toolbar-padding: 12px;
  --toolbar-gap: 8px;
  --button-min-size: 44px;
  --button-padding: 12px 16px;
  --button-font-size: 14px;
  --button-icon-size: 18px;
  --mobile-toolbar-height: 60px;
  --slider-width: 120px;
  --slider-height: 32px;
  --slider-thumb-size: 20px;
  
  /* Позиционирование */
  --hud-offset: 10px;
  --toolbar-offset: 10px;
  
  /* Радиусы скругления */
  --radius-small: 6px;
  --radius-medium: 8px;
  --radius-circle: 50%;
  
  /* Эффекты */
  --backdrop-blur: blur(4px);
  --transition-speed: 0.2s;
  
  /* Шрифты */
  --font-stack: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
}

/* Базовые стили */
html, body, #app {
  height: 100%;
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-stack);
}

body {
  overflow: hidden;
  touch-action: none;
}

canvas {
  display: block;
  width: 100vw;
  height: 100vh;
  image-rendering: pixelated;
}

/* HUD */
#hud {
  position: fixed;
  left: var(--hud-offset);
  bottom: var(--hud-offset);
  font-size: var(--hud-font-size);
  line-height: 1.35;
  background: var(--color-panel-bg);
  padding: var(--hud-padding);
  border-radius: var(--radius-small);
  backdrop-filter: var(--backdrop-blur);
  z-index: 10;
}

/* Toolbar */
#toolbar {
  position: fixed;
  right: var(--toolbar-offset);
  bottom: var(--toolbar-offset);
  display: flex;
  flex-direction: column;
  gap: var(--toolbar-gap);
  background: var(--color-panel-bg);
  padding: var(--toolbar-padding);
  border-radius: var(--radius-medium);
  backdrop-filter: var(--backdrop-blur);
  z-index: 10;
}

#toolbar button,
#toolbar input[type="range"] {
  cursor: pointer;
}

#toolbar button {
  background: var(--color-button-bg);
  color: var(--color-text);
  border: 1px solid var(--color-button-border);
  border-radius: var(--radius-medium);
  padding: var(--button-padding);
  font-size: var(--button-font-size);
  min-height: var(--button-min-size);
  min-width: var(--button-min-size);
  transition: background-color var(--transition-speed);
}

#toolbar button:hover,
#toolbar button:active {
  background: var(--color-button-hover);
}

#toolbar button.active {
  background: var(--color-button-active);
  border-color: var(--color-button-border-active);
}

/* Range slider */
#toolbar label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-label-text);
  font-size: var(--hud-font-size);
  padding: 4px 0;
}

#toolbar input[type="range"] {
  width: var(--slider-width);
  height: var(--slider-height);
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-slider-bg);
  border-radius: 4px;
}

#toolbar input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: var(--slider-thumb-size);
  height: var(--slider-thumb-size);
  border-radius: var(--radius-circle);
  background: var(--color-slider-thumb);
  cursor: pointer;
}

#toolbar input[type="range"]::-moz-range-thumb {
  width: var(--slider-thumb-size);
  height: var(--slider-thumb-size);
  border-radius: var(--radius-circle);
  background: var(--color-slider-thumb);
  cursor: pointer;
  border: none;
}

/* Mobile/Portrait адаптация */
@media screen and (max-width: 768px), (max-height: 600px) {
  :root {
    --hud-font-size: 11px;
    --button-icon-size: 18px;
  }
  
  canvas {
    height: calc(100vh - var(--mobile-toolbar-height));
  }
  
  #toolbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: var(--mobile-toolbar-height);
    display: flex;
    flex-direction: row;
    justify-content: space-evenly;
    align-items: center;
    padding: 8px;
    gap: 4px;
    max-width: none;
    transform: none;
    border-radius: 0;
  }
  
  #toolbar button {
    width: var(--button-min-size);
    height: var(--button-min-size);
    padding: 0;
    font-size: var(--button-icon-size);
    flex: 0 0 var(--button-min-size);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  #toolbar label {
    flex: 0 0 auto;
    flex-direction: column;
    gap: 2px;
    font-size: 10px;
    margin: 0;
  }
  
  #toolbar label span {
    text-align: center;
  }
  
  #toolbar input[type="range"] {
    width: 60px;
    height: 20px;
  }
  
  #hud {
    left: var(--hud-offset);
    top: var(--hud-offset);
    bottom: auto;
  }
}

/* Очень маленькие экраны */
@media screen and (max-width: 480px) {
  :root {
    --hud-font-size: 10px;
    --hud-padding: 6px 8px;
    --button-min-size: 40px;
    --button-icon-size: 16px;
  }
  
  #toolbar {
    padding: 6px;
  }
  
  #toolbar input[type="range"] {
    width: 50px;
    height: 18px;
  }
}
```

#### Изменения в index.html
- Удалить весь блок `<style>...</style>` (строки 7-181)
- Добавить в `<head>`:
```html
<link rel="stylesheet" href="/src/styles.css">
```

#### Изменения в vite.config.ts
- Убедиться, что Vite правильно обрабатывает CSS файлы (должно работать из коробки)

## Фаза 2: Структурные улучшения

### 4. UIController для централизации управления UI

#### Создать файл `src/ui-controller.ts`
```typescript
import { UI_CONFIG, ToolType } from './ui-config';

export interface UIState {
  tool: ToolType;
  paused: boolean;
  tempo: number;
}

export class UIController {
  private state: UIState = {
    tool: 'attract',
    paused: false,
    tempo: UI_CONFIG.tempo.default
  };
  
  private listeners = {
    toolChange: [] as ((tool: ToolType) => void)[],
    pauseChange: [] as ((paused: boolean) => void)[],
    tempoChange: [] as ((tempo: number) => void)[]
  };
  
  constructor(
    private elements: {
      toolButtons: Record<ToolType, HTMLButtonElement>;
      pauseBtn: HTMLButtonElement;
      resetBtn: HTMLButtonElement;
      reseedBtn: HTMLButtonElement;
      tempoInput: HTMLInputElement;
    }
  ) {
    this.initEventListeners();
    this.updateUI();
  }
  
  private initEventListeners() {
    // Кнопки инструментов
    for (const [tool, btn] of Object.entries(this.elements.toolButtons)) {
      btn.addEventListener('click', () => this.setTool(tool as ToolType));
    }
    
    // Горячие клавиши
    window.addEventListener('keydown', (e) => {
      for (const [tool, config] of Object.entries(UI_CONFIG.tools)) {
        if (e.key === config.hotkey) {
          this.setTool(tool as ToolType);
        }
      }
      if (e.key.toLowerCase() === 'p') {
        this.togglePause();
      }
    });
    
    // Управление темпом
    this.elements.tempoInput.addEventListener('input', () => {
      this.setTempo(parseFloat(this.elements.tempoInput.value));
    });
    
    // Пауза
    this.elements.pauseBtn.addEventListener('click', () => this.togglePause());
  }
  
  setTool(tool: ToolType) {
    this.state.tool = tool;
    this.updateToolButtons();
    this.emit('toolChange', tool);
  }
  
  togglePause() {
    this.state.paused = !this.state.paused;
    this.updatePauseButton();
    this.emit('pauseChange', this.state.paused);
  }
  
  setTempo(tempo: number) {
    this.state.tempo = tempo;
    this.emit('tempoChange', tempo);
  }
  
  private updateToolButtons() {
    for (const [tool, btn] of Object.entries(this.elements.toolButtons)) {
      btn.classList.toggle('active', tool === this.state.tool);
    }
  }
  
  private updatePauseButton() {
    this.elements.pauseBtn.textContent = this.state.paused ? '▶️' : '⏸️';
  }
  
  private updateUI() {
    this.updateToolButtons();
    this.updatePauseButton();
    this.elements.tempoInput.value = String(this.state.tempo);
  }
  
  // Event emitter pattern
  on(event: 'toolChange', handler: (tool: ToolType) => void): void;
  on(event: 'pauseChange', handler: (paused: boolean) => void): void;
  on(event: 'tempoChange', handler: (tempo: number) => void): void;
  on(event: string, handler: any) {
    if (event in this.listeners) {
      (this.listeners as any)[event].push(handler);
    }
  }
  
  private emit(event: 'toolChange', data: ToolType): void;
  private emit(event: 'pauseChange', data: boolean): void;
  private emit(event: 'tempoChange', data: number): void;
  private emit(event: string, data: any) {
    if (event in this.listeners) {
      for (const handler of (this.listeners as any)[event]) {
        handler(data);
      }
    }
  }
  
  get currentTool() { return this.state.tool; }
  get isPaused() { return this.state.paused; }
  get currentTempo() { return this.state.tempo; }
  
  // Для внешнего управления кнопками
  bindResetButton(handler: () => void) {
    this.elements.resetBtn.addEventListener('click', handler);
  }
  
  bindReseedButton(handler: () => void) {
    this.elements.reseedBtn.addEventListener('click', handler);
  }
}
```

#### Изменения в main.ts
- Импортировать `UIController`
- Удалить глобальные переменные `tool`, `paused`, `tempo` (строки 22-25)
- Удалить функцию `setTool` (строки 27-32)
- Удалить функцию `togglePause` (строки 52-55)
- Удалить обработчики событий для кнопок и клавиш (строки 34-49)
- Создать UIController:
```typescript
const uiController = new UIController({
  toolButtons: {
    attract: document.getElementById('tool-attract') as HTMLButtonElement,
    repel: document.getElementById('tool-repel') as HTMLButtonElement,
    wall: document.getElementById('tool-wall') as HTMLButtonElement,
    erase: document.getElementById('tool-erase') as HTMLButtonElement,
  },
  pauseBtn: document.getElementById('btn-pause') as HTMLButtonElement,
  resetBtn: document.getElementById('btn-reset') as HTMLButtonElement,
  reseedBtn: document.getElementById('btn-reseed') as HTMLButtonElement,
  tempoInput: document.getElementById('tempo') as HTMLInputElement
});

// Подписка на события
uiController.on('toolChange', (tool) => {
  inputHandler.setTool(tool);
});

uiController.on('pauseChange', (paused) => {
  // Используется в game loop
});

uiController.on('tempoChange', (tempo) => {
  // Используется в game loop
});

// Привязка кнопок сброса
uiController.bindResetButton(() => resetScene(true));
uiController.bindReseedButton(() => reseedAll());
```
- В game loop заменить `paused` на `uiController.isPaused`
- В game loop заменить `tempo` на `uiController.currentTempo`
- В HUD update заменить `toolName(tool)` на `UI_CONFIG.tools[uiController.currentTool].title`
- Удалить функцию `toolName` (строки 393-400)

### 5. Модуль визуальных эффектов

#### Создать файл `src/visual-effects.ts`
```typescript
import { UI_CONFIG } from './ui-config';
import type { RenderOverlay } from './goals';

interface Pulse {
  x: number;
  y: number;
  age: number;
  duration: number;
  startR: number;
  endR: number;
}

export class VisualEffects {
  private pulses: Pulse[] = [];
  private dashPhase = 0;
  private arrowPhase = 0;
  private progressSpeed = 0;
  
  addPulse(x: number, y: number) {
    this.pulses.push({
      x, y,
      age: 0,
      duration: UI_CONFIG.animation.pulsesDuration,
      startR: UI_CONFIG.animation.pulseStartRadius,
      endR: UI_CONFIG.animation.pulseEndRadius
    });
  }
  
  update(dt: number, targetProgressSpeed: number) {
    // Обновление фаз анимации
    if (dt > 0 && this.progressSpeed > 0) {
      this.dashPhase += dt * UI_CONFIG.animation.dashSpeed * this.progressSpeed;
      this.arrowPhase += dt * UI_CONFIG.animation.arrowSpeed * this.progressSpeed;
    }
    
    // Сглаживание скорости прогресса
    this.progressSpeed += (targetProgressSpeed - this.progressSpeed) * UI_CONFIG.animation.progressSmoothingFactor;
    
    // Обновление пульсов
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.age += dt;
      if (p.age >= p.duration) {
        this.pulses.splice(i, 1);
      }
    }
  }
  
  render(ctx: CanvasRenderingContext2D, overlay: RenderOverlay, progressRatio: number) {
    this.drawOverlay(ctx, overlay, progressRatio);
    this.drawProgressingStyle(ctx, overlay);
    this.drawDirectionHints(ctx, overlay, progressRatio);
    this.drawPulses(ctx);
  }
  
  private drawOverlay(ctx: CanvasRenderingContext2D, overlay: RenderOverlay, progressRatio: number) {
    ctx.save();
    ctx.lineWidth = 1;
    
    // Отрисовка кругов
    for (const c of overlay.circles) {
      ctx.beginPath();
      const baseAlpha = UI_CONFIG.animation.goalOverlayBaseAlpha;
      const progressAlpha = UI_CONFIG.animation.goalOverlayProgressAlpha;
      const a = Math.max(0, Math.min(1, c.alpha * (baseAlpha + progressAlpha * progressRatio)));
      ctx.strokeStyle = `rgba(180,220,255,${a})`;
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Отрисовка линий
    for (const l of overlay.lines) {
      ctx.beginPath();
      const baseAlpha = UI_CONFIG.animation.goalOverlayBaseAlpha;
      const progressAlpha = UI_CONFIG.animation.goalOverlayProgressAlpha;
      const a = Math.max(0, Math.min(1, l.alpha * (baseAlpha + progressAlpha * progressRatio)));
      ctx.strokeStyle = `rgba(180,220,255,${a})`;
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
    }
    
    ctx.restore();
  }
  
  private drawProgressingStyle(ctx: CanvasRenderingContext2D, overlay: RenderOverlay) {
    const alpha = Math.max(0, Math.min(1, 0.95 * this.progressSpeed));
    if (alpha <= 0.01) return;
    
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.lineDashOffset = this.dashPhase;
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(220,250,255,${alpha})`;
    
    for (const c of overlay.circles) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    for (const l of overlay.lines) {
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
    }
    
    ctx.restore();
  }
  
  private drawDirectionHints(ctx: CanvasRenderingContext2D, overlay: RenderOverlay, progressRatio: number) {
    ctx.save();
    
    for (const l of overlay.lines) {
      const vx = l.x2 - l.x1;
      const vy = l.y2 - l.y1;
      const len = Math.hypot(vx, vy) || 1;
      const nx = vx / len;
      const ny = vy / len;
      const spacing = UI_CONFIG.animation.chevronSpacing;
      const size = UI_CONFIG.animation.chevronSize;
      const baseAlpha = 0.28;
      const a = Math.max(0, Math.min(1, baseAlpha + 0.55 * progressRatio));
      const offset = this.arrowPhase % spacing;
      
      for (let d = offset; d < len; d += spacing) {
        const px = l.x1 + nx * d;
        const py = l.y1 + ny * d;
        const tx = -ny;
        const ty = nx;
        
        ctx.beginPath();
        ctx.moveTo(px + nx * size, py + ny * size);
        ctx.lineTo(px - nx * size + tx * size * 0.7, py - ny * size + ty * size * 0.7);
        ctx.lineTo(px - nx * size - tx * size * 0.7, py - ny * size - ty * size * 0.7);
        ctx.closePath();
        ctx.fillStyle = `rgba(200,235,255,${a})`;
        ctx.fill();
      }
    }
    
    ctx.restore();
  }
  
  private drawPulses(ctx: CanvasRenderingContext2D) {
    ctx.save();
    
    for (const p of this.pulses) {
      const t = Math.max(0, Math.min(1, p.age / p.duration));
      const r = p.startR + (p.endR - p.startR) * t;
      const alpha = (1 - t) * 0.9;
      
      ctx.beginPath();
      ctx.strokeStyle = `rgba(210,240,255,${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    ctx.restore();
  }
}
```

#### Изменения в main.ts
- Импортировать `VisualEffects`
- Удалить интерфейс `Pulse` и массив `pulses` (строка 202-203)
- Удалить переменные `dashPhase`, `arrowPhase`, `progressSpeed` (строки 204-206)
- Удалить функции `drawOverlay`, `drawPulses`, `drawProgressingStyle`, `drawDirectionHints` (строки 234-328)
- Создать экземпляр VisualEffects:
```typescript
const visualEffects = new VisualEffects();
```
- В game loop заменить:
  - Вызовы отрисовки эффектов на `visualEffects.render(ctx, result.overlay, result.progressRatio)`
  - Обновление `progressSpeed` на `visualEffects.update(paused ? 0 : dt, targetSpeed)`
  - Добавление пульсов на `visualEffects.addPulse(t.x, t.y)`

## Фаза 3: Расширения (опционально)

### 6. Улучшенный HUD

#### Модифицировать файл `src/hud.ts`
```typescript
import { AgentSystem } from './agents';
import { Field } from './field';
import { UI_CONFIG } from './ui-config';

export interface HUDSection {
  id: string;
  label?: string;
  getValue: () => string | number;
  visible?: boolean;
  order?: number;
}

export class HUD {
  private el: HTMLElement;
  private sections: Map<string, HUDSection> = new Map();
  private frameCounter = 0;
  private lastFpsUpdate = 0;
  private fps = 0;
  
  constructor(el: HTMLElement) {
    this.el = el;
    this.initDefaultSections();
  }
  
  private initDefaultSections() {
    this.addSection({
      id: 'fps',
      label: 'FPS',
      getValue: () => this.fps,
      order: 1
    });
  }
  
  addSection(section: HUDSection) {
    this.sections.set(section.id, section);
  }
  
  removeSection(id: string) {
    this.sections.delete(id);
  }
  
  updateSection(id: string, getValue: () => string | number) {
    const section = this.sections.get(id);
    if (section) {
      section.getValue = getValue;
    }
  }
  
  setVisibility(id: string, visible: boolean) {
    const section = this.sections.get(id);
    if (section) {
      section.visible = visible;
    }
  }
  
  update(now: number, field: Field, agents: AgentSystem, toolName: string) {
    // Обновление FPS
    this.frameCounter++;
    if (this.frameCounter >= UI_CONFIG.hud.fpsUpdateInterval) {
      const elapsed = now - this.lastFpsUpdate || 1;
      this.fps = Math.round((UI_CONFIG.hud.fpsUpdateInterval * 1000) / elapsed);
      this.frameCounter = 0;
      this.lastFpsUpdate = now;
    }
    
    // Обновление динамических секций
    this.updateSection('field', () => `${field.width}×${field.height}`);
    this.updateSection('agents', () => agents.agents.length);
    this.updateSection('tool', () => toolName);
    
    // Рендеринг
    this.render();
  }
  
  private render() {
    const visibleSections = Array.from(this.sections.values())
      .filter(s => s.visible !== false)
      .sort((a, b) => (a.order || 999) - (b.order || 999));
    
    const lines = visibleSections.map(s => {
      const value = s.getValue();
      return s.label ? `${s.label}: ${value}` : String(value);
    });
    
    this.el.innerText = lines.join('\n');
  }
}
```

#### Изменения в main.ts
- После создания HUD добавить дополнительные секции:
```typescript
hud.addSection({
  id: 'field',
  label: 'Поле',
  getValue: () => '',
  order: 2
});

hud.addSection({
  id: 'agents',
  label: 'Агенты',
  getValue: () => '',
  order: 3
});

hud.addSection({
  id: 'tool',
  label: 'Инструмент',
  getValue: () => '',
  order: 4
});
```

### 7. Динамический toolbar

#### Создать файл `src/toolbar-manager.ts`
```typescript
import { UI_CONFIG, ToolType } from './ui-config';

export interface ToolbarItem {
  id: string;
  type: 'button' | 'slider' | 'separator';
  element?: HTMLElement;
  order?: number;
}

export class ToolbarManager {
  private container: HTMLElement;
  private items: Map<string, ToolbarItem> = new Map();
  
  constructor(container: HTMLElement) {
    this.container = container;
  }
  
  addToolButton(tool: ToolType): HTMLButtonElement {
    const config = UI_CONFIG.tools[tool];
    const button = document.createElement('button');
    button.id = `tool-${tool}`;
    button.title = `${config.title} (${config.hotkey})`;
    button.textContent = config.icon;
    
    this.addItem({
      id: `tool-${tool}`,
      type: 'button',
      element: button
    });
    
    return button;
  }
  
  addButton(id: string, icon: string, title: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.id = id;
    button.title = title;
    button.textContent = icon;
    
    this.addItem({
      id,
      type: 'button',
      element: button
    });
    
    return button;
  }
  
  addSlider(id: string, label: string, min: number, max: number, step: number, value: number): HTMLInputElement {
    const wrapper = document.createElement('label');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '6px';
    wrapper.style.color = '#aab6c3';
    
    const span = document.createElement('span');
    span.textContent = label;
    
    const input = document.createElement('input');
    input.id = id;
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    
    wrapper.appendChild(span);
    wrapper.appendChild(input);
    
    this.addItem({
      id,
      type: 'slider',
      element: wrapper
    });
    
    return input;
  }
  
  addSeparator(): void {
    const separator = document.createElement('div');
    separator.style.height = '1px';
    separator.style.background = '#243544';
    separator.style.margin = '4px 0';
    
    this.addItem({
      id: `separator-${Date.now()}`,
      type: 'separator',
      element: separator
    });
  }
  
  private addItem(item: ToolbarItem) {
    this.items.set(item.id, item);
    if (item.element) {
      this.container.appendChild(item.element);
    }
  }
  
  removeItem(id: string) {
    const item = this.items.get(id);
    if (item?.element) {
      this.container.removeChild(item.element);
    }
    this.items.delete(id);
  }
  
  clear() {
    this.container.innerHTML = '';
    this.items.clear();
  }
  
  reorder() {
    const sortedItems = Array.from(this.items.values())
      .filter(item => item.element)
      .sort((a, b) => (a.order || 999) - (b.order || 999));
    
    // Удаляем все элементы
    this.container.innerHTML = '';
    
    // Добавляем в новом порядке
    for (const item of sortedItems) {
      if (item.element) {
        this.container.appendChild(item.element);
      }
    }
  }
}
```

#### Изменения в index.html
- Удалить содержимое `<div id="toolbar">` (оставить пустым)

#### Изменения в main.ts
- Импортировать `ToolbarManager`
- Создать toolbar динамически:
```typescript
const toolbarEl = document.getElementById('toolbar') as HTMLElement;
const toolbar = new ToolbarManager(toolbarEl);

// Добавляем инструменты
const toolButtons: Record<ToolType, HTMLButtonElement> = {
  attract: toolbar.addToolButton('attract'),
  repel: toolbar.addToolButton('repel'),
  wall: toolbar.addToolButton('wall'),
  erase: toolbar.addToolButton('erase')
};

// Добавляем управляющие кнопки
const pauseBtn = toolbar.addButton('btn-pause', '⏸️', 'Пауза (P)');
const resetBtn = toolbar.addButton('btn-reset', '🔄', 'Сброс сцены');
const reseedBtn = toolbar.addButton('btn-reseed', '🎲', 'Новые семена');

// Добавляем слайдер темпа
const tempoInput = toolbar.addSlider(
  'tempo',
  'Темп',
  UI_CONFIG.tempo.min,
  UI_CONFIG.tempo.max,
  UI_CONFIG.tempo.step,
  UI_CONFIG.tempo.default
);
```

## Интеграция изменений

### Порядок выполнения

1. **Создать новые файлы** в указанном порядке
2. **Обновить импорты** в main.ts
3. **Постепенно заменять** старый код новыми модулями
4. **Тестировать после каждого шага** для выявления проблем
5. **Удалить неиспользуемый код** после успешной интеграции

### Контрольные точки

После каждой фазы убедиться что:
- Приложение запускается без ошибок
- Все инструменты работают корректно
- Адаптивная верстка функционирует
- Производительность не ухудшилась
- Визуальный стиль сохранен

### Дополнительные улучшения (после основного рефакторинга)

1. **TypeScript строгость**
   - Добавить `"strict": true` в tsconfig.json
   - Исправить все type errors

2. **Документация**
   - Добавить JSDoc комментарии к публичным методам
   - Создать README с описанием архитектуры

3. **Оптимизация производительности**
   - Использовать requestIdleCallback для неприоритетных обновлений
   - Добавить throttling для частых событий

4. **Доступность**
   - Добавить ARIA атрибуты к кнопкам
   - Поддержка keyboard navigation

5. **Сохранение состояния**
   - Сохранять выбранный инструмент в localStorage
   - Восстанавливать темп при перезагрузке