import { UI_CONFIG, ToolType } from './ui-config';
import type { UIElements } from './ui-builder';

export interface UIState {
  tool: ToolType;
  paused: boolean;
  tempo: number;
  openPopup: string | null;
}

export class UIController {
  private state: UIState = {
    tool: 'attract',
    paused: false,
    tempo: UI_CONFIG.controls.tempo.default,
    openPopup: null
  };
  
  private listeners = {
    toolChange: [] as ((tool: ToolType) => void)[],
    pauseChange: [] as ((paused: boolean) => void)[],
    tempoChange: [] as ((tempo: number) => void)[],
    popupAction: [] as ((action: string, popupId: string, itemId?: string) => void)[]
  };
  
  private elements: {
    toolButtons: Record<ToolType, HTMLButtonElement>;
    pauseBtn: HTMLButtonElement;
    resetBtn: HTMLButtonElement;
    reseedBtn: HTMLButtonElement;
    tempoInput: HTMLInputElement;
    popupButtons: Record<string, HTMLButtonElement>;
    popupPanels: Record<string, HTMLElement>;
    popupActionButtons: Record<string, HTMLButtonElement>;
    popupControls: Record<string, HTMLInputElement>;
  };

  constructor(uiElements: UIElements) {
    // Адаптация для работы с новой структурой
    this.elements = {
      toolButtons: uiElements.toolButtons,
      pauseBtn: uiElements.actionButtons.pause,
      resetBtn: uiElements.actionButtons.reset,
      reseedBtn: uiElements.actionButtons.reseed,
      tempoInput: uiElements.controls.tempo,
      popupButtons: uiElements.popupButtons,
      popupPanels: uiElements.popupPanels,
      popupActionButtons: {},
      popupControls: {}
    };
    
    // Extract popup action buttons and controls
    for (const [key, btn] of Object.entries(uiElements.actionButtons)) {
      if (key.includes('.')) {
        this.elements.popupActionButtons[key] = btn;
      }
    }
    
    // Extract popup controls (agentCount goes to popup controls)
    for (const [key, control] of Object.entries(uiElements.controls)) {
      if (key === 'agentCount') {
        this.elements.popupControls[key] = control;
      }
    }
    
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
    
    // Popup triggers
    for (const [popupId, btn] of Object.entries(this.elements.popupButtons)) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePopup(popupId);
      });
    }
    
    // Popup action buttons
    for (const [key, btn] of Object.entries(this.elements.popupActionButtons)) {
      btn.addEventListener('click', () => {
        const [popupId, itemId] = key.split('.');
        const config = UI_CONFIG.popups?.[popupId as keyof typeof UI_CONFIG.popups];
        const buttonConfig = config?.items.buttons?.[itemId];
        if (buttonConfig) {
          this.emit('popupAction', buttonConfig.action || 'trigger', popupId, itemId);
          if (buttonConfig.action === 'toggle') {
            btn.classList.toggle('active');
          }
        }
      });
    }
    
    // Popup controls
    for (const [key, control] of Object.entries(this.elements.popupControls)) {
      control.addEventListener('input', () => {
        this.emit('popupAction', 'change', 'control', key);
      });
    }
    
    // Click outside to close popups
    document.addEventListener('click', (e) => {
      if (!e.target) return;
      const target = e.target as HTMLElement;
      
      // Check if clicked inside any popup panel or trigger
      const clickedInsidePopup = target.closest('.popup-container');
      if (!clickedInsidePopup && this.state.openPopup) {
        this.closeAllPopups();
      }
    });
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
  
  togglePopup(popupId: string) {
    if (this.state.openPopup === popupId) {
      this.closeAllPopups();
    } else {
      this.closeAllPopups();
      this.state.openPopup = popupId;
      this.updatePopupUI();
    }
  }
  
  closeAllPopups() {
    this.state.openPopup = null;
    this.updatePopupUI();
  }
  
  private updateToolButtons() {
    for (const [tool, btn] of Object.entries(this.elements.toolButtons)) {
      btn.classList.toggle('active', tool === this.state.tool);
    }
  }
  
  private updatePauseButton() {
    this.elements.pauseBtn.textContent = this.state.paused ? '▶️' : '⏸️';
  }
  
  private updatePopupUI() {
    // Update popup triggers
    for (const [popupId, btn] of Object.entries(this.elements.popupButtons)) {
      btn.classList.toggle('active', this.state.openPopup === popupId);
    }
    
    // Update popup panels visibility
    for (const [popupId, panel] of Object.entries(this.elements.popupPanels)) {
      panel.classList.toggle('hidden', this.state.openPopup !== popupId);
    }
  }
  
  private updateUI() {
    this.updateToolButtons();
    this.updatePauseButton();
    this.updatePopupUI();
    this.elements.tempoInput.value = String(this.state.tempo);
  }
  
  // Event emitter pattern
  on(event: 'toolChange', handler: (tool: ToolType) => void): void;
  on(event: 'pauseChange', handler: (paused: boolean) => void): void;
  on(event: 'tempoChange', handler: (tempo: number) => void): void;
  on(event: 'popupAction', handler: (action: string, popupId: string, itemId?: string) => void): void;
  on(event: string, handler: any) {
    if (event in this.listeners) {
      (this.listeners as any)[event].push(handler);
    }
  }
  
  private emit(event: 'toolChange', data: ToolType): void;
  private emit(event: 'pauseChange', data: boolean): void;
  private emit(event: 'tempoChange', data: number): void;
  private emit(event: 'popupAction', action: string, popupId: string, itemId?: string): void;
  private emit(event: string, ...args: any[]) {
    if (event in this.listeners) {
      for (const handler of (this.listeners as any)[event]) {
        handler(...args);
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