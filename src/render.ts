import { Field } from './field';
import type { Agent } from './types';
import { gammaCorrect, indexOf } from './utils';

export class Renderer {
  buffer: HTMLCanvasElement;
  bctx: CanvasRenderingContext2D;
  imageData: ImageData;

  constructor() {
    this.buffer = document.createElement('canvas');
    const ctx = this.buffer.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.bctx = ctx;
    this.imageData = new ImageData(1, 1);
  }

  resize(width: number, height: number) {
    this.buffer.width = width;
    this.buffer.height = height;
    this.imageData = this.bctx.createImageData(width, height);
  }

  renderField(field: Field, agentsOverlay?: Agent[], nowMs?: number) {
    const w = field.width;
    const h = field.height;
    if (this.imageData.width !== w || this.imageData.height !== h) {
      this.imageData = this.bctx.createImageData(w, h);
    }
    const data = this.imageData.data;
    const gamma = 0.8;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = indexOf(x, y, w);
        const v = field.values[i];
        let r = 0, g = 0, b = 0;
        // Map value to two-pole palette with dark zero
        if (v > 0) {
          const t = Math.min(1, v / 2.5);
          const s = gammaCorrect(t, gamma);
          // warm branch: amber -> orange -> soft yellow
          r = 40 + 200 * s;
          g = 28 + 140 * s;
          b = 8 + 20 * (1 - s);
        } else if (v < 0) {
          const t = Math.min(1, (-v) / 2.5);
          const s = gammaCorrect(t, gamma);
          // cool branch: deep blue -> cyan
          r = 10 + 20 * (1 - s);
          g = 40 + 150 * s;
          b = 70 + 170 * s;
        } else {
          r = 8; g = 10; b = 12;
        }
        // Walls: consistent dark gray for clear separation
        if (field.walls[i] === 1) {
          r = 24; g = 28; b = 32;
        }
        const di = i * 4;
        data[di] = r;
        data[di + 1] = g;
        data[di + 2] = b;
        data[di + 3] = 255;
      }
    }

    // Optional agent overlay for better motion readability
    if (agentsOverlay && agentsOverlay.length > 0) {
      const data32 = this.imageData.data; // Uint8ClampedArray
      const t = (nowMs ?? 0) * 0.008; // time for subtle twinkle
      for (let ai = 0; ai < agentsOverlay.length; ai++) {
        const a = agentsOverlay[ai];
        const x = (a.x | 0);
        const y = (a.y | 0);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = indexOf(x, y, w) * 4;
        // per-agent phase from position for de-sync
        const seed = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 6283;
        const phase = seed / 1000;
        const twinkle = 0.6 + 0.4 * Math.sin(t + phase);
        // vivid magenta-white to stand out over warm trails and cool sinks
        const ar = Math.min(255, (235 + 20 * twinkle));
        const ag = Math.min(255, (60 + 60 * twinkle));
        const ab = Math.min(255, (210 + 40 * twinkle));
        // lighten blend: take max to ensure visibility over background
        if (ar > data32[i]) data32[i] = ar;
        if (ag > data32[i + 1]) data32[i + 1] = ag;
        if (ab > data32[i + 2]) data32[i + 2] = ab;
        // optional tiny forward sparkle for heading hint
        const fx = (a.x + Math.cos(a.angle) * 0.6) | 0;
        const fy = (a.y + Math.sin(a.angle) * 0.6) | 0;
        if (fx >= 0 && fy >= 0 && fx < w && fy < h) {
          const j = indexOf(fx, fy, w) * 4;
          const br = Math.min(255, (250));
          const bg = Math.min(255, (90));
          const bb = Math.min(255, (230));
          if (br > data32[j]) data32[j] = br;
          if (bg > data32[j + 1]) data32[j + 1] = bg;
          if (bb > data32[j + 2]) data32[j + 2] = bb;
        }
      }
    }

    this.bctx.putImageData(this.imageData, 0, 0);
  }
}
