import { THEME } from './theme';

/**
 * Every visual goes through this interface. Placeholders are drawn in code; swapping one
 * for a PNG or SVG means providing another Sprite, without touching game logic.
 * Sprites draw centred on (0, 0) in metres, y up; the renderer sets the transform.
 */
export interface Sprite {
  draw(ctx: CanvasRenderingContext2D, pose: number): void;
}

/** Placeholder cartoon boot (godasse), toe pointing right. */
const boot: Sprite = {
  draw(ctx) {
    ctx.lineWidth = 0.14;
    ctx.strokeStyle = THEME.outline;
    ctx.fillStyle = THEME.boot;
    ctx.beginPath();
    ctx.moveTo(-0.5, 1.6);
    ctx.lineTo(0.3, 1.6);
    ctx.lineTo(0.3, 0.5);
    ctx.quadraticCurveTo(1.5, 0.45, 1.6, -0.1);
    ctx.lineTo(-0.6, -0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = THEME.bootSole;
    ctx.fillRect(-0.6, -0.35, 2.25, 0.25);
    ctx.strokeRect(-0.6, -0.35, 2.25, 0.25);
  },
};

export const ASSETS = {
  boot,
} as const;

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
