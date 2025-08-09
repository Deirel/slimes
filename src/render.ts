import { Field } from './field';
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

  renderField(field: Field) {
    const w = field.width;
    const h = field.height;
    if (this.imageData.width !== w || this.imageData.height !== h) {
      this.imageData = this.bctx.createImageData(w, h);
    }
    const data = this.imageData.data;
    const gamma = 0.65;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = indexOf(x, y, w);
        const v = field.values[i];
        let r = 0, g = 0, b = 0;
        if (v >= 0) {
          const t = Math.min(1, v / 2.5);
          const s = gammaCorrect(t, gamma);
          r = 20 * (1 - s);
          g = 120 + 80 * s;
          b = 180 + 60 * s;
        } else {
          const t = Math.min(1, (-v) / 2.5);
          const s = gammaCorrect(t, gamma);
          r = 220 * s + 20 * (1 - s);
          g = 80 * (1 - s);
          b = 30 * (1 - s);
        }
        if (field.walls[i] === 1) {
          r *= 0.3; g *= 0.3; b *= 0.3;
        }
        const di = i * 4;
        data[di] = r;
        data[di + 1] = g;
        data[di + 2] = b;
        data[di + 3] = 255;
      }
    }

    this.bctx.putImageData(this.imageData, 0, 0);
  }
}
