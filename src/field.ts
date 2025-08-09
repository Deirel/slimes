import { clamp, indexOf } from './utils';

export class Field {
  width: number;
  height: number;
  values: Float32Array; // scalar field
  walls: Uint8Array; // 1 if wall

  // working buffers for diffusion
  private tmp: Float32Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.values = new Float32Array(width * height);
    this.walls = new Uint8Array(width * height);
    this.tmp = new Float32Array(width * height);
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.values = new Float32Array(width * height);
    this.walls = new Uint8Array(width * height);
    this.tmp = new Float32Array(width * height);
  }

  clearValues() {
    this.values.fill(0);
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
    // 5-point Laplacian with walls treated as reflecting boundaries
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
          nv *= (1 - evaporation);
          dst[i] = clamp(nv, -2.5, 2.5);
        }
      }
      // swap
      this.values.set(dst);
    }
  }
}
