import { AgentSystem } from './agents';
import { Field } from './field';
import { APP_CONFIG } from './app-config';

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
    // Update FPS every N frames as configured
    if (this.frameCounter >= APP_CONFIG.hud.fpsUpdateInterval) {
      const elapsed = now - this.lastFpsUpdate || 1;
      this.fps = Math.round((APP_CONFIG.hud.fpsUpdateInterval * 1000) / elapsed);
      this.frameCounter = 0;
      this.lastFpsUpdate = now;
    }
    this.el.innerText = `FPS: ${this.fps}\nПоле: ${field.width}×${field.height}\nАгенты: ${agents.agents.length}\nИнструмент: ${toolName}`;
  }
}
