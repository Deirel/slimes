export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function randRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function gammaCorrect(value: number, gamma: number): number {
  return Math.pow(value, gamma);
}

export function wrapAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  angle = angle % twoPi;
  if (angle < 0) angle += twoPi;
  return angle;
}

export function indexOf(x: number, y: number, width: number): number {
  return y * width + x;
}
