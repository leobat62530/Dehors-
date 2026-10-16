import { BALANCE } from '../config/balance';

export type UpgradeId = keyof typeof BALANCE.upgrades;
export const UPGRADE_IDS = Object.keys(BALANCE.upgrades) as UpgradeId[];

/** XP earned by one run. The distance part is soft-capped so a desert flight does not give thirty levels. */
export function xpForRun(distance: number, coins: number): number {
  const X = BALANCE.xp;
  let d = distance;
  if (d > X.distanceLinearUntil) d = X.distanceLinearUntil * Math.pow(d / X.distanceLinearUntil, X.distanceExponent);
  return Math.floor(d / X.distanceDivisor + coins / X.coinDivisor);
}

/** Points needed to go from level n−1 to level n. */
export function xpNeeded(level: number): number {
  const X = BALANCE.xp;
  return Math.round(X.levelBase * Math.pow(level, X.levelExponent));
}

/** Level and progress within it for a total XP amount. */
export function levelFromXp(totalXp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let xp = totalXp;
  while (level < BALANCE.xp.maxLevel && xp >= xpNeeded(level + 1)) {
    xp -= xpNeeded(level + 1);
    level++;
  }
  return { level, into: xp, needed: level >= BALANCE.xp.maxLevel ? 0 : xpNeeded(level + 1) };
}

/** Price of the next level of an upgrade, given the current level (0-based). */
export function upgradePrice(id: UpgradeId, currentLevel: number): number {
  const U = BALANCE.upgrades[id];
  return Math.round(U.price * Math.pow(U.growth, currentLevel));
}

export function upgradeMaxed(id: UpgradeId, currentLevel: number): boolean {
  return currentLevel >= BALANCE.upgrades[id].levels;
}

/** Free gift availability: seconds until the next one, 0 when available. */
export function giftCooldown(lastGift: number, now: number, hours: number = BALANCE.economy.giftHours): number {
  const period = hours * 3600 * 1000;
  return Math.max(0, lastGift + period - now) / 1000;
}

export function giftAmount(level: number): number {
  return BALANCE.economy.giftBase + BALANCE.economy.giftPerLevel * level;
}
