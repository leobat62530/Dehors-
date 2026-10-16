import { BALANCE, launchSpeed } from '../config/balance';
import { Rng } from '../core/rng';
import type { Aim } from './kick';
import { type Body, type BounceHook, createBody, launch, resetBody, speedOf, stepBody } from './physics';

export type Phase = 'aim' | 'swing' | 'flight' | 'ended';

export type EndReason = 'stopped' | 'noProgress';

/** One run, from the aim to the end screen. Pure game state, no rendering. */
export class Run {
  readonly body: Body = createBody();
  /** Previous step's position, for render interpolation. */
  prevX = 0;
  prevY = 0;

  phase: Phase = 'aim';
  aim: Aim = { power: 0, angle: BALANCE.kick.defaultAngle };
  aiming = false;

  rng: Rng;
  time = 0;
  swingTime = 0;
  maxAltitude = 0;
  maxSpeed = 0;
  endReason: EndReason | null = null;

  private bestX = 0;
  private noProgressTime = 0;

  constructor(
    seed: number,
    private readonly kickLevel: number,
    private readonly onBounce?: BounceHook,
  ) {
    this.rng = new Rng(seed);
  }

  get seed(): number {
    return this.rng.seed;
  }

  get distance(): number {
    return Math.max(0, this.body.x);
  }

  reset(seed: number): void {
    this.rng = new Rng(seed);
    resetBody(this.body);
    this.prevX = 0;
    this.prevY = 0;
    this.phase = 'aim';
    this.aim.power = 0;
    this.aim.angle = BALANCE.kick.defaultAngle;
    this.aiming = false;
    this.time = 0;
    this.swingTime = 0;
    this.maxAltitude = 0;
    this.maxSpeed = 0;
    this.endReason = null;
    this.bestX = 0;
    this.noProgressTime = 0;
  }

  /** Release of the boot: start the swing if the drag was strong enough. Returns true if kicked. */
  release(): boolean {
    this.aiming = false;
    if (this.phase !== 'aim') return false;
    if (this.aim.power < BALANCE.kick.minPowerToKick) {
      this.aim.power = 0;
      return false;
    }
    this.phase = 'swing';
    this.swingTime = 0;
    return true;
  }

  step(dt: number): void {
    this.prevX = this.body.x;
    this.prevY = this.body.y;

    switch (this.phase) {
      case 'aim':
      case 'ended':
        return;
      case 'swing':
        this.swingTime += dt;
        if (this.swingTime >= BALANCE.kick.swingSeconds) {
          launch(this.body, launchSpeed(this.aim.power, this.kickLevel), this.aim.angle);
          this.phase = 'flight';
        }
        return;
      case 'flight':
        this.time += dt;
        stepBody(this.body, dt, this.onBounce);
        this.track(dt);
        return;
    }
  }

  private track(dt: number): void {
    const b = this.body;
    const v = speedOf(b);
    if (b.y > this.maxAltitude) this.maxAltitude = b.y;
    if (v > this.maxSpeed) this.maxSpeed = v;

    if (b.x > this.bestX + BALANCE.end.progressEpsilon) {
      this.bestX = b.x;
      this.noProgressTime = 0;
    } else {
      this.noProgressTime += dt;
    }

    if (b.onGround && v < BALANCE.end.minSpeed) this.end('stopped');
    else if (this.noProgressTime >= BALANCE.end.noProgressSeconds) this.end('noProgress');
  }

  private end(reason: EndReason): void {
    this.phase = 'ended';
    this.endReason = reason;
    this.body.vx = 0;
    this.body.vy = 0;
  }
}
