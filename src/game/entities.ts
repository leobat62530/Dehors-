import { BALANCE } from '../config/balance';
import type { Rng } from '../core/rng';
import { LAYERS, layerIndexAt, STAGES, stageAt, stageIndexAt } from './world';

export type BouncerKind = keyof typeof BALANCE.bouncers;
export type BoosterKind = keyof typeof BALANCE.boosterEffects;
export type ObstacleKind = keyof typeof BALANCE.obstacleEffects;
export type ProfileId = keyof typeof BALANCE.profiles;
export type HelmetId = (typeof BALANCE.helmets)[number]['id'];

export type EntityType = 'bouncer' | 'booster' | 'obstacle' | 'wall' | 'coin';

/** One pooled world object. Fields are reused, nothing is allocated during a run. */
export interface Entity {
  active: boolean;
  type: EntityType;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Consumed: popped balloon, taken booster, triggered obstacle, broken wall. */
  used: boolean;
  /** Visual variation and wall skin. */
  seed: number;
  stageIndex: number;
  /** Seconds since consumed, for the pop or shatter animation. */
  usedTime: number;
  /** Face value of a coin. */
  value: number;
}

const POOL_SIZE = 320;

function blank(): Entity {
  return { active: false, type: 'bouncer', kind: '', x: 0, y: 0, w: 0, h: 0, used: false, seed: 0, stageIndex: 0, usedTime: 0, value: 0 };
}

export class EntityPool {
  readonly items: Entity[] = [];

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) this.items.push(blank());
  }

  alloc(): Entity | null {
    for (let i = 0; i < this.items.length; i++) {
      const e = this.items[i] as Entity;
      if (!e.active) {
        e.active = true;
        e.used = false;
        e.usedTime = 0;
        return e;
      }
    }
    return null;
  }

  clear(): void {
    for (const e of this.items) e.active = false;
  }

  /** Free everything behind `minX`. */
  cull(minX: number): void {
    for (const e of this.items) if (e.active && e.x + e.w < minX) e.active = false;
  }

  countActive(type?: EntityType): number {
    let n = 0;
    for (const e of this.items) if (e.active && (!type || e.type === type)) n++;
    return n;
  }
}

type StageSpawn = (typeof BALANCE.spawn.stages)[keyof typeof BALANCE.spawn.stages];

function pickWeighted(rng: Rng, weights: Record<string, number>): string | null {
  let total = 0;
  for (const k in weights) total += weights[k] as number;
  if (total <= 0) return null;
  let r = rng.next() * total;
  for (const k in weights) {
    r -= weights[k] as number;
    if (r < 0) return k;
  }
  return null;
}

function poisson(rng: Rng, expected: number): number {
  const base = Math.floor(expected);
  return base + (rng.next() < expected - base ? 1 : 0);
}

/**
 * Procedural generator. Fills the pool chunk by chunk ahead of the character, from the run's
 * seeded generator, so the same seed and trajectory give the same world.
 */
export class Spawner {
  private generatedX = 0;
  private nextWallX = 0;

  constructor(
    private readonly pool: EntityPool,
    private readonly profile: ProfileId,
  ) {}

  reset(): void {
    this.generatedX = 0;
    this.nextWallX = BALANCE.spawn.stages.arras.wallEvery;
    this.pool.clear();
  }

  /** Stops generation for good (tests build their own world). `reset` re-arms it. */
  freeze(): void {
    this.generatedX = Number.POSITIVE_INFINITY;
  }

  /** Before the kick: only the first metres exist, so what comes next can follow the real trajectory. */
  prime(rng: Rng, frontX: number): void {
    const S = BALANCE.spawn;
    while (this.generatedX < frontX + S.lookaheadStart) {
      this.chunk(rng, this.generatedX, 0);
      this.generatedX += S.chunk;
    }
  }

  /**
   * Generate everything up to `frontX + lookahead`. Aerial spawns sit around the path the
   * character will follow from (frontX, y) at velocity (vx, vy), so bonuses are where it flies.
   */
  advance(rng: Rng, frontX: number, y: number, vx = 0, vy = 0): void {
    const S = BALANCE.spawn;
    const target = frontX + S.lookahead;
    while (this.generatedX < target) {
      this.chunk(rng, this.generatedX, predictY(frontX, y, vx, vy, this.generatedX + S.chunk / 2));
      this.generatedX += S.chunk;
    }
  }

  private chunk(rng: Rng, cx: number, y: number): void {
    const S = BALANCE.spawn;
    const stage = stageAt(cx);
    const stageIndex = stageIndexAt(cx);
    const table: StageSpawn = S.stages[stage.id];
    const inTroposphere = y < BALANCE.altitude.tropopause;
    const layer = LAYERS[layerIndexAt(y)] ?? LAYERS[0]!;
    const spread = S.airSpreadBase + y * S.airSpreadFactor;
    const bandTop = y + spread;
    const bandBottom = Math.max(2, y - spread);
    const scale = S.chunk / 100;
    const size = S.sizes.scale;

    // Bouncers: the country's table in the troposphere, the layer's table above.
    const bouncerTable = inTroposphere ? table.kinds : S.layers[layer.id].kinds;
    const bouncerDensity = (inTroposphere ? table.bouncers : S.layers[layer.id].bouncers) * S.densityScale.bouncers;
    const nb = poisson(rng, bouncerDensity * scale);
    for (let i = 0; i < nb; i++) {
      const kind = pickWeighted(rng, bouncerTable as Record<string, number>) as BouncerKind | null;
      if (!kind) continue;
      const def = BALANCE.bouncers[kind];
      this.place('bouncer', kind, rng.range(cx, cx + S.chunk), rng.range(bandBottom, bandTop), def.w * size, def.h * size, rng, stageIndex);
    }

    if (inTroposphere) {
      // Ground trampolines replace a missed bounce.
      if (rng.next() < S.trampolinePerChunk) {
        const def = BALANCE.bouncers.trampoline;
        this.place('bouncer', 'trampoline', rng.range(cx, cx + S.chunk), 0, def.w, def.h, rng, stageIndex);
      }

      // Boosters: the character's own, plus the country's.
      const profile = BALANCE.profiles[this.profile];
      const placeList = (BALANCE.placeBoosters as Record<string, readonly string[]>)[stage.id];
      const nBoost = poisson(rng, table.boosters * S.densityScale.boosters * scale);
      for (let i = 0; i < nBoost; i++) {
        let kind: string;
        if (placeList && placeList.length > 0 && rng.next() < S.placeBoosterShare) {
          kind = placeList[rng.int(0, placeList.length - 1)] as string;
        } else {
          kind = profile.boosters[rng.int(0, profile.boosters.length - 1)] as string;
        }
        this.place('booster', kind, rng.range(cx, cx + S.chunk), rng.range(bandBottom, bandTop), S.sizes.booster.w * size, S.sizes.booster.h * size, rng, stageIndex);
      }

      // Obstacles: only the kinds of the character in play, harder ones more frequent along the track.
      const nObs = poisson(rng, table.obstacles * S.densityScale.obstacles * scale);
      const progress = Math.min(1, stageIndex / (STAGES.length - 1));
      const hardShare = S.hardShareStart + (S.hardShareEnd - S.hardShareStart) * progress;
      for (let i = 0; i < nObs; i++) {
        const hard = rng.next() < hardShare;
        const candidates = profile.obstacles.filter((k) => {
          const fx = BALANCE.obstacleEffects[k as ObstacleKind];
          return hard ? fx.fatal || fx.coinLoss > 0 : !fx.fatal && fx.coinLoss === 0;
        });
        if (candidates.length === 0) continue;
        const kind = candidates[rng.int(0, candidates.length - 1)] as string;
        this.place('obstacle', kind, rng.range(cx, cx + S.chunk), rng.range(bandBottom, bandTop), S.sizes.obstacle.w * size, S.sizes.obstacle.h * size, rng, stageIndex);
      }

      // Coin clusters: a short line or arc, face value growing with the stage.
      const E = BALANCE.economy;
      const nClusters = poisson(rng, E.clustersPer100m * scale);
      const value = 1 + Math.floor(stageIndex * E.valuePerStage);
      for (let c = 0; c < nClusters; c++) {
        const n = rng.int(E.clusterMin, E.clusterMax);
        const x0 = rng.range(cx, cx + S.chunk);
        const y0 = rng.range(bandBottom, bandTop);
        const arc = rng.next() < 0.5;
        for (let i = 0; i < n; i++) {
          const yy = arc ? y0 + Math.sin((i / (n - 1)) * Math.PI) * 4 : y0;
          const e = this.pool.alloc();
          if (!e) break;
          e.type = 'coin';
          e.kind = 'coin';
          e.x = x0 + i * S.sizes.coin * 1.7 * size;
          e.y = yy;
          e.w = S.sizes.coin * size;
          e.h = S.sizes.coin * size;
          e.seed = rng.next();
          e.stageIndex = stageIndex;
          e.value = value;
        }
      }

      // Walls, at the stage's interval. They only exist in the troposphere.
      while (this.nextWallX < cx + S.chunk) {
        const wallStage = S.stages[stageAt(this.nextWallX).id];
        this.place('wall', 'wall', this.nextWallX, 0, BALANCE.walls.thickness, wallStage.wallHeight, rng, stageIndexAt(this.nextWallX));
        this.nextWallX += wallStage.wallEvery;
      }
    }
  }

  private place(type: EntityType, kind: string, x: number, y: number, w: number, h: number, rng: Rng, stageIndex: number): void {
    const e = this.pool.alloc();
    if (!e) return;
    e.type = type;
    e.kind = kind;
    e.x = x;
    e.y = y;
    e.w = w;
    e.h = h;
    e.seed = rng.next();
    e.stageIndex = stageIndex;
  }
}

/** Altitude of a ballistic path from (x0, y0) at (vx, vy) when it reaches `x`; the start altitude when not moving forward. */
export function predictY(x0: number, y0: number, vx: number, vy: number, x: number): number {
  if (vx < 1) return Math.max(0, y0);
  const t = Math.max(0, (x - x0) / vx);
  return Math.max(0, y0 + vy * t - 0.5 * BALANCE.physics.gravity * t * t);
}

/** Axis-aligned overlap between the character box and an entity box (both bottom-centre anchored), grown by `pad` metres. */
export function overlaps(px: number, py: number, pw: number, ph: number, e: Entity, pad = 0): boolean {
  return (
    px + pw / 2 + pad > e.x - e.w / 2 && px - pw / 2 - pad < e.x + e.w / 2 && py + ph + pad > e.y && py - pad < e.y + e.h
  );
}
