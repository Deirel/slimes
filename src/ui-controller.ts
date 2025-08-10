import { UI_CONFIG, ToolType } from './ui-config';
import type { UIElements } from './ui-builder';

export interface UIState {
  tool: ToolType;
  paused: boolean;
  tempo: number;
}

export class UIController {
  private state: UIState = {
    tool: 'attract',
    paused: false,
    tempo: UI_CONFIG.controls.tempo.default
  };
  
  private listeners = {
    toolChange: [] as ((tool: ToolType) => void)[],
    pauseChange: [] as ((paused: boolean) => void)[],
    tempoChange: [] as ((tempo: number) => void)[]
  };
  
  private elements: {
    toolButtons: Record<ToolType, HTMLButtonElement>;
    pauseBtn: HTMLButtonElement;
    resetBtn: HTMLButtonElement;
    reseedBtn: HTMLButtonElement;
    tempoInput: HTMLInputElement;
  };

  constructor(uiElements: UIElements) {
    // Адаптация для работы с новой структурой
    this.elements = {
      toolButtons: uiElements.toolButtons,
      pauseBtn: uiElements.actionButtons.pause,
      resetBtn: uiElements.actionButtons.reset,
      reseedBtn: uiElements.actionButtons.reseed,
      tempoInput: uiElements.controls.tempo
    };
    
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