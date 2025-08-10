import { APP_CONFIG } from './app-config';
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
      duration: APP_CONFIG.animation.pulsesDuration,
      startR: APP_CONFIG.animation.pulseStartRadius,
      endR: APP_CONFIG.animation.pulseEndRadius
    });
  }
  
  update(dt: number, targetProgressSpeed: number) {
    // Обновление фаз анимации
    if (dt > 0 && this.progressSpeed > 0) {
      this.dashPhase += dt * APP_CONFIG.animation.dashSpeed * this.progressSpeed;
      this.arrowPhase += dt * APP_CONFIG.animation.arrowSpeed * this.progressSpeed;
    }
    
    // Сглаживание скорости прогресса
    this.progressSpeed += (targetProgressSpeed - this.progressSpeed) * APP_CONFIG.animation.progressSmoothingFactor;
    
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
      const baseAlpha = APP_CONFIG.animation.goalOverlayBaseAlpha;
      const progressAlpha = APP_CONFIG.animation.goalOverlayProgressAlpha;
      const a = Math.max(0, Math.min(1, c.alpha * (baseAlpha + progressAlpha * progressRatio)));
      ctx.strokeStyle = `rgba(180,220,255,${a})`;
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Отрисовка линий
    for (const l of overlay.lines) {
      ctx.beginPath();
      const baseAlpha = APP_CONFIG.animation.goalOverlayBaseAlpha;
      const progressAlpha = APP_CONFIG.animation.goalOverlayProgressAlpha;
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
      const spacing = APP_CONFIG.animation.chevronSpacing;
      const size = APP_CONFIG.animation.chevronSize;
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