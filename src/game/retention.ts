import { BALANCE } from '../config/balance';
import { Rng } from '../core/rng';
import { addBillets, dayIndex, stallChest } from './premium';
import { giftAmount } from './progress';
import type { SaveData } from './save';
import { STAGES } from './world';

/**
 * Daily loops and anti-churn rules: login streak, free wheel, daily challenges, bonuses paid when
 * the behaviour says the player is about to leave. Pure functions on the save.
 */

export interface Reward {
  coins: number;
  billets: number;
}

function pay(save: SaveData, r: Reward): void {
  save.coins += r.coins;
  save.totalCoins += r.coins;
  if (r.billets > 0) addBillets(save, r.billets);
}

// ---- streak ------------------------------------------------------------------

export function streakReward(day: number, level: number): Reward {
  const S = BALANCE.streak;
  const i = Math.min(S.coinsBase.length, Math.max(1, day)) - 1;
  return { coins: (S.coinsBase[i] ?? 0) + (S.coinsPerLevel[i] ?? 0) * level, billets: S.billets[i] ?? 0 };
}

/** First visit of the day: advance or reset the streak and pay the day's reward. Null on later visits. */
export function touchStreak(save: SaveData, now: number): { day: number; reward: Reward } | null {
  const today = dayIndex(now);
  const d = save.daily;
  if (d.streakLastDay === today) return null;
  const gap = today - d.streakLastDay;
  const max = BALANCE.streak.coinsBase.length;
  d.streakDay = d.streakLastDay === 0 || gap > BALANCE.streak.graceDays + 1 ? 1 : Math.min(max, d.streakDay + 1);
  d.streakLastDay = today;
  const reward = streakReward(d.streakDay, save.level);
  pay(save, reward);
  return { day: d.streakDay, reward };
}

// ---- wheel ---------------------------------------------------------------------

export type WheelSegment = (typeof BALANCE.wheel.segments)[number];

export function wheelAvailable(save: SaveData, now: number): boolean {
  return save.daily.wheelDay !== dayIndex(now);
}

export function wheelReward(segment: WheelSegment, level: number): Reward {
  return { coins: segment.coinsBase + segment.coinsPerLevel * level, billets: segment.billets };
}

/** Pick a segment by weight. The reward is paid at once; the UI only animates towards it. */
export function spinWheel(save: SaveData, now: number, rng: Rng): { index: number; reward: Reward } | null {
  if (!wheelAvailable(save, now)) return null;
  const segments = BALANCE.wheel.segments;
  const total = segments.reduce((a, s) => a + s.weight, 0);
  let roll = rng.next() * total;
  let index = segments.length - 1;
  for (let i = 0; i < segments.length; i++) {
    roll -= segments[i]!.weight;
    if (roll < 0) {
      index = i;
      break;
    }
  }
  const reward = wheelReward(segments[index]!, save.level);
  save.daily.wheelDay = dayIndex(now);
  pay(save, reward);
  return { index, reward };
}

// ---- challenges --------------------------------------------------------------------

export type ChallengeKind = (typeof BALANCE.challenges.kinds)[number]['kind'];

export interface Challenge {
  kind: ChallengeKind;
  target: number;
  reward: Reward;
}

/** The day's three challenges, the same for everyone that day, scaled to the player's records. */
export function dailyChallenges(day: number, save: SaveData): Challenge[] {
  const C = BALANCE.challenges;
  const rng = new Rng(day * 7919 + 13);
  const pool = [...C.kinds];
  const out: Challenge[] = [];
  while (out.length < C.perDay && pool.length > 0) {
    const def = pool.splice(rng.int(0, pool.length - 1), 1)[0]!;
    const base = def.kind === 'distance' ? save.bestDistance : def.kind === 'altitude' ? save.bestAltitude : 0;
    const target = Math.max(def.min, Math.round(base * def.share));
    out.push({ kind: def.kind, target, reward: { coins: def.coins + C.coinsPerLevel * save.level, billets: def.billets } });
  }
  return out;
}

/** Make sure the save tracks today's challenges; progress resets with the day. */
export function syncChallenges(save: SaveData, now: number): void {
  const today = dayIndex(now);
  const d = save.daily;
  if (d.challengeDay === today && d.challengeProgress.length === BALANCE.challenges.perDay) return;
  d.challengeDay = today;
  d.challengeProgress = new Array<number>(BALANCE.challenges.perDay).fill(0);
  d.challengeClaimed = new Array<boolean>(BALANCE.challenges.perDay).fill(false);
}

export interface RunSummary {
  distance: number;
  maxAltitude: number;
  coinsPicked: number;
  bestChain: number;
  wallsBroken: number;
}

/** Feed a finished run into today's challenges. Returns the indices completed by this run. */
export function progressChallenges(save: SaveData, now: number, run: RunSummary): number[] {
  syncChallenges(save, now);
  const list = dailyChallenges(save.daily.challengeDay, save);
  const done: number[] = [];
  list.forEach((c, i) => {
    const before = save.daily.challengeProgress[i] ?? 0;
    let value = before;
    switch (c.kind) {
      case 'distance':
        value = Math.max(before, run.distance);
        break;
      case 'altitude':
        value = Math.max(before, run.maxAltitude);
        break;
      case 'coins':
        value = Math.max(before, run.coinsPicked);
        break;
      case 'chain':
        value = Math.max(before, run.bestChain);
        break;
      case 'runs':
        value = before + 1;
        break;
      case 'walls':
        value = before + run.wallsBroken;
        break;
    }
    save.daily.challengeProgress[i] = value;
    if (before < c.target && value >= c.target) done.push(i);
  });
  return done;
}

export function claimChallenge(save: SaveData, index: number): Reward | null {
  const list = dailyChallenges(save.daily.challengeDay, save);
  const c = list[index];
  if (!c || save.daily.challengeClaimed[index] || (save.daily.challengeProgress[index] ?? 0) < c.target) return null;
  save.daily.challengeClaimed[index] = true;
  pay(save, c.reward);
  return c.reward;
}

// ---- anti-churn rules ---------------------------------------------------------------

export type BonusKind = 'stall' | 'session' | 'return';

export interface Bonus {
  kind: BonusKind;
  reward: Reward;
}

/** Welcome-back gift when the player comes back after days away. Call once at launch. */
export function returnBonus(save: SaveData, now: number): Bonus | null {
  const R = BALANCE.retention;
  const last = save.retention.lastSeen;
  save.retention.lastSeen = now;
  if (last === 0 || now - last < R.returnDays * 86_400_000) return null;
  const reward = { coins: Math.round(giftAmount(save.level) * R.returnCoinsFactor), billets: R.returnBillets };
  pay(save, reward);
  return { kind: 'return', reward };
}

/**
 * After a run: a free chest after `stallRuns` runs without progress, a coin rain once the session
 * is long. `sessionStart` is when the game was opened, `sessionPaid` whether the rain fell already.
 */
export function runBonus(save: SaveData, now: number, distance: number, bestBefore: number, sessionStart: number, sessionPaid: boolean): Bonus | null {
  const R = BALANCE.retention;
  const progress = bestBefore === 0 || distance >= bestBefore * R.stallShare;
  save.retention.stallRuns = progress ? 0 : save.retention.stallRuns + 1;
  if (save.retention.stallRuns >= R.stallRuns) {
    save.retention.stallRuns = 0;
    if (save.premium.starterOfferedAt === 0) save.premium.starterOfferedAt = now;
    const reward = { coins: stallChest(save.level), billets: 0 };
    pay(save, reward);
    return { kind: 'stall', reward };
  }
  if (!sessionPaid && now - sessionStart >= R.sessionMinutes * 60_000) {
    const reward = { coins: Math.round(giftAmount(save.level) * R.sessionCoinsFactor), billets: 0 };
    pay(save, reward);
    return { kind: 'session', reward };
  }
  return null;
}

/** Keep the last distances for the purchase baseline. */
export function recordRun(save: SaveData, distance: number): void {
  const r = save.retention.recent;
  r.push(distance);
  while (r.length > BALANCE.premium.recentRuns) r.shift();
}

/** "Only N m to <next country>" when the run ended close to the next border. */
export function nearMiss(distance: number): { metres: number; stageId: string } | null {
  for (let i = 1; i < STAGES.length; i++) {
    const s = STAGES[i]!;
    const prev = STAGES[i - 1]!;
    if (distance >= s.from) continue;
    const span = s.from - prev.from;
    const left = s.from - distance;
    return left <= span * BALANCE.nearMiss.share ? { metres: left, stageId: s.id } : null;
  }
  return null;
}
