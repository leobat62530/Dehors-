import { BALANCE, distanceCoins, launchSpeed } from '../config/balance';
import { Rng } from '../core/rng';
import { type BoosterKind, type BouncerKind, type Entity, EntityPool, type ObstacleKind, overlaps, type ProfileId, Spawner } from './entities';
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

export type EndReason = 'stopped' | 'noProgress' | 'wall' | 'fatal';

/** What the character carries into a run. Levels and charges come from the shop. */
export interface Equipment {
  kickLevel: number;
  solesLevel: number;
  /** "Combinaison": each level keeps less drag. */
  suitLevel: number;
  /** "Aimant": pickup radius. */
  magnetLevel: number;
  /** "Fusée d'appoint": manual boosts per run. */
  rocketCharges: number;
  /** "Tremplin": start further along the track. */
  rampLevel: number;
  /** Walls the current helmet can still break, 0 when none. */
  helmetCharges: number;
  /** Fatal obstacles the lawyer can cancel this run. */
  lawyerCharges: number;
}

export function defaultEquipment(): Equipment {
  return { kickLevel: 0, solesLevel: 0, suitLevel: 0, magnetLevel: 0, rocketCharges: 0, rampLevel: 0, helmetCharges: 0, lawyerCharges: 0 };
}

/** Events the run raises for the presentation layer (signs, flashes, haptics). */
export interface RunEvents {
  onBounce?: BounceHook;
  onStage?: (stageIndex: number) => void;
  onLayer?: (layerIndex: number, rising: boolean) => void;
  onSoundBarrier?: () => void;
  onBouncer?: (e: Entity) => void;
  onBooster?: (e: Entity) => void;
  onObstacle?: (e: Entity) => void;
  onWall?: (e: Entity, broken: boolean) => void;
  onLawyer?: () => void;
  onCoin?: (e: Entity) => void;
  onRocket?: () => void;
}

/** One run, from the aim to the end screen. Pure game state, no rendering. */
export class Run {
  readonly body: Body = createBody();
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
  /** Kind of the obstacle that ended the run, for the end-screen text. */
  fatalKind: ObstacleKind | null = null;

  stageIndex = 0;
  layerIndex = 0;
  maxStageIndex = 0;
  maxLayerIndex = 0;

  barrierTime = 0;
  barrierCount = 0;
  private barrierCooldown = 0;

  timeScaleIndex = 0;

  /** Coins picked up in this run (what the radar can take). */
  coins = 0;
  /** Coins earned from the distance, computed at the end. */
  distanceCoins = 0;
  bouncerChain = 0;
  bestBouncerChain = 0;
  wallsBroken = 0;
  /** Remaining helmet charges, decremented per wall. */
  helmetCharges = 0;
  lawyerCharges = 0;
  lawyerUsed = 0;
  rocketCharges = 0;
  rocketsUsed = 0;
  coinsPicked = 0;

  /** Booster effect: seconds left of no-drag, and wobble amplitude. */
  boostTime = 0;
  boostKind: BoosterKind | null = null;
  private wobble = 0;
  /** Extra-drag window (barrel). */
  private heavyDragTime = 0;

  /** Clinging obstacle. */
  clingKind: ObstacleKind | null = null;
  private clingRate = 0;
  clingTaps = 0;
  private clingTapTime = 0;

  readonly pool = new EntityPool();
  private readonly spawner: Spawner;
  private readonly env: Environment = { dragScale: 1, wind: true };
  private bestX = 0;
  private noProgressTime = 0;
  private lastBounces = 0;

  constructor(
    seed: number,
    readonly equipment: Equipment = defaultEquipment(),
    readonly profile: ProfileId = 'depart',
    private readonly events: RunEvents = {},
  ) {
    this.rng = new Rng(seed);
    this.spawner = new Spawner(this.pool, profile);
    this.reset(seed);
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
    this.fatalKind = null;
    this.stageIndex = 0;
    this.layerIndex = 0;
    this.maxStageIndex = 0;
    this.maxLayerIndex = 0;
    this.barrierTime = 0;
    this.barrierCount = 0;
    this.barrierCooldown = 0;
    this.timeScaleIndex = 0;
    this.coins = 0;
    this.distanceCoins = 0;
    this.bouncerChain = 0;
    this.bestBouncerChain = 0;
    this.wallsBroken = 0;
    this.helmetCharges = this.equipment.helmetCharges;
    this.lawyerCharges = this.equipment.lawyerCharges;
    this.lawyerUsed = 0;
    this.rocketCharges = this.equipment.rocketCharges;
    this.rocketsUsed = 0;
    this.coinsPicked = 0;
    // "Tremplin de départ": the run starts further along the track.
    this.body.x = this.equipment.rampLevel * BALANCE.upgradeEffects.rampMetresPerLevel;
    this.prevX = this.body.x;
    this.boostTime = 0;
    this.boostKind = null;
    this.wobble = 0;
    this.heavyDragTime = 0;
    this.clingKind = null;
    this.clingRate = 0;
    this.clingTaps = 0;
    this.clingTapTime = 0;
    this.env.dragScale = 1;
    this.bestX = 0;
    this.noProgressTime = 0;
    this.lastBounces = 0;
    this.spawner.reset();
    this.spawner.advance(this.rng, this.body.x, 0);
  }

  /** Distance covered since the kick, without the ramp. */
  get flownDistance(): number {
    return Math.max(0, this.body.x - this.equipment.rampLevel * BALANCE.upgradeEffects.rampMetresPerLevel);
  }

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

  /** Next accelerator step, back to ×1 past `maxIndex` (what the level, the pass or a purchase allows). */
  cycleTimeScale(maxIndex: number = BALANCE.timeScale.steps.length - 1): void {
    this.timeScaleIndex = this.timeScaleIndex >= maxIndex ? 0 : this.timeScaleIndex + 1;
  }

  /**
   * A tap during flight. With a clinger on board, three quick taps shake it off; otherwise the tap
   * fires the rocket if a charge is left. Returns true when something happened.
   */
  tap(): boolean {
    if (this.phase !== 'flight') return false;
    if (!this.clingKind) {
      if (this.rocketCharges <= 0 || this.body.rolling) return false;
      const R = BALANCE.upgradeEffects;
      this.rocketCharges--;
      this.rocketsUsed++;
      this.body.vx *= R.rocketBoost;
      this.body.vy = Math.max(this.body.vy, 0) * R.rocketBoost + 5;
      this.body.rolling = false;
      this.boostTime = Math.max(this.boostTime, R.rocketSeconds);
      this.boostKind = 'jet';
      this.events.onRocket?.();
      return true;
    }
    const C = BALANCE.clinger;
    if (this.time - this.clingTapTime > C.tapWindowSeconds) this.clingTaps = 0;
    this.clingTapTime = this.time;
    this.clingTaps++;
    if (this.clingTaps >= C.taps) {
      this.clingKind = null;
      this.clingRate = 0;
      this.clingTaps = 0;
      return true;
    }
    return false;
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
          launch(this.body, launchSpeed(this.aim.power, this.equipment.kickLevel), this.aim.angle);
          this.phase = 'flight';
        }
        return;
      case 'flight':
        this.time += dt;
        this.updateEffects(dt);
        stepBody(this.body, dt, this.events.onBounce, this.env);
        this.collide(dt);
        this.track(dt);
        this.spawner.advance(this.rng, this.body.x, this.body.y);
        this.pool.cull(this.body.x - 200);
        return;
    }
  }

  private updateEffects(dt: number): void {
    if (this.barrierTime > 0) this.barrierTime = Math.max(0, this.barrierTime - dt);
    if (this.barrierCooldown > 0) this.barrierCooldown = Math.max(0, this.barrierCooldown - dt);
    if (this.boostTime > 0) {
      this.boostTime = Math.max(0, this.boostTime - dt);
      if (this.wobble > 0) this.body.vy += Math.sin(this.time * 9) * this.wobble * 12 * dt;
      if (this.boostTime === 0) {
        this.boostKind = null;
        this.wobble = 0;
      }
    }
    if (this.heavyDragTime > 0) this.heavyDragTime = Math.max(0, this.heavyDragTime - dt);
    // Drag: none during the sound barrier or a booster, doubled under a barrel, reduced by the suit.
    const suit = Math.pow(BALANCE.upgradeEffects.suitDragPerLevel, this.equipment.suitLevel);
    this.env.dragScale = this.barrierTime > 0 || this.boostTime > 0 ? 0 : (this.heavyDragTime > 0 ? 2 : 1) * suit;

    if (this.clingKind) {
      const keep = Math.pow(1 - this.clingRate, dt);
      this.body.vx *= keep;
      this.body.vy *= keep;
    }
    for (const e of this.pool.items) if (e.active && e.used) e.usedTime += dt;
  }

  private collide(dt: number): void {
    const b = this.body;
    const P = BALANCE.player;
    const immune = this.barrierTime > 0;
    const bounced = b.bounces !== this.lastBounces;
    this.lastBounces = b.bounces;
    if (b.y > 0 && !b.rolling) this.bouncerChainTick(dt);
    const magnet = this.equipment.magnetLevel * BALANCE.upgradeEffects.magnetRadiusPerLevel;

    for (const e of this.pool.items) {
      if (!e.active || e.used) continue;
      if (e.type === 'coin') {
        if (overlaps(b.x, b.y, P.width, P.height, e, magnet)) {
          e.used = true;
          this.coins += e.value;
          this.coinsPicked++;
          this.events.onCoin?.(e);
        }
        continue;
      }
      if (e.type === 'wall') {
        if (this.prevX < e.x && b.x >= e.x && b.y < e.h && b.y < BALANCE.altitude.tropopause) this.hitWall(e);
        continue;
      }
      if (e.kind === 'trampoline') {
        if (bounced && Math.abs(b.x - e.x) < e.w / 2 + P.width / 2) this.hitBouncer(e);
        continue;
      }
      if (!overlaps(b.x, b.y, P.width, P.height, e)) continue;
      if (e.type === 'bouncer') this.hitBouncer(e);
      else if (e.type === 'booster') this.hitBooster(e);
      else if (e.type === 'obstacle' && !immune) this.hitObstacle(e);
      if (this.phase === 'ended') return;
    }
  }

  private chainTimer = 0;
  private bouncerChainTick(dt: number): void {
    this.chainTimer += dt;
    if (this.chainTimer > 6) this.bouncerChain = 0;
  }

  private hitBouncer(e: Entity): void {
    const def = BALANCE.bouncers[e.kind as BouncerKind];
    const gain = def.gain * Math.pow(BALANCE.solesGainPerLevel, this.equipment.solesLevel);
    const b = this.body;
    b.vy = Math.max(b.vy, 0) + gain;
    b.rolling = false;
    b.onGround = false;
    if (b.y <= 0) b.y = 0.01;
    e.used = true;
    this.chainTimer = 0;
    this.bouncerChain++;
    if (this.bouncerChain > this.bestBouncerChain) this.bestBouncerChain = this.bouncerChain;
    this.events.onBouncer?.(e);
  }

  private hitBooster(e: Entity): void {
    const fx = BALANCE.boosterEffects[e.kind as BoosterKind];
    e.used = true;
    this.coins += fx.coins;
    if (fx.speed !== 1) {
      this.body.vx *= fx.speed;
      this.body.vy *= fx.speed;
    }
    if (fx.seconds > 0) {
      this.boostTime = Math.max(this.boostTime, fx.seconds);
      this.boostKind = e.kind as BoosterKind;
      this.wobble = fx.wobble;
    }
    this.events.onBooster?.(e);
  }

  private hitObstacle(e: Entity): void {
    const kind = e.kind as ObstacleKind;
    const fx = BALANCE.obstacleEffects[kind];
    e.used = true;
    if (fx.fatal) {
      if (this.lawyerCharges > 0) {
        this.lawyerCharges--;
        this.lawyerUsed++;
        this.events.onLawyer?.();
      } else {
        this.fatalKind = kind;
        this.events.onObstacle?.(e);
        this.end('fatal');
        return;
      }
    }
    if (fx.cling > 0 && !this.clingKind) {
      this.clingKind = kind;
      this.clingRate = fx.cling;
      this.clingTaps = 0;
    }
    if (fx.slow > 0) {
      this.body.vx *= 1 - fx.slow;
      this.body.vy *= 1 - fx.slow;
    }
    if (fx.push > 0) this.body.vy = -Math.abs(this.body.vy) - fx.push;
    if (fx.coinLoss > 0) this.coins = Math.floor(this.coins * (1 - fx.coinLoss));
    if (fx.dragSeconds > 0) this.heavyDragTime = Math.max(this.heavyDragTime, fx.dragSeconds);
    this.events.onObstacle?.(e);
  }

  private hitWall(e: Entity): void {
    e.used = true;
    if (this.helmetCharges > 0) {
      this.helmetCharges--;
      this.wallsBroken++;
      this.body.vx *= BALANCE.walls.speedKept;
      this.events.onWall?.(e, true);
    } else {
      this.body.x = e.x - 0.5;
      this.events.onWall?.(e, false);
      this.end('wall');
    }
  }

  private track(dt: number): void {
    const b = this.body;
    const v = speedOf(b);
    if (b.y > this.maxAltitude) this.maxAltitude = b.y;
    if (v > this.maxSpeed) this.maxSpeed = v;

    const SB = BALANCE.soundBarrier;
    if (v >= SB.speed && this.barrierTime === 0 && this.barrierCooldown === 0 && !b.rolling) {
      b.vx *= SB.boost;
      b.vy *= SB.boost;
      this.barrierTime = SB.seconds;
      this.barrierCooldown = SB.seconds + SB.cooldown;
      this.barrierCount++;
      this.events.onSoundBarrier?.();
    }

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

    if (this.phase !== 'flight') return;
    if (b.onGround && v < BALANCE.end.minSpeed) this.end('stopped');
    else if (this.noProgressTime >= BALANCE.end.noProgressSeconds) this.end('noProgress');
  }

  private end(reason: EndReason): void {
    this.phase = 'ended';
    this.endReason = reason;
    this.distanceCoins = distanceCoins(this.distance);
    this.body.vx = 0;
    this.body.vy = 0;
    this.timeScaleIndex = 0;
    this.clingKind = null;
  }
}
