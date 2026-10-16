import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { giftAmount, giftCooldown, levelFromXp, upgradePrice, xpForRun, xpNeeded } from '../src/game/progress';
import { defaultEquipment, Run } from '../src/game/run';
import { defaultSave, migrate } from '../src/game/save';

const DT = 1 / BALANCE.loop.physicsHz;

function kickOff(run: Run, power = 1, angle = 43): void {
  run.aim.power = power;
  run.aim.angle = angle;
  run.aiming = true;
  run.release();
  while (run.phase !== 'flight') run.step(DT);
}

function playToEnd(run: Run): void {
  for (let i = 0; i < 300 / DT && run.phase !== 'ended'; i++) run.step(DT);
}

describe('xp and levels', () => {
  it('follows distance ÷ 15 + coins ÷ 4, with the distance soft-capped', () => {
    expect(xpForRun(300, 40)).toBe(30);
    expect(xpForRun(20_000, 0)).toBe(Math.floor(20_000 / 15));
    const far = xpForRun(10_000_000, 0);
    expect(far).toBeLessThan(10_000_000 / 15 / 10);
    expect(far).toBeGreaterThan(xpForRun(1_000_000, 0));
  });

  it('level n costs 120 × n^1.55 and stops at 30', () => {
    expect(xpNeeded(1)).toBe(120);
    expect(xpNeeded(2)).toBe(Math.round(120 * Math.pow(2, 1.55)));
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(xpNeeded(2)).level).toBe(2);
    expect(levelFromXp(xpNeeded(2) - 1).level).toBe(1);
    expect(levelFromXp(1e12).level).toBe(BALANCE.xp.maxLevel);
    expect(levelFromXp(1e12).needed).toBe(0);
  });

  it('a desert flight does not give thirty levels at once', () => {
    expect(levelFromXp(xpForRun(10_000_000, 5_000)).level).toBeLessThan(20);
  });
});

describe('shop', () => {
  it('prices grow by the table multiplier', () => {
    const F = BALANCE.upgrades.force;
    const A = BALANCE.upgrades.avocat;
    expect(upgradePrice('force', 0)).toBe(F.price);
    expect(upgradePrice('force', 1)).toBe(Math.round(F.price * F.growth));
    expect(upgradePrice('avocat', 2)).toBe(Math.round(A.price * A.growth * A.growth));
  });

  it('the free gift comes back every 4 hours and never blocks', () => {
    const now = 1_000_000_000_000;
    expect(giftCooldown(0, now)).toBe(0);
    expect(giftCooldown(now, now)).toBeCloseTo(4 * 3600);
    expect(giftCooldown(now - 3 * 3600 * 1000, now)).toBeCloseTo(3600);
    expect(giftAmount(1)).toBe(35);
  });
});

describe('save migration', () => {
  it('upgrades a v1 save without losing coins or the helmet', () => {
    const old = { version: 1, bestDistance: 800, coins: 55, helmet: { id: 'passoire', charges: 1 } };
    const s = migrate(old);
    expect(s.version).toBe(BALANCE.save.schemaVersion);
    expect(s.coins).toBe(55);
    expect(s.totalCoins).toBe(55);
    expect(s.helmet).toEqual({ id: 'passoire', charges: 1 });
    expect(s.upgrades.force).toBe(0);
    expect(s.xp).toBe(0);
    expect(s.lastGift).toBe(0);
  });

  it('clamps upgrade levels to the table', () => {
    const s = migrate({ ...defaultSave(), upgrades: { force: 99, semelles: -3 } });
    expect(s.upgrades.force).toBe(BALANCE.upgrades.force.levels);
    expect(s.upgrades.semelles).toBe(0);
  });
});

describe('equipment in a run', () => {
  it('the ramp starts the run further and the distance counts it', () => {
    const run = new Run(1, { ...defaultEquipment(), rampLevel: 2 });
    expect(run.body.x).toBe(400);
    kickOff(run);
    playToEnd(run);
    expect(run.distance).toBeGreaterThan(400 + 200);
    expect(run.flownDistance).toBeLessThan(run.distance);
  });

  it('the suit reduces drag so the same kick goes further', () => {
    const base = new Run(1, defaultEquipment());
    base.emptyWorld();
    kickOff(base);
    playToEnd(base);
    const suit = new Run(1, { ...defaultEquipment(), suitLevel: 8 });
    suit.emptyWorld();
    kickOff(suit);
    playToEnd(suit);
    expect(suit.distance).toBeGreaterThan(base.distance * 1.1);
  });

  it('a tap fires the rocket when no clinger is on board, once per charge', () => {
    const run = new Run(1, { ...defaultEquipment(), rocketCharges: 1 });
    run.emptyWorld();
    kickOff(run);
    for (let i = 0; i < 0.5 / DT; i++) run.step(DT);
    const v = Math.hypot(run.body.vx, run.body.vy);
    expect(run.tap()).toBe(true);
    expect(Math.hypot(run.body.vx, run.body.vy)).toBeGreaterThan(v * 1.8);
    expect(run.rocketCharges).toBe(0);
    expect(run.tap()).toBe(false);
  });

  it('the magnet picks up coins from further away', () => {
    // Find where the character passes x = 100, then hang a coin 3 m above its head.
    const probe = new Run(1, defaultEquipment());
    probe.emptyWorld();
    kickOff(probe, 1, 20);
    while (probe.phase === 'flight' && probe.body.x < 100) probe.step(DT);
    const coinY = probe.body.y + BALANCE.player.height + 3;
    const place = (run: Run): void => {
      run.emptyWorld();
      const e = run.pool.alloc()!;
      e.type = 'coin';
      e.kind = 'coin';
      e.x = 100;
      e.y = coinY;
      e.w = 1;
      e.h = 1;
      e.value = 3;
    };
    const none = new Run(1, defaultEquipment());
    place(none);
    kickOff(none, 1, 20);
    playToEnd(none);
    expect(none.coinsPicked).toBe(0);
    const magnet = new Run(1, { ...defaultEquipment(), magnetLevel: 8 });
    place(magnet);
    kickOff(magnet, 1, 20);
    playToEnd(magnet);
    expect(magnet.coinsPicked).toBe(1);
    expect(magnet.coins).toBe(3);
  });

  it('coins spawn in clusters with a face value that grows along the track', () => {
    const run = new Run(3, defaultEquipment());
    const early = run.pool.items.filter((e) => e.active && e.type === 'coin');
    expect(early.length).toBeGreaterThan(0);
    expect(early[0]!.value).toBe(1);
  });
});
