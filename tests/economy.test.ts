import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { Rng } from '../src/core/rng';
import { pending, setAnalyticsSink, track } from '../src/core/analytics';
import {
  buyCoinPack,
  buyGadget,
  buyTimeScale,
  coinMultiplier,
  consumeGadgets,
  dayIndex,
  gadgetBonuses,
  grantStarsProduct,
  maxTimeScaleIndex,
  nextTimeScaleUnlock,
  passActive,
  starsLeftToday,
  starterAvailable,
  startBoostWindow,
} from '../src/game/premium';
import {
  claimChallenge,
  dailyChallenges,
  nearMiss,
  progressChallenges,
  recordRun,
  returnBonus,
  runBonus,
  spinWheel,
  syncChallenges,
  touchStreak,
  wheelAvailable,
} from '../src/game/retention';
import { defaultSave, migrate } from '../src/game/save';
import { STAGES } from '../src/game/world';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 16, 12);

describe('time accelerator', () => {
  it('opens with the level, the pass or a purchase, never all at once for free', () => {
    const save = defaultSave();
    expect(maxTimeScaleIndex(save, NOW)).toBe(0);
    save.level = 3;
    expect(maxTimeScaleIndex(save, NOW)).toBe(1);
    save.level = 20;
    expect(maxTimeScaleIndex(save, NOW)).toBe(3);
    const fresh = defaultSave();
    fresh.level = 5;
    fresh.premium.passUntil = NOW + DAY;
    expect(maxTimeScaleIndex(fresh, NOW)).toBe(BALANCE.timeScale.passIndex);
    expect(maxTimeScaleIndex(fresh, NOW + 2 * DAY)).toBe(1);
  });

  it('sells the next step in billets', () => {
    const save = defaultSave();
    save.level = 3;
    const next = nextTimeScaleUnlock(save, NOW)!;
    expect(next.index).toBe(2);
    expect(buyTimeScale(save, NOW)).toBe(false);
    save.premium.billets = next.billets;
    expect(buyTimeScale(save, NOW)).toBe(true);
    expect(save.premium.billets).toBe(0);
    expect(maxTimeScaleIndex(save, NOW)).toBe(2);
  });
});

describe('premium purchases', () => {
  it('grants billets, the pass and the starter pack, under the daily cap', () => {
    const save = defaultSave();
    const pack = BALANCE.premium.billetPacks[1]!;
    grantStarsProduct(save, pack.id, NOW);
    expect(save.premium.billets).toBe(pack.billets + pack.bonus);
    expect(starsLeftToday(save, NOW)).toBe(BALANCE.premium.dailyStarsCap - pack.stars);
    expect(starsLeftToday(save, NOW + DAY)).toBe(BALANCE.premium.dailyStarsCap);
    grantStarsProduct(save, 'pass', NOW);
    expect(passActive(save, NOW + 29 * DAY)).toBe(true);
    expect(passActive(save, NOW + 31 * DAY)).toBe(false);
    expect(coinMultiplier(save, NOW)).toBe(BALANCE.premium.pass.coinMultiplier);
    // A second pass stacks after the first.
    grantStarsProduct(save, 'pass', NOW);
    expect(passActive(save, NOW + 59 * DAY)).toBe(true);
    expect(save.premium.purchases).toBe(3);
  });

  it('offers the starter pack once, after a stall, for a limited time', () => {
    const save = defaultSave();
    save.bestDistance = 1000;
    expect(starterAvailable(save, NOW)).toBe(false);
    for (let i = 0; i < BALANCE.retention.stallRuns; i++) runBonus(save, NOW, 100, 1000, NOW, true);
    expect(save.premium.starterOfferedAt).toBe(NOW);
    expect(starterAvailable(save, NOW + 3_600_000)).toBe(true);
    expect(starterAvailable(save, NOW + (BALANCE.premium.starter.hours + 1) * 3_600_000)).toBe(false);
    grantStarsProduct(save, 'starter', NOW);
    expect(starterAvailable(save, NOW)).toBe(false);
    expect(save.premium.billets).toBe(BALANCE.premium.starter.billets);
  });

  it('turns billets into coins and gadgets, and gadgets into one-run equipment', () => {
    const save = defaultSave();
    save.premium.billets = 100;
    const pack = BALANCE.premium.coinPacks[0]!;
    expect(buyCoinPack(save, pack)).toBe(true);
    expect(save.coins).toBe(pack.coinsBase + pack.coinsPerLevel * save.level);
    expect(buyGadget(save, 'fusee_longue', 'billets')).toBe(true);
    expect(buyGadget(save, 'aimant_geant', 'coins')).toBe(true);
    expect(buyGadget(save, 'bouclier', 'coins')).toBe(false);
    const bonus = gadgetBonuses(save);
    expect(bonus.rockets).toBe(2);
    expect(bonus.magnet).toBe(4);
    expect(consumeGadgets(save).sort()).toEqual(['aimant_geant', 'fusee_longue']);
    expect(gadgetBonuses(save).rockets).toBe(0);
    expect(consumeGadgets(save)).toEqual([]);
  });

  it('measures a purchase against the runs before it', () => {
    const save = defaultSave();
    for (const d of [100, 200, 300]) recordRun(save, d);
    startBoostWindow(save);
    expect(save.retention.boostBaseline).toBe(200);
    expect(save.retention.boostRuns).toBe(BALANCE.premium.boostRuns);
    for (let i = 0; i < 10; i++) recordRun(save, i);
    expect(save.retention.recent.length).toBe(BALANCE.premium.recentRuns);
  });
});

describe('daily loops', () => {
  it('advances the streak once a day, forgives one missed day, resets after two', () => {
    const save = defaultSave();
    expect(touchStreak(save, NOW)!.day).toBe(1);
    expect(touchStreak(save, NOW + 3_600_000)).toBeNull();
    expect(touchStreak(save, NOW + DAY)!.day).toBe(2);
    expect(touchStreak(save, NOW + 3 * DAY)!.day).toBe(3);
    expect(touchStreak(save, NOW + 6 * DAY)!.day).toBe(1);
    for (let i = 7; i < 20; i++) touchStreak(save, NOW + i * DAY);
    expect(save.daily.streakDay).toBe(BALANCE.streak.coinsBase.length);
    expect(save.coins).toBeGreaterThan(0);
  });

  it('spins the wheel once a day and pays what the segment says', () => {
    const save = defaultSave();
    expect(wheelAvailable(save, NOW)).toBe(true);
    const r = spinWheel(save, NOW, new Rng(5))!;
    const seg = BALANCE.wheel.segments[r.index]!;
    expect(r.reward.coins).toBe(seg.coinsBase + seg.coinsPerLevel * save.level);
    expect(save.coins).toBe(r.reward.coins);
    expect(save.premium.billets).toBe(r.reward.billets);
    expect(spinWheel(save, NOW, new Rng(6))).toBeNull();
    expect(wheelAvailable(save, NOW + DAY)).toBe(true);
    // Weighted draw: every segment comes out over many spins, jackpots rarely.
    const counts = new Array<number>(BALANCE.wheel.segments.length).fill(0);
    const rng = new Rng(1);
    for (let i = 0; i < 4000; i++) {
      const s = defaultSave();
      counts[spinWheel(s, NOW, rng)!.index]!++;
    }
    expect(counts.every((c) => c > 0)).toBe(true);
    expect(counts[counts.length - 1]!).toBeLessThan(counts[0]!);
  });

  it('draws the same three challenges for a day, tracks them and pays once', () => {
    const save = defaultSave();
    save.bestDistance = 2000;
    const day = dayIndex(NOW);
    const a = dailyChallenges(day, save);
    const b = dailyChallenges(day, save);
    expect(a).toEqual(b);
    expect(a.length).toBe(BALANCE.challenges.perDay);
    expect(new Set(a.map((c) => c.kind)).size).toBe(a.length);
    syncChallenges(save, NOW);
    expect(save.daily.challengeDay).toBe(day);
    const done = progressChallenges(save, NOW, { distance: 1e9, maxAltitude: 1e9, coinsPicked: 1e6, bestChain: 100, wallsBroken: 100 });
    expect(done.length).toBeGreaterThan(0);
    const reward = claimChallenge(save, done[0]!)!;
    expect(reward.coins).toBeGreaterThan(0);
    expect(claimChallenge(save, done[0]!)).toBeNull();
    // A new day resets the board.
    syncChallenges(save, NOW + DAY);
    expect(save.daily.challengeProgress.every((p) => p === 0)).toBe(true);
  });
});

describe('anti-churn rules', () => {
  it('pays a chest after three runs without progress, then starts again', () => {
    const save = defaultSave();
    const start = save.coins;
    expect(runBonus(save, NOW, 50, 1000, NOW, true)).toBeNull();
    expect(runBonus(save, NOW, 50, 1000, NOW, true)).toBeNull();
    expect(runBonus(save, NOW, 50, 1000, NOW, true)!.kind).toBe('stall');
    expect(save.coins).toBeGreaterThan(start);
    expect(save.retention.stallRuns).toBe(0);
    // A good run resets the count.
    runBonus(save, NOW, 50, 1000, NOW, true);
    expect(runBonus(save, NOW, 950, 1000, NOW, true)).toBeNull();
    expect(save.retention.stallRuns).toBe(0);
  });

  it('rains coins once per long session', () => {
    const save = defaultSave();
    const start = NOW - BALANCE.retention.sessionMinutes * 60_000;
    expect(runBonus(save, NOW, 1000, 0, start, false)!.kind).toBe('session');
    expect(runBonus(save, NOW, 1000, 0, start, true)).toBeNull();
  });

  it('welcomes a player back after days away, not the next morning', () => {
    const save = defaultSave();
    expect(returnBonus(save, NOW)).toBeNull();
    expect(returnBonus(save, NOW + DAY)).toBeNull();
    const back = returnBonus(save, NOW + 1 * DAY + BALANCE.retention.returnDays * DAY)!;
    expect(back.kind).toBe('return');
    expect(save.premium.billets).toBe(BALANCE.retention.returnBillets);
  });

  it('names the next country when the run ended just short of it', () => {
    const paris = STAGES.find((s) => s.id === 'paris')!;
    expect(nearMiss(paris.from - 10)).toEqual({ metres: 10, stageId: 'paris' });
    expect(nearMiss(paris.from - 1000)).toBeNull();
    expect(nearMiss(1e12)).toBeNull();
  });
});

describe('save v4', () => {
  it('migrates a v3 save with zero billets and keeps the premium state afterwards', () => {
    const old = migrate({ version: 3, bestDistance: 500, coins: 40 });
    expect(old.premium.billets).toBe(0);
    expect(old.daily.streakDay).toBe(0);
    const save = defaultSave();
    save.premium.billets = 12;
    save.premium.gadgets.bouclier = 99;
    save.premium.passUntil = NOW;
    save.daily.streakDay = 5;
    const again = migrate(JSON.parse(JSON.stringify(save)));
    expect(again.premium.billets).toBe(12);
    expect(again.premium.gadgets.bouclier).toBe(BALANCE.premium.gadgetMax);
    expect(again.premium.passUntil).toBe(NOW);
    expect(again.daily.streakDay).toBe(5);
  });
});

describe('analytics', () => {
  it('queues anonymous events and hands them to the sink', () => {
    track('test_event', { a: 1 });
    expect(pending().some((e) => e.name === 'test_event')).toBe(true);
    const received: string[] = [];
    setAnalyticsSink((events) => received.push(...events.map((e) => e.name)));
    expect(received).toContain('test_event');
    expect(pending().length).toBe(0);
    setAnalyticsSink(null);
  });
});
