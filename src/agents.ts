import type { Agent, SimParams } from './types';
import { clamp, indexOf, wrapAngle } from './utils';
import { Field } from './field';

export class AgentSystem {
  agents: Agent[] = [];
  field: Field;
  params: SimParams;

  constructor(field: Field, params: SimParams) {
    this.field = field;
    this.params = params;
  }

  computeAgentCountFromField(): number {
    const pixels = this.field.width * this.field.height;
    return Math.min(40000, Math.max(4000, Math.floor(0.2 * pixels)));
  }

  reseedAgents() {
    const count = this.computeAgentCountFromField();
    this.agents = [];
    let attempts = 0;
    while (this.agents.length < count && attempts < count * 10) {
      attempts++;
      const x = Math.random() * this.field.width;
      const y = Math.random() * this.field.height;
      if (!this.field.isWall(x, y)) {
        this.agents.push({ x, y, angle: Math.random() * Math.PI * 2 });
      }
    }
  }

  private samplePerceivedAverage(xc: number, yc: number, radius: number): number {
    const r = Math.max(0, Math.floor(radius));
    let sum = 0;
    let count = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = Math.floor(xc) + dx;
        const y = Math.floor(yc) + dy;
        if (x < 0 || y < 0 || x >= this.field.width || y >= this.field.height) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r * r) {
          const idx = indexOf(x, y, this.field.width);
          // Iteration 01: agents perceive field with a subtle memory bias
          const v = this.field.values[idx];
          const m = this.field.memory[idx];
          sum += v + m * this.params.memoryInfluence;
          count++;
        }
      }
    }
    return count > 0 ? sum / count : 0;
  }

  update(dt: number) {
    const p = this.params;

    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];

      // Sense
      const cx = a.x + Math.cos(a.angle) * p.sensorOffset;
      const cy = a.y + Math.sin(a.angle) * p.sensorOffset;
      const lx = a.x + Math.cos(a.angle - p.sensorAngle) * p.sensorOffset;
      const ly = a.y + Math.sin(a.angle - p.sensorAngle) * p.sensorOffset;
      const rx = a.x + Math.cos(a.angle + p.sensorAngle) * p.sensorOffset;
      const ry = a.y + Math.sin(a.angle + p.sensorAngle) * p.sensorOffset;

      const c = this.samplePerceivedAverage(cx, cy, p.sensorRadius);
      const l = this.samplePerceivedAverage(lx, ly, p.sensorRadius);
      const r = this.samplePerceivedAverage(rx, ry, p.sensorRadius);

      // Turn toward max
      let targetAngle = a.angle;
      if (l > c && l > r) targetAngle = a.angle - 1;
      else if (r > c && r > l) targetAngle = a.angle + 1;
      else targetAngle = a.angle;

      // Apply turn speed toward target with noise
      const angleDiff = targetAngle - a.angle;
      const maxTurn = p.turnSpeed * dt;
      const turn = clamp(angleDiff, -maxTurn, maxTurn) + (Math.random() * 2 - 1) * p.turnNoise * dt;
      a.angle = wrapAngle(a.angle + turn);

      // Move forward with latent flow influence (Iteration 02)
      const forwardVx = Math.cos(a.angle) * p.speed;
      const forwardVy = Math.sin(a.angle) * p.speed;
      // sample local flow vector (nearest pixel)
      const xi = Math.max(0, Math.min(this.field.width - 1, Math.floor(a.x)));
      const yi = Math.max(0, Math.min(this.field.height - 1, Math.floor(a.y)));
      const idx = indexOf(xi, yi, this.field.width);
      const flowVx = this.field.flowX[idx] * p.flowInfluence;
      const flowVy = this.field.flowY[idx] * p.flowInfluence;
      const vx = forwardVx + flowVx;
      const vy = forwardVy + flowVy;
      const nx = a.x + vx * dt;
      const ny = a.y + vy * dt;

      // Handle wall and boundary collisions with reflection
      if (nx < 0 || ny < 0 || nx >= this.field.width || ny >= this.field.height || this.field.isWall(nx, ny)) {
        // reflect: invert angle
        a.angle = wrapAngle(a.angle + Math.PI + (Math.random() - 0.5) * 0.1);
      } else {
        a.x = nx;
        a.y = ny;
      }

      // Deposit main field and faint memory echo
      this.field.deposit(a.x, a.y, p.depositPerStep);
      this.field.depositMemory(a.x, a.y, p.depositPerStep * this.params.memoryDepositFactor * dt);

      // Iteration 02: imprint latent flow in the direction of actual motion
      const moveMag = Math.hypot(vx, vy) || 1;
      const dirX = vx / moveMag;
      const dirY = vy / moveMag;
      this.field.depositFlow(a.x, a.y, dirX, dirY, p.flowDepositPerSecond * dt, p.flowMaxMagnitude);
    }
  }
}
