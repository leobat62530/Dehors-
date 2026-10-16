import { BALANCE } from '../config/balance';

/**
 * High-altitude physics. Everything here depends on the altitude y only, never on the country.
 * Values are fractions of the troposphere values, so balance.ts stays the single source of numbers.
 */

/** Drag factor in [0, 1]: full in the troposphere, linear to zero at `dragZeroAltitude`. */
export function dragFactorAt(y: number): number {
  const A = BALANCE.altitude;
  if (y <= A.tropopause) return 1;
  if (y >= A.dragZeroAltitude) return 0;
  return 1 - (y - A.tropopause) / (A.dragZeroAltitude - A.tropopause);
}

/** Gravity factor in (0, 1]: full in the troposphere, then decreasing with altitude. */
export function gravityFactorAt(y: number): number {
  const A = BALANCE.altitude;
  if (y <= A.tropopause) return 1;
  // Smooth decrease towards the floor, in log-space so each band feels different.
  const t = Math.min(
    1,
    Math.log(y / A.tropopause) / Math.log(A.gravityFloorAltitude / A.tropopause),
  );
  const base = 1 - (1 - A.gravityFloorFactor) * t;
  return Math.max(A.gravityFloorFactor, base);
}

export function gravityAt(y: number): number {
  return BALANCE.physics.gravity * gravityFactorAt(y);
}

export function dragKAt(y: number): number {
  return BALANCE.physics.dragK * dragFactorAt(y);
}
