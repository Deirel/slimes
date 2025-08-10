import { UI_CONFIG, ToolType } from './ui-config';
import type { UIElementsV2 } from './ui-builder';
import type { ControlSpec, PopupButtonSpec, SliderSpec, ToggleSpec } from './types';

export interface UIState {
  tool: ToolType;
  paused: boolean;
  tempo: number;
  openPath: string[]; // stack of popup ids from bottom to top
}

export class UIController {
  private state: UIState = {
    tool: 'attract',
    paused: false,
    tempo: 1,
    openPath: []
  };
  
  private listeners = {
    toolChange: [] as ((tool: ToolType) => void)[],
    pauseChange: [] as ((paused: boolean) => void)[],
    tempoChange: [] as ((tempo: number) => void)[],
    popupAction: [] as ((action: string, popupId: string, itemId?: string) => void)[],
    openPathChange: [] as ((openPath: string[]) => void)[],
  };
  
  private elements: UIElementsV2;

  constructor(uiElements: UIElementsV2) {
    this.elements = uiElements;
    this.attachListeners();
  }
  
  setElements(uiElements: UIElementsV2) {
    this.elements = uiElements;
    this.attachListeners();
    this.updateToolButtons();
    this.updatePauseButton();
  }
  
  private attachListeners() {
    // keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === '1') this.setTool('attract');
      else if (k === '2') this.setTool('repel');
      else if (k === '3') this.setTool('wall');
      else if (k === '4') this.setTool('erase');
      else if (k === 'p') this.togglePause();
    });

    // generic bindings based on element classes
    for (const [id, el] of Object.entries(this.elements.controlRefs)) {
      if (el.classList.contains('ui-popup')) {
        el.addEventListener('click', () => this.togglePopup(id));
        continue;
      }

      if (id === 'pause' && el.classList.contains('ui-toggle')) {
        el.addEventListener('click', () => this.togglePause());
        continue;
      }

      if ((['attract','repel','wall','erase'] as string[]).includes(id) && el.classList.contains('ui-toggle')) {
        el.addEventListener('click', () => this.setTool(id as ToolType));
        continue;
      }

      if (el.classList.contains('ui-toggle')) {
        el.addEventListener('click', () => {
          el.classList.toggle('active');
          const ctx = this.resolveContextForControl(id);
          this.emit('popupAction', 'toggle', ctx, id);
        });
        continue;
      }

      if (el.classList.contains('ui-btn')) {
        el.addEventListener('click', () => {
          const ctx = this.resolveContextForControl(id);
          this.emit('popupAction', 'trigger', ctx, id);
        });
        continue;
      }

      if (el.classList.contains('ui-slider')) {
        const input = el.querySelector('input') as HTMLInputElement | null;
        if (input) {
          input.addEventListener('input', () => {
            const value = parseFloat(input.value);
            if (id === 'tempo') this.setTempo(value);
            const ctx = this.resolveContextForControl(id);
            this.emit('popupAction', 'change', ctx, id);
          });
        }
        continue;
      }
    }
  }

  private resolveContextForControl(id: string): string {
    // root layer
    if (UI_CONFIG.toolbar.some(c => c.id === id)) return 'root';
    // dive by current openPath
    let toolbar = UI_CONFIG.toolbar;
    for (const pid of this.state.openPath) {
      const pop = toolbar.find(c => c.type === 'popup' && c.id === pid) as PopupButtonSpec | undefined;
      if (!pop) break;
      toolbar = pop.toolbar;
      if (toolbar.some(c => c.id === id)) return pid;
    }
    return 'root';
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
    const idx = this.state.openPath.indexOf(popupId);
    if (idx >= 0) {
      this.state.openPath = this.state.openPath.slice(0, idx);
    } else {
      this.state.openPath = [...this.state.openPath, popupId];
    }
    this.emit('openPathChange', this.state.openPath.slice());
  }
  
  // UI rendering is delegated to UIBuilder from main.ts for simplicity
  private updateToolButtons() {
    const toolIds: ToolType[] = ['attract', 'repel', 'wall', 'erase'];
    for (const id of toolIds) {
      const btn = this.elements.controlRefs[id] as HTMLButtonElement | undefined;
      if (!btn) continue;
      btn.classList.toggle('active', id === this.state.tool);
    }
  }

  private updatePauseButton() {
    const btn = this.elements.controlRefs['pause'] as HTMLButtonElement | undefined;
    if (!btn) return;
    btn.classList.toggle('active', this.state.paused);
    btn.textContent = this.state.paused ? '▶️' : '⏸️';
  }
  
  // Event emitter pattern
  on(event: 'toolChange', handler: (tool: ToolType) => void): void;
  on(event: 'pauseChange', handler: (paused: boolean) => void): void;
  on(event: 'tempoChange', handler: (tempo: number) => void): void;
  on(event: 'popupAction', handler: (action: string, popupId: string, itemId?: string) => void): void;
  on(event: 'openPathChange', handler: (openPath: string[]) => void): void;
  on(event: string, handler: any) {
    if (event in this.listeners) {
      (this.listeners as any)[event].push(handler);
    }
  }
  
  private emit(event: 'toolChange', data: ToolType): void;
  private emit(event: 'pauseChange', data: boolean): void;
  private emit(event: 'tempoChange', data: number): void;
  private emit(event: 'popupAction', action: string, popupId: string, itemId?: string): void;
  private emit(event: 'openPathChange', openPath: string[]): void;
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
  
  // no direct DOM bindings for reset/reseed; use popupAction('root', ...)
}