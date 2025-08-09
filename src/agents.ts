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

      // Move forward
      const nx = a.x + Math.cos(a.angle) * p.speed * dt;
      const ny = a.y + Math.sin(a.angle) * p.speed * dt;

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
    }
  }
}
