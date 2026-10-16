import { BALANCE } from '../config/balance';

export interface Aim {
  /** 0..1 */
  power: number;
  /** Degrees above the horizon, clamped to the allowed range. */
  angle: number;
}

/**
 * Turns a drag on the boot into an aim. The player pulls the boot backwards (left and/or down);
 * the kick goes the opposite way. `dx`, `dy` are the drag vector in screen pixels (y down),
 * `fullPowerPx` the drag length that gives full power.
 */
export function aimFromDrag(dx: number, dy: number, fullPowerPx: number, out: Aim): Aim {
  const len = Math.hypot(dx, dy);
  out.power = Math.min(1, len / Math.max(1, fullPowerPx));
  // Opposite of the pull, with screen y flipped to world y (up is positive).
  const wx = -dx;
  const wy = dy;
  let angle = len < 1e-6 ? BALANCE.kick.defaultAngle : (Math.atan2(wy, wx) * 180) / Math.PI;
  // Pulls that point the kick backwards still kick forwards: mirror them onto the forward side.
  if (angle > 90) angle = 180 - angle;
  if (angle < -90) angle = -180 - angle;
  out.angle = Math.min(BALANCE.kick.maxAngle, Math.max(BALANCE.kick.minAngle, angle));
  return out;
}


