import { clamp, indexOf } from './utils';

export class Field {
  width: number;
  height: number;
  values: Float32Array; // scalar field
  walls: Uint8Array; // 1 if wall
  // Iteration 01: hidden memory layer storing faint echo of recent shapes
  memory: Float32Array;
  // Iteration 02: latent flow vector field accumulating common directions
  flowX: Float32Array;
  flowY: Float32Array;
  // Iteration 04: reward maps
  // rewardEvap: 0..1 reduces local evaporation by up to configured fraction
  rewardEvap: Float32Array;
  // calm: 0..1 reduces local agent turn noise by up to configured fraction
  calm: Float32Array;

  // working buffers for diffusion
  private tmp: Float32Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.values = new Float32Array(width * height);
    this.walls = new Uint8Array(width * height);
    this.memory = new Float32Array(width * height);
    this.flowX = new Float32Array(width * height);
    this.flowY = new Float32Array(width * height);
    this.rewardEvap = new Float32Array(width * height);
    this.calm = new Float32Array(width * height);
    this.tmp = new Float32Array(width * height);
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.values = new Float32Array(width * height);
    this.walls = new Uint8Array(width * height);
    this.memory = new Float32Array(width * height);
    this.flowX = new Float32Array(width * height);
    this.flowY = new Float32Array(width * height);
    this.rewardEvap = new Float32Array(width * height);
    this.calm = new Float32Array(width * height);
    this.tmp = new Float32Array(width * height);
  }

  clearValues() {
    this.values.fill(0);
    this.memory.fill(0);
    this.flowX.fill(0);
    this.flowY.fill(0);
    this.rewardEvap.fill(0);
    this.calm.fill(0);
  }

  clearWalls() {
    this.walls.fill(0);
  }

  addCircle(xc: number, yc: number, radius: number, amount: number) {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(xc - radius));
    const x1 = Math.min(this.width - 1, Math.ceil(xc + radius));
    const y0 = Math.max(0, Math.floor(yc - radius));
    const y1 = Math.min(this.height - 1, Math.ceil(yc + radius));
    for (let y = y0; y <= y1; y++) {
      const dy = y - yc;
      for (let x = x0; x <= x1; x++) {
        const dx = x - xc;
        if (dx * dx + dy * dy <= r2) {
          const idx = indexOf(x, y, this.width);
          this.values[idx] = clamp(this.values[idx] + amount, -2.5, 2.5);
        }
      }
    }
  }

  // Iteration 01 tweak: write directly into memory as a brush (used by repel)
  addMemoryCircle(xc: number, yc: number, radius: number, amount: number) {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(xc - radius));
    const x1 = Math.min(this.width - 1, Math.ceil(xc + radius));
    const y0 = Math.max(0, Math.floor(yc - radius));
    const y1 = Math.min(this.height - 1, Math.ceil(yc + radius));
    for (let y = y0; y <= y1; y++) {
      const dy = y - yc;
      for (let x = x0; x <= x1; x++) {
        const dx = x - xc;
        if (dx * dx + dy * dy <= r2) {
          const idx = indexOf(x, y, this.width);
          this.memory[idx] = clamp(this.memory[idx] + amount, -1.0, 1.0);
        }
      }
    }
  }

  halveCircle(xc: number, yc: number, radius: number) {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(xc - radius));
    const x1 = Math.min(this.width - 1, Math.ceil(xc + radius));
    const y0 = Math.max(0, Math.floor(yc - radius));
    const y1 = Math.min(this.height - 1, Math.ceil(yc + radius));
    for (let y = y0; y <= y1; y++) {
      const dy = y - yc;
      for (let x = x0; x <= x1; x++) {
        const dx = x - xc;
        if (dx * dx + dy * dy <= r2) {
          const idx = indexOf(x, y, this.width);
          this.values[idx] *= 0.5;
        }
      }
    }
  }

  drawWallCircle(xc: number, yc: number, radius: number) {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(xc - radius));
    const x1 = Math.min(this.width - 1, Math.ceil(xc + radius));
    const y0 = Math.max(0, Math.floor(yc - radius));
    const y1 = Math.min(this.height - 1, Math.ceil(yc + radius));
    for (let y = y0; y <= y1; y++) {
      const dy = y - yc;
      for (let x = x0; x <= x1; x++) {
        const dx = x - xc;
        if (dx * dx + dy * dy <= r2) {
          const idx = indexOf(x, y, this.width);
          this.walls[idx] = 1;
        }
      }
    }
  }

  eraseWallCircle(xc: number, yc: number, radius: number) {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(xc - radius));
    const x1 = Math.min(this.width - 1, Math.ceil(xc + radius));
    const y0 = Math.max(0, Math.floor(yc - radius));
    const y1 = Math.min(this.height - 1, Math.ceil(yc + radius));
    for (let y = y0; y <= y1; y++) {
      const dy = y - yc;
      for (let x = x0; x <= x1; x++) {
        const dx = x - xc;
        if (dx * dx + dy * dy <= r2) {
          const idx = indexOf(x, y, this.width);
          this.walls[idx] = 0;
        }
      }
    }
  }

  isWall(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return true;
    return this.walls[indexOf(Math.floor(x), Math.floor(y), this.width)] === 1;
  }

  deposit(x: number, y: number, amount: number) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) return;
    const idx = indexOf(xi, yi, this.width);
    const newVal = this.values[idx] + amount;
    this.values[idx] = clamp(newVal, -2.5, 2.5);
  }

  // Iteration 01: accumulate a faint memory echo near deposits
  depositMemory(x: number, y: number, amount: number) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) return;
    const idx = indexOf(xi, yi, this.width);
    // saturate softly to avoid runaway; memory is intentionally low-range
    const v = this.memory[idx] + amount;
    this.memory[idx] = clamp(v, -1.0, 1.0);
  }

  initializeCosineGradient() {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const maxDist = Math.hypot(cx, cy);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy) / maxDist;
        // Smooth cosine from center outward
        const v = Math.cos(d * Math.PI) * 0.5; // [-0.5, 0.5]
        this.values[indexOf(x, y, this.width)] = v;
      }
    }
  }

  diffuseAndEvaporate(diffusion: number, evaporation: number, steps: number) {
    // 5-point Laplacian with walls treated as reflecting boundaries.
    // Iteration 04: local evaporation reduction via rewardEvap map.
    for (let s = 0; s < steps; s++) {
      const w = this.width;
      const h = this.height;
      const src = this.values;
      const dst = this.tmp;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = indexOf(x, y, w);
          const v = src[i];

          // neighbors with wall checks; walls block diffusion by mirroring current cell
          const vL = x > 0 && this.walls[i - 1] === 0 ? src[i - 1] : v;
          const vR = x < w - 1 && this.walls[i + 1] === 0 ? src[i + 1] : v;
          const vU = y > 0 && this.walls[i - w] === 0 ? src[i - w] : v;
          const vD = y < h - 1 && this.walls[i + w] === 0 ? src[i + w] : v;

          const lap = (vL + vR + vU + vD - 4 * v);
          let nv = v + diffusion * lap;
          // Apply per-cell evaporation scaled by reward map (less evaporation where rewardEvap is high)
          const localEvap = evaporation * (1 - Math.max(0, Math.min(1, this.rewardEvap[i])));
          nv *= (1 - localEvap);
          dst[i] = clamp(nv, -2.5, 2.5);
        }
      }
      // swap
      this.values.set(dst);
    }
  }

  // Iteration 01: slow exponential decay of memory each simulation sub-step
  decayMemory(decayPerStep: number) {
    if (decayPerStep <= 0) return;
    const m = this.memory;
    for (let i = 0; i < m.length; i++) {
      m[i] *= (1 - decayPerStep);
    }
  }

  // Iteration 02: exponential decay of latent flow vectors
  decayFlow(decayPerStep: number) {
    if (decayPerStep <= 0) return;
    const fx = this.flowX;
    const fy = this.flowY;
    const keep = (1 - decayPerStep);
    for (let i = 0; i < fx.length; i++) {
      fx[i] *= keep;
      fy[i] *= keep;
    }
  }

  // Iteration 02: accumulate latent flow in the direction of motion
  depositFlow(x: number, y: number, vx: number, vy: number, amount: number, maxMag: number) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) return;
    const idx = indexOf(xi, yi, this.width);
    const fx = this.flowX[idx] + vx * amount;
    const fy = this.flowY[idx] + vy * amount;
    // clamp magnitude to avoid runaway channels
    const mag = Math.hypot(fx, fy);
    if (mag > maxMag && mag > 0) {
      const scale = maxMag / mag;
      this.flowX[idx] = fx * scale;
      this.flowY[idx] = fy * scale;
    } else {
      this.flowX[idx] = fx;
      this.flowY[idx] = fy;
    }
  }

  // Iteration 04: reward application and decay
  decayRewards(decayPerStep: number) {
    if (decayPerStep <= 0) return;
    const keep = (1 - decayPerStep);
    const re = this.rewardEvap;
    const cm = this.calm;
    for (let i = 0; i < re.length; i++) {
      re[i] *= keep;
      cm[i] *= keep;
    }
  }

  depositRewardCircle(
    xc: number,
    yc: number,
    radius: number,
    amountEvap: number,
    amountCalm: number,
    maxEvapReduction: number = 1,
  ) {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(xc - radius));
    const x1 = Math.min(this.width - 1, Math.ceil(xc + radius));
    const y0 = Math.max(0, Math.floor(yc - radius));
    const y1 = Math.min(this.height - 1, Math.ceil(yc + radius));
    for (let y = y0; y <= y1; y++) {
      const dy = y - yc;
      for (let x = x0; x <= x1; x++) {
        const dx = x - xc;
        if (dx * dx + dy * dy <= r2) {
          const idx = indexOf(x, y, this.width);
          if (amountEvap !== 0) {
            this.rewardEvap[idx] = clamp(this.rewardEvap[idx] + amountEvap, 0, Math.max(0, Math.min(1, maxEvapReduction)));
          }
          if (amountCalm !== 0) {
            this.calm[idx] = clamp(this.calm[idx] + amountCalm, 0, 1);
          }
        }
      }
    }
  }

  depositRewardLine(
    x1: number, y1: number, x2: number, y2: number,
    radius: number, amountEvap: number, amountCalm: number,
    maxEvapReduction: number = 1,
  ) {
    const dx = x2 - x1; const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const step = Math.max(2, radius);
    const n = Math.max(2, Math.floor(len / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x1 + dx * t;
      const y = y1 + dy * t;
      this.depositRewardCircle(x, y, radius, amountEvap, amountCalm, maxEvapReduction);
    }
  }
}
