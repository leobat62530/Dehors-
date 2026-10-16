import { BALANCE } from '../config/balance';
import { dragKAt, gravityAt } from './atmosphere';
import { stageAt } from './world';

/** Point-mass body in world metres. y is altitude above the ground (up is positive). */
export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  rolling: boolean;
  bounces: number;
}

export function createBody(): Body {
  return { x: 0, y: 0, vx: 0, vy: 0, onGround: true, rolling: false, bounces: 0 };
}

export function resetBody(b: Body): void {
  b.x = 0;
  b.y = 0;
  b.vx = 0;
  b.vy = 0;
  b.onGround = true;
  b.rolling = false;
  b.bounces = 0;
}

export function copyBody(from: Body, to: Body): void {
  to.x = from.x;
  to.y = from.y;
  to.vx = from.vx;
  to.vy = from.vy;
  to.onGround = from.onGround;
  to.rolling = from.rolling;
  to.bounces = from.bounces;
}

export function speedOf(b: Body): number {
  return Math.hypot(b.vx, b.vy);
}

/** Launch the body from the ground at `speed` m/s and `angleDeg` degrees above the horizon. */
export function launch(b: Body, speed: number, angleDeg: number): void {
  const a = (angleDeg * Math.PI) / 180;
  b.vx = speed * Math.cos(a);
  b.vy = speed * Math.sin(a);
  b.onGround = false;
  b.rolling = false;
}

/** Hook called on each ground bounce (camera shake, haptics, sound). */
export type BounceHook = (impactSpeed: number) => void;

/** Per-step environment: wind and drag override, so effects (sound barrier, gadgets) stay outside the integrator. */
export interface Environment {
  /** Multiplier on drag, 1 = normal, 0 = no drag at all. */
  dragScale: number;
  /** Use the wind of the stage under x. Off for the ghost preview so the aim stays readable. */
  wind: boolean;
}

export const DEFAULT_ENV: Environment = { dragScale: 1, wind: true };

/**
 * Advance one fixed physics step (semi-implicit Euler).
 * Kept free of allocations: it runs 120 times per second and inside the ghost preview.
 */
export function stepBody(b: Body, dt: number, onBounce?: BounceHook, env: Environment = DEFAULT_ENV): void {
  const P = BALANCE.physics;
  const k = dragKAt(b.y) * env.dragScale;
  // Wind: drag acts on the air-relative velocity, so a tailwind pushes and a headwind brakes.
  let wind = env.wind ? stageAt(b.x).wind : 0;
  if (wind > BALANCE.wind.maxEffect) wind = BALANCE.wind.maxEffect;
  else if (wind < -BALANCE.wind.maxEffect) wind = -BALANCE.wind.maxEffect;

  if (b.rolling) {
    // Rolling: no vertical motion, multiplicative friction plus constant resistance.
    b.vx *= Math.pow(P.rollFrictionPerSecond, dt);
    const dv = P.rollResistance * dt;
    b.vx = b.vx > dv ? b.vx - dv : b.vx < -dv ? b.vx + dv : 0;
    const rel = b.vx - wind;
    b.vx -= k * rel * Math.abs(rel) * dt;
    b.x += b.vx * dt;
    return;
  }

  const rx = b.vx - wind;
  const ry = b.vy;
  const rel = Math.hypot(rx, ry);
  b.vx += -k * rel * rx * dt;
  b.vy += (-gravityAt(b.y) - k * rel * ry) * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  if (b.y <= 0) {
    b.y = 0;
    if (b.vy < 0) {
      const impact = -b.vy;
      if (impact < P.rollThreshold) {
        b.vy = 0;
        b.rolling = true;
        b.onGround = true;
      } else {
        b.vy = impact * P.restitution;
        b.vx *= P.bounceFriction;
        b.bounces++;
        onBounce?.(impact);
      }
    }
  } else {
    b.onGround = false;
  }
}
