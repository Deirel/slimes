import type { UIConfigV2, ControlSpec, ButtonSpec, ToggleSpec, SliderSpec, PopupButtonSpec } from './types';

export interface UIElementsV2 {
  container: HTMLElement;
  controlRefs: Record<string, HTMLElement>;
}

export class UIBuilder {
  private container: HTMLElement;

  constructor(containerId: string = 'ui-rows') {
    this.container = document.getElementById(containerId) || this.createContainer(containerId);
  }

  private createContainer(id: string): HTMLElement {
    const el = document.createElement('div');
    el.id = id;
    document.getElementById('app')?.appendChild(el);
    return el;
  }

  render(config: UIConfigV2, openPath: string[]): UIElementsV2 {
    this.container.innerHTML = '';
    const controlRefs: Record<string, HTMLElement> = {};

    const unit = config.layout.rowHeight - 2 * config.layout.gap;
    const gap = config.layout.gap;
    const rows: ControlSpec[][] = [];
    rows.push(config.toolbar);

    // build stacked rows according to openPath
    let currentToolbar: ControlSpec[] | undefined = config.toolbar;
    for (const popupId of openPath) {
      const popup = currentToolbar?.find(c => c.type === 'popup' && c.id === popupId) as PopupButtonSpec | undefined;
      if (!popup) break;
      rows.push(popup.toolbar);
      currentToolbar = popup.toolbar;
    }

    // render bottom-up (container uses column-reverse in CSS)
    for (const rowControls of rows) {
      const rowEl = document.createElement('div');
      rowEl.className = 'ui-row';
      rowEl.style.height = `${config.layout.rowHeight}px`;
      rowEl.style.padding = `${config.layout.gap}px`;
      rowEl.style.gap = `${config.layout.gap}px`;
      rowControls.forEach(spec => {
        const el = this.createControl(spec, unit, gap);
        rowEl.appendChild(el);
        controlRefs[spec.id] = el;
      });
      this.container.appendChild(rowEl);
    }

    return { container: this.container, controlRefs };
  }

  private createControl(spec: ControlSpec, unit: number, gap: number): HTMLElement {
    switch (spec.type) {
      case 'button': return this.createButton(spec as ButtonSpec, unit, gap);
      case 'toggle': return this.createToggle(spec as ToggleSpec, unit, gap);
      case 'slider': return this.createSlider(spec as SliderSpec, unit, gap);
      case 'popup': return this.createPopupButton(spec as PopupButtonSpec, unit, gap);
    }
  }

  private applySize(el: HTMLElement, units: number | undefined, unit: number, gap: number) {
    const wUnits = Math.max(1, units ?? 1);
    const widthPx = wUnits * unit + (wUnits - 1) * gap;
    el.style.height = `${unit}px`;
    el.style.minHeight = `${unit}px`;
    el.style.minWidth = `${widthPx}px`;
    el.style.width = `${widthPx}px`;
  }

  private createButton(spec: ButtonSpec, unit: number, gap: number): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'ui-btn';
    btn.id = `btn-${spec.id}`;
    btn.title = spec.title;
    btn.textContent = spec.icon;
    this.applySize(btn, spec.units, unit, gap);
    return btn;
  }

  private createToggle(spec: ToggleSpec, unit: number, gap: number): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'ui-btn ui-toggle';
    btn.id = `tgl-${spec.id}`;
    btn.title = spec.title;
    btn.textContent = spec.icon;
    if (spec.initial) btn.classList.add('active');
    this.applySize(btn, spec.units, unit, gap);
    return btn;
  }

  private createSlider(spec: SliderSpec, unit: number, gap: number): HTMLElement {
    const wrapper = document.createElement('label');
    wrapper.className = 'ui-slider';
    const name = document.createElement('span');
    name.textContent = spec.title;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.value = String(spec.defaultValue);
    input.id = `sld-${spec.id}`;
    wrapper.appendChild(name);
    wrapper.appendChild(input);
    this.applySize(wrapper, spec.units, unit, gap);
    return wrapper;
  }

  private createPopupButton(spec: PopupButtonSpec, unit: number, gap: number): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'ui-btn ui-popup';
    btn.id = `pop-${spec.id}`;
    btn.title = spec.title;
    btn.textContent = spec.icon;
    this.applySize(btn, spec.units, unit, gap);
    return btn;
  }
}