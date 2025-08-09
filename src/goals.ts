export type MicroGoalType = 'connect_nodes' | 'silence_area';

export interface Vec2 { x: number; y: number; }

export interface MicroGoal {
  id: number;
  type: MicroGoalType;
  createdAt: number; // seconds
  expiresAt: number; // seconds
  // Common overlay alpha 0..1 for pulsing hints
  hintPhase: number; // seconds, for animation
  // Progress: accumulate seconds while condition holds
  progressSec: number;
  requiredSec: number;
  // Payload per type
  a?: Vec2;
  b?: Vec2;
  center?: Vec2;
  radius?: number;
}

export interface OverlayCircle { x: number; y: number; r: number; alpha: number; }
export interface OverlayLine { x1: number; y1: number; x2: number; y2: number; alpha: number; }
export interface RenderOverlay { circles: OverlayCircle[]; lines: OverlayLine[]; }
export interface UpdateResult {
  overlay: RenderOverlay;
  completed: boolean;
  expired: boolean;
  successTargets?: Vec2[]; // present only on the frame of completion
  progressRatio: number;   // 0..1, for subtle visual emphasis
}

import { Field } from './field';

function randInt(max: number): number { return Math.floor(Math.random() * max); }

function sampleTopNodes(field: Field, howMany: number): Vec2[] {
  // Pick candidate nodes by memory or absolute field value
  const w = field.width; const h = field.height;
  const scores: { s: number; x: number; y: number; }[] = [];
  const strideX = Math.max(1, Math.floor(w / 32));
  const strideY = Math.max(1, Math.floor(h / 18));
  for (let y = 0; y < h; y += strideY) {
    for (let x = 0; x < w; x += strideX) {
      const i = y * w + x;
      const v = Math.abs(field.values[i]);
      const m = Math.abs(field.memory[i]);
      const fx = field.flowX[i]; const fy = field.flowY[i];
      const flowMag = Math.hypot(fx, fy);
      const s = v * 0.6 + m * 0.9 + flowMag * 0.5;
      if (s < 0.02) continue;
      scores.push({ s, x, y });
    }
  }
  scores.sort((a, b) => b.s - a.s);
  const picked: Vec2[] = [];
  const taken: boolean[] = new Array(w * h);
  for (let i = 0; i < scores.length && picked.length < howMany; i++) {
    const { x, y } = scores[i];
    // Simple non-maximum suppression radius
    let ok = true;
    for (const p of picked) {
      if (Math.hypot(p.x - x, p.y - y) < Math.min(w, h) * 0.1) { ok = false; break; }
    }
    if (ok) picked.push({ x, y });
  }
  // If not enough, add random points
  while (picked.length < howMany) {
    picked.push({ x: randInt(w), y: randInt(h) });
  }
  return picked;
}

function lineSamples(a: Vec2, b: Vec2, step: number): Vec2[] {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const n = Math.max(2, Math.floor(len / step));
  const pts: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: a.x + dx * t, y: a.y + dy * t });
  }
  return pts;
}

export class GoalPlanner {
  private current?: MicroGoal;
  private nextId = 1;
  // Tunables
  private minLifetime = 35; // seconds
  private maxLifetime = 90; // seconds

  pickNew(nowSec: number, field: Field): MicroGoal {
    const types: MicroGoalType[] = ['connect_nodes', 'silence_area'];
    const type = types[randInt(types.length)];
    const lifetime = this.minLifetime + Math.random() * (this.maxLifetime - this.minLifetime);
    const g: MicroGoal = {
      id: this.nextId++, type,
      createdAt: nowSec, expiresAt: nowSec + lifetime,
      hintPhase: Math.random() * 1000, progressSec: 0,
      requiredSec: type === 'connect_nodes' ? 18 : 14,
    };

    if (type === 'connect_nodes') {
      const [p1, p2] = sampleTopNodes(field, 2);
      g.a = p1; g.b = p2;
    } else {
      const [c] = sampleTopNodes(field, 1);
      g.center = c; g.radius = Math.max(12, Math.min(field.width, field.height) * 0.12);
    }

    this.current = g;
    return g;
  }

  private checkConnectProgress(field: Field, g: MicroGoal, dt: number): boolean {
    const a = g.a!; const b = g.b!;
    const pts = lineSamples(a, b, 5);
    let sumProj = 0; let count = 0;
    for (const p of pts) {
      const xi = Math.max(0, Math.min(field.width - 1, Math.floor(p.x)));
      const yi = Math.max(0, Math.min(field.height - 1, Math.floor(p.y)));
      const i = yi * field.width + xi;
      const fx = field.flowX[i]; const fy = field.flowY[i];
      const dirx = (b.x - a.x); const diry = (b.y - a.y);
      const dirLen = Math.hypot(dirx, diry) || 1;
      const nx = dirx / dirLen; const ny = diry / dirLen;
      const proj = fx * nx + fy * ny; // alignment with desired corridor
      sumProj += Math.max(0, proj);
      count++;
    }
    const avg = count ? sumProj / count : 0;
    const ok = avg > 0.12; // requires latent flow aligned with corridor
    if (ok) g.progressSec += dt; else g.progressSec = Math.max(0, g.progressSec - dt * 0.5);
    return g.progressSec >= g.requiredSec;
  }

  private checkSilenceProgress(field: Field, g: MicroGoal, dt: number): boolean {
    const c = g.center!; const r = g.radius!;
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor(c.x - r));
    const x1 = Math.min(field.width - 1, Math.ceil(c.x + r));
    const y0 = Math.max(0, Math.floor(c.y - r));
    const y1 = Math.min(field.height - 1, Math.ceil(c.y + r));

    let sumAbs = 0; let count = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - c.x; const dy = y - c.y;
        if (dx * dx + dy * dy <= r2) {
          const i = y * field.width + x;
          sumAbs += Math.abs(field.values[i]);
          count++;
        }
      }
    }
    const avgAbs = count ? sumAbs / count : 1;
    const ok = avgAbs < 0.05; // quiet area
    if (ok) g.progressSec += dt; else g.progressSec = Math.max(0, g.progressSec - dt * 0.5);
    return g.progressSec >= g.requiredSec;
  }

  update(nowSec: number, dt: number, field: Field): UpdateResult {
    let expiredEvent = false;
    if (!this.current || nowSec > this.current.expiresAt) {
      expiredEvent = !!this.current;
      this.pickNew(nowSec, field);
    }
    const g = this.current!;

    // Build overlay hints (soft pulse)
    g.hintPhase += dt;
    const pulse = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(g.hintPhase * 1.8));

    const overlay: RenderOverlay = { circles: [], lines: [] };
    if (g.type === 'connect_nodes' && g.a && g.b) {
      overlay.circles.push({ x: g.a.x, y: g.a.y, r: 8, alpha: pulse });
      overlay.circles.push({ x: g.b.x, y: g.b.y, r: 8, alpha: pulse });
      overlay.lines.push({ x1: g.a.x, y1: g.a.y, x2: g.b.x, y2: g.b.y, alpha: pulse * 0.85 });
    } else if (g.type === 'silence_area' && g.center && g.radius) {
      overlay.circles.push({ x: g.center.x, y: g.center.y, r: g.radius, alpha: pulse * 0.9 });
    }

    // Check completion
    let done = false;
    if (g.type === 'connect_nodes') done = this.checkConnectProgress(field, g, dt);
    else done = this.checkSilenceProgress(field, g, dt);

    let successTargets: Vec2[] | undefined;
    if (done) {
      if (g.type === 'connect_nodes' && g.a && g.b) successTargets = [g.a, g.b];
      else if (g.type === 'silence_area' && g.center) successTargets = [g.center];
      // Start a new goal next frame
      this.current = undefined;
    }
    const progressRatio = Math.max(0, Math.min(1, g.progressSec / g.requiredSec));
    return { overlay, completed: done, expired: expiredEvent, successTargets, progressRatio };
  }
}
