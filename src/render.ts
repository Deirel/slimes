import { Field } from './field';
import type { Agent } from './types';
import { gammaCorrect, indexOf } from './utils';

// Palette tokens chosen for high contrast on a deep, cool background.
// Warm (positive) branch: ember → butter. Cool (negative) branch: deep teal → aqua.
// Agent overlay: electric magenta with white twinkle to pop over both branches.
const PALETTE = {
  bg: { r: 10, g: 14, b: 19 }, // #0a0e13
  wall: { r: 28, g: 35, b: 44 }, // #1c232c
  warmStart: [255, 136, 64] as [number, number, number], // #ff8840
  warmEnd:   [255, 234, 170] as [number, number, number], // #ffeaAA
  coolStart: [32, 92, 148] as [number, number, number], // #205c94
  coolEnd:   [96, 224, 208] as [number, number, number], // #60e0d0
  agentBase:    [245, 90, 230] as [number, number, number], // #f55ae6
  agentTwinkle: [20, 40, 20] as [number, number, number],
  agentSparkle: [255, 160, 245] as [number, number, number], // #ffa0f5
} as const;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

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
    const gamma = 0.9;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = indexOf(x, y, w);
        const v = field.values[i];
        let r = PALETTE.bg.r, g = PALETTE.bg.g, b = PALETTE.bg.b;
        // Map value to two-pole palette with dark zero using gamma-corrected lerp
        if (v > 0) {
          const t = Math.min(1, v / 2.5);
          const s = gammaCorrect(t, gamma);
          r = Math.round(lerp(PALETTE.warmStart[0], PALETTE.warmEnd[0], s));
          g = Math.round(lerp(PALETTE.warmStart[1], PALETTE.warmEnd[1], s));
          b = Math.round(lerp(PALETTE.warmStart[2], PALETTE.warmEnd[2], s));
        } else if (v < 0) {
          const t = Math.min(1, (-v) / 2.5);
          const s = gammaCorrect(t, gamma);
          r = Math.round(lerp(PALETTE.coolStart[0], PALETTE.coolEnd[0], s));
          g = Math.round(lerp(PALETTE.coolStart[1], PALETTE.coolEnd[1], s));
          b = Math.round(lerp(PALETTE.coolStart[2], PALETTE.coolEnd[2], s));
        }
        // Walls: consistent dark tone for clear separation
        if (field.walls[i] === 1) {
          r = PALETTE.wall.r; g = PALETTE.wall.g; b = PALETTE.wall.b;
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
        // Mix agent base toward white by twinkle for pop
        const ar = Math.min(255, Math.round(lerp(PALETTE.agentBase[0], 255, 0.2 + 0.8 * twinkle)));
        const ag = Math.min(255, Math.round(lerp(PALETTE.agentBase[1], 255, 0.2 + 0.8 * twinkle)));
        const ab = Math.min(255, Math.round(lerp(PALETTE.agentBase[2], 255, 0.2 + 0.8 * twinkle)));
        // lighten blend: take max to ensure visibility over background
        if (ar > data32[i]) data32[i] = ar;
        if (ag > data32[i + 1]) data32[i + 1] = ag;
        if (ab > data32[i + 2]) data32[i + 2] = ab;
        // optional tiny forward sparkle for heading hint
        const fx = (a.x + Math.cos(a.angle) * 0.6) | 0;
        const fy = (a.y + Math.sin(a.angle) * 0.6) | 0;
        if (fx >= 0 && fy >= 0 && fx < w && fy < h) {
          const j = indexOf(fx, fy, w) * 4;
          const br = PALETTE.agentSparkle[0];
          const bg = PALETTE.agentSparkle[1];
          const bb = PALETTE.agentSparkle[2];
          if (br > data32[j]) data32[j] = br;
          if (bg > data32[j + 1]) data32[j + 1] = bg;
          if (bb > data32[j + 2]) data32[j + 2] = bb;
        }
      }
    }

    this.bctx.putImageData(this.imageData, 0, 0);
  }
}
