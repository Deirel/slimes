import { UI_CONFIG, ToolType } from './ui-config';

interface ButtonOptions {
  id: string;
  icon: string;
  title: string;
  className?: string;
}

interface SliderConfig {
  type: 'slider';
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  id: string;
}

export interface UIElements {
  toolButtons: Record<ToolType, HTMLButtonElement>;
  actionButtons: Record<string, HTMLButtonElement>;
  controls: Record<string, HTMLInputElement>;
}

export class UIBuilder {
  private toolbar: HTMLElement;
  
  constructor(toolbarId: string = 'toolbar') {
    this.toolbar = document.getElementById(toolbarId) || this.createToolbar();
  }
  
  private createToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.id = 'toolbar';
    document.getElementById('app')?.appendChild(toolbar);
    return toolbar;
  }
  
  buildFromConfig(config: typeof UI_CONFIG): UIElements {
    this.toolbar.innerHTML = '';
    const elements: UIElements = {
      toolButtons: {} as Record<ToolType, HTMLButtonElement>,
      actionButtons: {},
      controls: {}
    };
    
    // Создание кнопок инструментов
    for (const [key, tool] of Object.entries(config.tools)) {
      const btn = this.createButton({
        id: `tool-${key}`,
        icon: tool.icon,
        title: `${tool.title} (${tool.hotkey})`,
        className: 'tool-button'
      });
      this.toolbar.appendChild(btn);
      elements.toolButtons[key as ToolType] = btn;
    }
    
    // Создание action кнопок
    for (const [key, button] of Object.entries(config.buttons)) {
      const btn = this.createButton({
        id: button.id || `btn-${key}`,
        icon: button.icon,
        title: button.title + (button.hotkey ? ` (${button.hotkey.toUpperCase()})` : ''),
        className: 'action-button'
      });
      this.toolbar.appendChild(btn);
      elements.actionButtons[key] = btn;
    }
    
    // Создание контролов
    for (const [key, control] of Object.entries(config.controls)) {
      if (control.type === 'slider') {
        const element = this.createSlider(control);
        this.toolbar.appendChild(element);
        elements.controls[key] = element.querySelector('input') as HTMLInputElement;
      }
    }
    
    return elements;
  }
  
  private createButton(options: ButtonOptions): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.id = options.id;
    btn.className = options.className || '';
    btn.title = options.title;
    btn.textContent = options.icon;
    return btn;
  }
  
  private createSlider(config: SliderConfig): HTMLElement {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:6px;color:#aab6c3;';
    
    const span = document.createElement('span');
    span.textContent = config.label;
    
    const input = document.createElement('input');
    input.type = 'range';
    input.id = config.id;
    input.min = String(config.min);
    input.max = String(config.max);
    input.step = String(config.step);
    input.value = String(config.default);
    
    label.appendChild(span);
    label.appendChild(input);
    return label;
  }
}