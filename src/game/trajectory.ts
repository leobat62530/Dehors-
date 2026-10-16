import { BALANCE } from '../config/balance';
import { createBody, type Environment, launch, stepBody } from './physics';

const GHOST_ENV: Environment = { dragScale: 1, wind: true };

/**
 * Ghost trajectory shown while aiming. Points are written into a preallocated buffer,
 * so recomputing it every frame allocates nothing.
 */
export class GhostTrajectory {
  readonly xs = new Float32Array(BALANCE.render.ghostDots);
  readonly ys = new Float32Array(BALANCE.render.ghostDots);
  count = 0;
  private readonly body = createBody();

  compute(speed: number, angleDeg: number): void {
    const b = this.body;
    b.x = 0;
    b.y = 0;
    b.bounces = 0;
    launch(b, speed, angleDeg);
    const dt = 1 / BALANCE.loop.physicsHz;
    this.count = 0;
    for (let i = 0; i < BALANCE.render.ghostDots; i++) {
      for (let s = 0; s < BALANCE.render.ghostStepsPerDot; s++) stepBody(b, dt, undefined, GHOST_ENV);
      this.xs[i] = b.x;
      this.ys[i] = b.y;
      this.count++;
      if (b.bounces > 0) break; // the ghost stops at the first impact
    }
  }
}
