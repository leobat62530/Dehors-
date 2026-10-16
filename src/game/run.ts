import { BALANCE, launchSpeed } from '../config/balance';
import { Rng } from '../core/rng';
import type { Aim } from './kick';
import {
  type Body,
  type BounceHook,
  createBody,
  type Environment,
  launch,
  resetBody,
  speedOf,
  stepBody,
} from './physics';
import { layerIndexAt, stageIndexAt } from './world';

export type Phase = 'aim' | 'swing' | 'flight' | 'ended';

export type EndReason = 'stopped' | 'noProgress';

/** Events the run raises for the presentation layer (signs, flashes, haptics). */
export interface RunEvents {
  onBounce?: BounceHook;
  /** The character crossed into a new ground stage. */
  onStage?: (stageIndex: number) => void;
  /** The character entered a new sky layer (up or down). */
  onLayer?: (layerIndex: number, rising: boolean) => void;
  /** The sound barrier broke. */
  onSoundBarrier?: () => void;
}

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

  /** Current ground stage and sky layer. */
  stageIndex = 0;
  layerIndex = 0;
  /** Farthest stage and highest layer reached in this run. */
  maxStageIndex = 0;
  maxLayerIndex = 0;

  /** Remaining seconds of the sound-barrier effect, 0 when inactive. */
  barrierTime = 0;
  barrierCount = 0;
  private barrierCooldown = 0;

  /** Index into BALANCE.timeScale.steps chosen by the player. */
  timeScaleIndex = 0;

  private readonly env: Environment = { dragScale: 1, wind: true };
  private bestX = 0;
  private noProgressTime = 0;

  constructor(
    seed: number,
    private readonly kickLevel: number,
    private readonly events: RunEvents = {},
  ) {
    this.rng = new Rng(seed);
  }

  get seed(): number {
    return this.rng.seed;
  }

  get distance(): number {
    return Math.max(0, this.body.x);
  }

  get timeScale(): number {
    return BALANCE.timeScale.steps[this.timeScaleIndex] ?? 1;
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
    this.stageIndex = 0;
    this.layerIndex = 0;
    this.maxStageIndex = 0;
    this.maxLayerIndex = 0;
    this.barrierTime = 0;
    this.barrierCount = 0;
    this.barrierCooldown = 0;
    this.timeScaleIndex = 0;
    this.env.dragScale = 1;
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

  /** Cycle the time accelerator: ×1 → ×2 → ×5 → ×10 → ×1. */
  cycleTimeScale(maxIndex: number = BALANCE.timeScale.freeMaxIndex): void {
    this.timeScaleIndex = this.timeScaleIndex >= maxIndex ? 0 : this.timeScaleIndex + 1;
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
        this.updateEffects(dt);
        stepBody(this.body, dt, this.events.onBounce, this.env);
        this.track(dt);
        return;
    }
  }

  private updateEffects(dt: number): void {
    if (this.barrierTime > 0) {
      this.barrierTime = Math.max(0, this.barrierTime - dt);
      if (this.barrierTime === 0) this.env.dragScale = 1;
    }
    if (this.barrierCooldown > 0) this.barrierCooldown = Math.max(0, this.barrierCooldown - dt);
  }

  private track(dt: number): void {
    const b = this.body;
    const v = speedOf(b);
    if (b.y > this.maxAltitude) this.maxAltitude = b.y;
    if (v > this.maxSpeed) this.maxSpeed = v;

    // Sound barrier: a speed, never a place.
    const SB = BALANCE.soundBarrier;
    if (v >= SB.speed && this.barrierTime === 0 && this.barrierCooldown === 0 && !b.rolling) {
      b.vx *= SB.boost;
      b.vy *= SB.boost;
      this.barrierTime = SB.seconds;
      this.barrierCooldown = SB.seconds + SB.cooldown;
      this.barrierCount++;
      this.env.dragScale = 0;
      this.events.onSoundBarrier?.();
    }

    // Country from x only, layer from y only.
    const stage = stageIndexAt(b.x);
    if (stage !== this.stageIndex) {
      this.stageIndex = stage;
      if (stage > this.maxStageIndex) this.maxStageIndex = stage;
      this.events.onStage?.(stage);
    }
    const layer = layerIndexAt(b.y);
    if (layer !== this.layerIndex) {
      const rising = layer > this.layerIndex;
      this.layerIndex = layer;
      if (layer > this.maxLayerIndex) this.maxLayerIndex = layer;
      this.events.onLayer?.(layer, rising);
    }

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
    this.timeScaleIndex = 0;
  }
}
