import { BALANCE } from '../config/balance';
import { giftAmount } from './progress';
import { type GadgetId, type SaveData } from './save';

/**
 * Premium economy: what billets buy, what the pass gives, what the time accelerator allows,
 * and the spending guard. Pure functions on the save; the UI and (later) the server call them.
 */

export type BilletPack = (typeof BALANCE.premium.billetPacks)[number];
export type CoinPack = (typeof BALANCE.premium.coinPacks)[number];
export type Gadget = (typeof BALANCE.premium.gadgets)[number];

/** Products paid in Stars: their price is known before the invoice. */
export type StarsProductId = BilletPack['id'] | typeof BALANCE.premium.pass.id | typeof BALANCE.premium.starter.id;

export function starsPrice(id: StarsProductId): number {
  const pack = BALANCE.premium.billetPacks.find((p) => p.id === id);
  if (pack) return pack.stars;
  if (id === BALANCE.premium.pass.id) return BALANCE.premium.pass.stars;
  return BALANCE.premium.starter.stars;
}

/** Local day index (days since the epoch, in the device's time zone). */
export function dayIndex(now: number): number {
  const d = new Date(now);
  return Math.floor((now - d.getTimezoneOffset() * 60_000) / 86_400_000);
}

export function passActive(save: SaveData, now: number): boolean {
  return save.premium.passUntil > now;
}

export function coinMultiplier(save: SaveData, now: number): number {
  return passActive(save, now) ? BALANCE.premium.pass.coinMultiplier : 1;
}

export function giftHours(save: SaveData, now: number): number {
  return passActive(save, now) ? BALANCE.premium.pass.giftHours : BALANCE.economy.giftHours;
}

/** Highest time accelerator index the player may use: by level, by purchase, or through the pass. */
export function maxTimeScaleIndex(save: SaveData, now: number): number {
  let max = 0;
  for (const u of BALANCE.timeScale.unlocks) if (save.level >= u.level) max = Math.max(max, u.index);
  max = Math.max(max, save.premium.timeScaleOwned);
  if (passActive(save, now)) max = Math.max(max, BALANCE.timeScale.passIndex);
  return Math.min(max, BALANCE.timeScale.steps.length - 1);
}

/** Next time accelerator step still locked, with its level and price; null when all are open. */
export function nextTimeScaleUnlock(save: SaveData, now: number): { index: number; level: number; billets: number } | null {
  const max = maxTimeScaleIndex(save, now);
  return BALANCE.timeScale.unlocks.find((u) => u.index > max) ?? null;
}

export function buyTimeScale(save: SaveData, now: number): boolean {
  const next = nextTimeScaleUnlock(save, now);
  if (!next || next.billets <= 0 || save.premium.billets < next.billets) return false;
  save.premium.billets -= next.billets;
  save.premium.timeScaleOwned = Math.max(save.premium.timeScaleOwned, next.index);
  return true;
}

export function coinPackAmount(pack: CoinPack, level: number): number {
  return pack.coinsBase + pack.coinsPerLevel * level;
}

export function buyCoinPack(save: SaveData, pack: CoinPack): boolean {
  if (save.premium.billets < pack.billets) return false;
  save.premium.billets -= pack.billets;
  const coins = coinPackAmount(pack, save.level);
  save.coins += coins;
  save.totalCoins += coins;
  return true;
}

export function gadgetOf(id: GadgetId): Gadget {
  return BALANCE.premium.gadgets.find((g) => g.id === id) ?? BALANCE.premium.gadgets[0]!;
}

/** Buy one gadget, in coins or in billets. */
export function buyGadget(save: SaveData, id: GadgetId, currency: 'coins' | 'billets'): boolean {
  const g = gadgetOf(id);
  if (save.premium.gadgets[id] >= BALANCE.premium.gadgetMax) return false;
  if (currency === 'coins') {
    if (save.coins < g.coins) return false;
    save.coins -= g.coins;
  } else {
    if (save.premium.billets < g.billets) return false;
    save.premium.billets -= g.billets;
  }
  save.premium.gadgets[id]++;
  return true;
}

/** Equipment bonuses of the gadgets held, armed for the next run. */
export function gadgetBonuses(save: SaveData): { rockets: number; magnet: number; lawyer: number; soles: number } {
  const b = { rockets: 0, magnet: 0, lawyer: 0, soles: 0 };
  for (const g of BALANCE.premium.gadgets) {
    if (save.premium.gadgets[g.id] <= 0) continue;
    b.rockets += g.rockets;
    b.magnet += g.magnet;
    b.lawyer += g.lawyer;
    b.soles += g.soles;
  }
  return b;
}

/** Consume one of each gadget held: called at the kick. Returns the ids used. */
export function consumeGadgets(save: SaveData): GadgetId[] {
  const used: GadgetId[] = [];
  for (const g of BALANCE.premium.gadgets) {
    if (save.premium.gadgets[g.id] <= 0) continue;
    save.premium.gadgets[g.id]--;
    used.push(g.id);
  }
  return used;
}

/** Stars still allowed today under the daily cap. */
export function starsLeftToday(save: SaveData, now: number): number {
  const day = dayIndex(now);
  const spent = save.premium.spendDay === day ? save.premium.spendStars : 0;
  return Math.max(0, BALANCE.premium.dailyStarsCap - spent);
}

/** Record a Stars payment (after the server confirmed it) and grant what it bought. */
export function grantStarsProduct(save: SaveData, id: StarsProductId, now: number): void {
  const day = dayIndex(now);
  if (save.premium.spendDay !== day) {
    save.premium.spendDay = day;
    save.premium.spendStars = 0;
  }
  save.premium.spendStars += starsPrice(id);
  save.premium.purchases++;
  const pack = BALANCE.premium.billetPacks.find((p) => p.id === id);
  if (pack) {
    addBillets(save, pack.billets + pack.bonus);
    return;
  }
  if (id === BALANCE.premium.pass.id) {
    const from = Math.max(now, save.premium.passUntil);
    save.premium.passUntil = from + BALANCE.premium.pass.days * 86_400_000;
    return;
  }
  const s = BALANCE.premium.starter;
  save.premium.starterBought = true;
  addBillets(save, s.billets);
  const coins = s.coinsBase + s.coinsPerLevel * save.level;
  save.coins += coins;
  save.totalCoins += coins;
}

export function addBillets(save: SaveData, n: number): void {
  save.premium.billets += n;
  save.premium.totalBillets += n;
}

/** The starter pack shows once the player has stalled, for `hours`, and goes away once bought. */
export function starterAvailable(save: SaveData, now: number): boolean {
  const p = save.premium;
  if (p.starterBought || p.starterOfferedAt === 0) return false;
  return now < p.starterOfferedAt + BALANCE.premium.starter.hours * 3_600_000;
}

/** Average of the recent runs, the baseline a purchase is measured against. */
export function recentAverage(save: SaveData): number {
  const r = save.retention.recent;
  if (r.length === 0) return 0;
  return r.reduce((a, b) => a + b, 0) / r.length;
}

/** Every purchase that changes the flight starts the "+X m thanks to your purchase" window. */
export function startBoostWindow(save: SaveData): void {
  save.retention.boostRuns = BALANCE.premium.boostRuns;
  save.retention.boostBaseline = recentAverage(save);
}

/** Free chest paid when the player stalls: a gift-sized amount, scaled. */
export function stallChest(level: number): number {
  return Math.round(giftAmount(level) * BALANCE.retention.stallCoinsFactor);
}
