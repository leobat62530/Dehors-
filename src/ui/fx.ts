import { BALANCE } from '../config/balance';
import { THEME } from '../theme/theme';

/**
 * Visual feedback that lives outside the simulation: speed trail, coin particles, sound-barrier
 * shock wave. Everything is preallocated; nothing is created during a run.
 */
export class Trail {
  private readonly xs: Float32Array;
  private readonly ys: Float32Array;
  private head = 0;
  private count = 0;

  constructor(private readonly size: number = BALANCE.fx.trailPoints) {
    this.xs = new Float32Array(size);
    this.ys = new Float32Array(size);
  }

  push(x: number, y: number): void {
    this.xs[this.head] = x;
    this.ys[this.head] = y;
    this.head = (this.head + 1) % this.size;
    if (this.count < this.size) this.count++;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }

  get length(): number {
    return this.count;
  }

  /** Draw from oldest to newest, fading in; `strength` in [0, 1] scales the width. */
  draw(ctx: CanvasRenderingContext2D, ox: number, oy: number, scale: number, strength: number): void {
    if (this.count < 2 || strength <= 0) return;
    ctx.fillStyle = THEME.ghost;
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - this.count + i + this.size) % this.size;
      const k = (i + 1) / this.count;
      ctx.globalAlpha = k * 0.85 * Math.min(1, strength * 1.5);
      const r = 2 + 9 * k * strength;
      ctx.beginPath();
      ctx.arc(ox + (this.xs[idx] ?? 0) * scale, oy - (this.ys[idx] ?? 0) * scale, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export class Particles {
  readonly items: Particle[] = [];
  private next = 0;

  constructor(size: number = BALANCE.fx.particlePool) {
    for (let i = 0; i < size; i++) this.items.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  }

  /** Burst of `n` sparks at (x, y) in world metres; reuses the oldest slots when the pool is full. */
  burst(x: number, y: number, n: number, seed: number): void {
    for (let i = 0; i < n; i++) {
      const p = this.items[this.next]!;
      this.next = (this.next + 1) % this.items.length;
      const a = ((i + seed) / n) * Math.PI * 2;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * 6;
      p.vy = Math.sin(a) * 6 + 3;
      p.life = BALANCE.fx.particleSeconds;
    }
  }

  countActive(): number {
    let n = 0;
    for (const p of this.items) if (p.active) n++;
    return n;
  }

  update(dt: number): void {
    for (const p of this.items) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 12 * dt;
    }
  }

  clear(): void {
    for (const p of this.items) p.active = false;
  }

  draw(ctx: CanvasRenderingContext2D, ox: number, oy: number, scale: number): void {
    ctx.fillStyle = THEME.accent;
    const s = Math.max(scale, 8);
    for (const p of this.items) {
      if (!p.active) continue;
      const k = p.life / BALANCE.fx.particleSeconds;
      ctx.globalAlpha = k;
      ctx.fillRect(ox + p.x * scale - s * 0.12, oy - p.y * scale - s * 0.12, s * 0.24, s * 0.24);
    }
    ctx.globalAlpha = 1;
  }
}

/** Expanding ring at the point where the sound barrier broke. */
export function drawShockWave(ctx: CanvasRenderingContext2D, sx: number, sy: number, progress: number, width: number): void {
  if (progress <= 0 || progress >= 1) return;
  const r = progress * width * 0.9;
  ctx.globalAlpha = (1 - progress) * 0.9;
  ctx.lineWidth = 6 * (1 - progress) + 1;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Record banner sweeping across: distance in the warm accent, altitude in sky blue. */
export function drawBanner(ctx: CanvasRenderingContext2D, W: number, y: number, progress: number, text: string, kind: 'distance' | 'altitude', fontSpec: string): void {
  // Slide in, hold, slide out.
  const x = progress < 0.2 ? W * (-1 + progress / 0.2) : progress > 0.8 ? W * ((progress - 0.8) / 0.2) : 0;
  ctx.save();
  ctx.translate(x, 0);
  ctx.fillStyle = kind === 'distance' ? THEME.accent : '#5aa9e6';
  ctx.fillRect(0, y - 26, W, 52);
  ctx.fillStyle = THEME.outline;
  ctx.fillRect(0, y - 26, W, 4);
  ctx.fillRect(0, y + 22, W, 4);
  ctx.font = fontSpec;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = kind === 'distance' ? THEME.ui : '#ffffff';
  ctx.fillText(text, W / 2, y);
  ctx.restore();
}
