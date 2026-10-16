import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { Rng } from '../src/core/rng';
import { EntityPool, Spawner } from '../src/game/entities';
import { defaultEquipment, Run } from '../src/game/run';

const DT = 1 / BALANCE.loop.physicsHz;

function kickOff(run: Run, power = 1, angle = 43): void {
  run.aim.power = power;
  run.aim.angle = angle;
  run.aiming = true;
  expect(run.release()).toBe(true);
  while (run.phase !== 'flight') run.step(DT);
}

function playToEnd(run: Run, maxSeconds = 300): void {
  for (let i = 0; i < maxSeconds / DT && run.phase !== 'ended'; i++) run.step(DT);
}

describe('profiles', () => {
  it('the starting profile never meets the entrepreneur obstacles', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const pool = new EntityPool();
      const sp = new Spawner(pool, 'depart');
      sp.reset();
      sp.advance(new Rng(seed), 12_000, 50);
      for (const e of pool.items) if (e.active && e.type === 'obstacle') seen.add(e.kind);
    }
    expect(seen.has('urssaf')).toBe(false);
    expect(seen.has('impot')).toBe(false);
    expect(seen.has('baril')).toBe(false);
    expect(seen.size).toBeGreaterThan(0);
    for (const k of seen) expect(BALANCE.profiles.depart.obstacles).toContain(k);
  });

  it('the entrepreneur data never meets the starting profile obstacles', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const pool = new EntityPool();
      const sp = new Spawner(pool, 'entrepreneur');
      sp.reset();
      sp.advance(new Rng(seed), 12_000, 50);
      for (const e of pool.items) if (e.active && e.type === 'obstacle') seen.add(e.kind);
    }
    for (const k of ['militante', 'association', 'helico', 'gendarme']) expect(seen.has(k)).toBe(false);
  });

  it('an obstacle absent from the list never spawns, and the entrepreneur is not playable', () => {
    expect(BALANCE.profiles.entrepreneur.playable).toBe(false);
    expect(BALANCE.profiles.depart.playable).toBe(true);
    expect(BALANCE.profiles.depart.obstacles).not.toContain('scooter');
  });

  it('place boosters follow the country, character boosters follow the profile', () => {
    const pool = new EntityPool();
    const sp = new Spawner(pool, 'entrepreneur');
    sp.reset();
    sp.advance(new Rng(3), 400_000, 50); // up to Spain
    const kinds = new Set<string>();
    for (const e of pool.items) if (e.active && e.type === 'booster') kinds.add(e.kind);
    expect(kinds.has('scooter')).toBe(false);
    expect(kinds.has('video')).toBe(false);
  });
});

describe('spawning', () => {
  it('is deterministic for a seed', () => {
    const snapshot = (seed: number): string => {
      const pool = new EntityPool();
      const sp = new Spawner(pool, 'depart');
      sp.reset();
      sp.advance(new Rng(seed), 3_000, 30);
      return pool.items
        .filter((e) => e.active)
        .map((e) => `${e.type}:${e.kind}:${e.x.toFixed(2)}:${e.y.toFixed(2)}`)
        .join('|');
    };
    expect(snapshot(77)).toBe(snapshot(77));
    expect(snapshot(77)).not.toBe(snapshot(78));
  });

  it('walls appear at the stage interval and only in the troposphere', () => {
    const pool = new EntityPool();
    const sp = new Spawner(pool, 'depart');
    sp.reset();
    sp.advance(new Rng(1), 1_500, 10);
    const walls = pool.items.filter((e) => e.active && e.type === 'wall').map((e) => e.x);
    expect(walls).toContain(230);
    expect(walls).toContain(460);
    expect(walls[0]).toBe(230);

    const high = new EntityPool();
    const hs = new Spawner(high, 'depart');
    hs.reset();
    hs.advance(new Rng(1), 1_500, 20_000);
    expect(high.items.filter((e) => e.active && e.type === 'wall')).toHaveLength(0);
  });

  it('above the tropopause the layer table replaces the country spawns', () => {
    const pool = new EntityPool();
    const sp = new Spawner(pool, 'depart');
    sp.reset();
    sp.advance(new Rng(5), 100_000, 300_000); // orbit
    const kinds = new Set<string>();
    for (const e of pool.items) if (e.active) kinds.add(`${e.type}:${e.kind}`);
    for (const k of kinds) expect(k === 'bouncer:satellite').toBe(true);
  });

  it('culls what is far behind', () => {
    const pool = new EntityPool();
    const sp = new Spawner(pool, 'depart');
    sp.reset();
    sp.advance(new Rng(1), 2_000, 10);
    const before = pool.countActive();
    pool.cull(1_500);
    expect(pool.countActive()).toBeLessThan(before);
    for (const e of pool.items) if (e.active) expect(e.x + e.w).toBeGreaterThanOrEqual(1_500);
  });
});

describe('distance coins', () => {
  it('pays one coin every distanceCoinEvery metres up to linearUntil, then sub-linearly', async () => {
    const { distanceCoins } = await import('../src/config/balance');
    const { distanceCoinEvery: every, linearUntil } = BALANCE.economy;
    const linear = linearUntil / every;
    expect(distanceCoins(0)).toBe(0);
    expect(distanceCoins(459)).toBe(Math.floor(459 / every));
    expect(distanceCoins(linearUntil)).toBe(linear);
    expect(distanceCoins(2 * linearUntil)).toBeLessThan(2 * linear);
    expect(distanceCoins(2 * linearUntil)).toBeGreaterThan(linear);
    expect(distanceCoins(10_000_000)).toBeGreaterThan(distanceCoins(1_000_000));
  });
});

describe('walls and helmets', () => {
  function wallAt(run: Run, x: number, h = 50): void {
    const e = run.pool.alloc()!;
    e.type = 'wall';
    e.kind = 'wall';
    e.x = x;
    e.y = 0;
    e.w = 3;
    e.h = h;
  }

  it('without a helmet, the wall ends the run on the spot', () => {
    const run = new Run(11, defaultEquipment());
    run.pool.clear();
    wallAt(run, 120, 200);
    kickOff(run);
    playToEnd(run);
    expect(run.endReason).toBe('wall');
    expect(run.distance).toBeLessThan(121);
  });

  it('with a helmet, the wall breaks, one charge goes and speed drops by 15 %', () => {
    const run = new Run(11, { ...defaultEquipment(), helmetCharges: 1 });
    run.pool.clear();
    wallAt(run, 120, 200);
    wallAt(run, 300, 200);
    kickOff(run);
    let vxBefore = 0;
    let checked = false;
    while (run.phase !== 'ended') {
      if (!checked && run.body.x < 120) vxBefore = run.body.vx;
      if (!checked && run.body.x >= 120) {
        checked = true;
        expect(run.body.vx).toBeCloseTo(vxBefore * BALANCE.walls.speedKept, 1);
        expect(run.helmetCharges).toBe(0);
        expect(run.wallsBroken).toBe(1);
      }
      run.step(DT);
    }
    expect(run.endReason).toBe('wall'); // the second wall, helmet consumed
  });

  it('a wall is passed over when the flight is higher than it', () => {
    const run = new Run(11, defaultEquipment());
    run.pool.clear();
    wallAt(run, 250, 10);
    kickOff(run, 1, 43);
    playToEnd(run);
    expect(run.endReason).not.toBe('wall');
  });
});

describe('obstacles and boosters', () => {
  function put(run: Run, type: 'obstacle' | 'booster' | 'bouncer', kind: string, x: number, y: number): void {
    const e = run.pool.alloc()!;
    e.type = type;
    e.kind = kind;
    e.x = x;
    e.y = y;
    e.w = 40;
    e.h = 400;
  }

  it('the gendarme is fatal with its own text, unless the lawyer is equipped', () => {
    const run = new Run(2, defaultEquipment());
    run.pool.clear();
    put(run, 'obstacle', 'gendarme', 100, 0);
    kickOff(run);
    playToEnd(run);
    expect(run.endReason).toBe('fatal');
    expect(run.fatalKind).toBe('gendarme');

    const saved = new Run(2, { ...defaultEquipment(), lawyerCharges: 1 });
    saved.pool.clear();
    put(saved, 'obstacle', 'gendarme', 100, 0);
    kickOff(saved);
    playToEnd(saved);
    expect(saved.endReason).not.toBe('fatal');
    expect(saved.lawyerUsed).toBe(1);
  });

  it('the radar takes 30 % of the coins of the run', () => {
    const run = new Run(2, defaultEquipment());
    run.pool.clear();
    put(run, 'booster', 'sacoche', 60, 0);
    put(run, 'obstacle', 'radar', 150, 0);
    kickOff(run);
    playToEnd(run);
    expect(run.coins).toBe(Math.floor(60 * 0.7));
  });

  it('a clinger slows the run until three quick taps', () => {
    const run = new Run(2, defaultEquipment());
    run.pool.clear();
    put(run, 'obstacle', 'militante', 80, 0);
    kickOff(run);
    while (run.phase === 'flight' && !run.clingKind) run.step(DT);
    expect(run.clingKind).toBe('militante');
    const v0 = Math.hypot(run.body.vx, run.body.vy);
    for (let i = 0; i < 0.5 / DT; i++) run.step(DT);
    const v1 = Math.hypot(run.body.vx, run.body.vy);
    expect(v1).toBeLessThan(v0 * 0.97);
    expect(run.tap()).toBe(false);
    expect(run.tap()).toBe(false);
    expect(run.tap()).toBe(true);
    expect(run.clingKind).toBeNull();
  });

  it('a bouncer adds vertical speed, scaled by the soles level', () => {
    const base = new Run(4, defaultEquipment());
    base.pool.clear();
    put(base, 'bouncer', 'pigeon', 100, 0);
    kickOff(base);
    playToEnd(base);
    const soles = new Run(4, { ...defaultEquipment(), solesLevel: 4 });
    soles.pool.clear();
    put(soles, 'bouncer', 'pigeon', 100, 0);
    kickOff(soles);
    playToEnd(soles);
    expect(base.bestBouncerChain).toBe(1);
    expect(soles.maxAltitude).toBeGreaterThan(base.maxAltitude);
  });

  it('a speed booster multiplies the velocity and removes drag for its duration', () => {
    const run = new Run(4, defaultEquipment());
    run.pool.clear();
    put(run, 'booster', 'video', 100, 0);
    kickOff(run);
    let before = 0;
    while (run.phase === 'flight' && run.boostKind === null) {
      before = Math.hypot(run.body.vx, run.body.vy);
      run.step(DT);
    }
    expect(run.boostKind).toBe('video');
    expect(Math.hypot(run.body.vx, run.body.vy)).toBeGreaterThan(before * 1.7);
    expect(run.boostTime).toBeCloseTo(BALANCE.boosterEffects.video.seconds, 1);
  });

  it('the sound barrier makes the character immune to obstacles', () => {
    const run = new Run(4, defaultEquipment());
    run.pool.clear();
    put(run, 'obstacle', 'gendarme', 100, 0);
    kickOff(run);
    run.body.vx = 400; // breaks the barrier on the next step
    run.step(DT);
    expect(run.barrierTime).toBeGreaterThan(0);
    for (let i = 0; i < 1 / DT && run.phase === 'flight'; i++) run.step(DT);
    expect(run.endReason).not.toBe('fatal');
  });
});
