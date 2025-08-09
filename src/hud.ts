import { AgentSystem } from './agents';
import { Field } from './field';

export class HUD {
  el: HTMLElement;
  frameCounter = 0;
  lastFpsUpdate = 0;
  fps = 0;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  update(now: number, field: Field, agents: AgentSystem, toolName: string) {
    this.frameCounter++;
    // Update FPS every 10 frames as per GDD
    if (this.frameCounter >= 10) {
      const elapsed = now - this.lastFpsUpdate || 1;
      this.fps = Math.round((10 * 1000) / elapsed);
      this.frameCounter = 0;
      this.lastFpsUpdate = now;
    }
    this.el.innerText = `FPS: ${this.fps}\nПоле: ${field.width}×${field.height}\nАгенты: ${agents.agents.length}\nИнструмент: ${toolName}`;
  }
}
