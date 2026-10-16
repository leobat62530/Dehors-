import { BALANCE } from '../config/balance';

/**
 * Fixed-timestep driver: the simulation always advances in steps of 1/physicsHz seconds,
 * whatever the display refresh rate. Rendering gets an interpolation factor in [0, 1).
 */
export class FixedStepper {
  readonly step = 1 / BALANCE.loop.physicsHz;
  private accumulator = 0;
  /** Total number of physics steps run since creation. */
  steps = 0;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: (alpha: number) => void,
  ) {}

  /** Advance by one display frame of `frameSeconds`. */
  frame(frameSeconds: number): void {
    this.accumulator += Math.min(Math.max(frameSeconds, 0), BALANCE.loop.maxFrameSeconds);
    while (this.accumulator >= this.step) {
      this.update(this.step);
      this.accumulator -= this.step;
      this.steps++;
    }
    this.render(this.accumulator / this.step);
  }

  reset(): void {
    this.accumulator = 0;
  }
}

/** Runs a FixedStepper on requestAnimationFrame. */
export function startAnimationLoop(stepper: FixedStepper): void {
  let last = -1;
  const tick = (now: number): void => {
    const seconds = last < 0 ? 0 : (now - last) / 1000;
    last = now;
    stepper.frame(seconds);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.addEventListener('visibilitychange', () => {
    // Drop the time spent in background instead of simulating it all at once.
    last = -1;
    stepper.reset();
  });
}
