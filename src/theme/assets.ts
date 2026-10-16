import { THEME } from './theme';

/**
 * Every visual goes through this interface. Placeholders are drawn in code; swapping one
 * for a PNG or SVG means providing another Sprite, without touching game logic.
 * Sprites draw centred on (0, 0) in metres, y up; the renderer sets the transform.
 */
export interface Sprite {
  draw(ctx: CanvasRenderingContext2D, pose: number): void;
}

export type CharacterPose = 'fours' | 'flight' | 'roll';

/** Placeholder character: a rounded block with eyes, on all fours or flying. */
const character: Sprite = {
  draw(ctx, pose) {
    const w = 2.2;
    const h = 1.6;
    ctx.lineWidth = 0.14;
    ctx.strokeStyle = THEME.outline;
    ctx.fillStyle = THEME.bodyShirt;
    roundRect(ctx, -w / 2, -h / 2, w, h, 0.4);
    ctx.fill();
    ctx.stroke();
    // head
    ctx.fillStyle = THEME.body;
    ctx.beginPath();
    ctx.arc(w / 2 + 0.25, pose === 0 ? 0.15 : 0.35, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // eye
    ctx.fillStyle = THEME.outline;
    ctx.beginPath();
    ctx.arc(w / 2 + 0.45, pose === 0 ? 0.3 : 0.5, 0.11, 0, Math.PI * 2);
    ctx.fill();
    if (pose === 0) {
      // legs on all fours
      ctx.fillStyle = THEME.body;
      for (const lx of [-0.75, -0.35, 0.45, 0.85]) {
        ctx.fillRect(lx - 0.12, -h / 2 - 0.5, 0.24, 0.55);
        ctx.strokeRect(lx - 0.12, -h / 2 - 0.5, 0.24, 0.55);
      }
    }
  },
};

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
  character,
  boot,
} as const;

/** Pose index for the character sprite. */
export const POSE: Record<CharacterPose, number> = { fours: 0, flight: 1, roll: 2 };

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
