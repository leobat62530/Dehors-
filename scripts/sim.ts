/**
 * Balance simulator: plays headless runs with the values of balance.ts and prints the results.
 * Usage: npm run sim
 *
 * Part 1: distance of one kick by "Force" level and power.
 * Part 2: virtual players over weeks. A free player and a paying player (pass + one billets pack
 * a month, spent on coin packs) play the same number of runs a day, buy the cheapest upgrade they
 * can, and we read the day each one reaches Paris, Marseille, Morocco and Nigeria. The rule of the
 * plan: the free player gets there, the payer 2 to 3 times faster, never 20.
 */
import { BALANCE } from '../src/config/balance';
import { buyCoinPack, coinMultiplier, grantStarsProduct } from '../src/game/premium';
import { giftAmount, levelFromXp, UPGRADE_IDS, upgradeMaxed, upgradePrice, xpForRun } from '../src/game/progress';
import { defaultEquipment, type Equipment, Run } from '../src/game/run';
import { defaultSave, type SaveData } from '../src/game/save';
import { streakReward, wheelReward } from '../src/game/retention';
import { STAGES } from '../src/game/world';

const DT = 1 / BALANCE.loop.physicsHz;
const eqOf = (kickLevel: number): Equipment => ({ ...defaultEquipment(), kickLevel });

function play(eq: Equipment, power: number, angle: number, seed = 1): Run {
  const run = new Run(seed, eq);
  run.aim.power = power;
  run.aim.angle = angle;
  run.release();
  for (let i = 0; i < 600 / DT && run.phase !== 'ended'; i++) {
    run.step(DT);
    // A player fires the rocket on the way down, while still high.
    if (run.phase === 'flight' && run.rocketCharges > 0 && run.body.vy < 0 && run.body.y > 5) run.tap();
  }
  return run;
}

// ---- part 1: one kick ---------------------------------------------------------------

const rows: string[] = [];
rows.push('niveau force | puissance | angle | distance | altitude max | durée');
for (const level of [0, 3, 6, 10]) {
  for (const power of [0.5, 1]) {
    let best: { run: Run; angle: number } | null = null;
    for (let a = BALANCE.kick.minAngle; a <= BALANCE.kick.maxAngle; a++) {
      const run = play(eqOf(level), power, a);
      if (!best || run.distance > best.run.distance) best = { run, angle: a };
    }
    if (!best) continue;
    const r = best.run;
    rows.push(
      `${String(level).padStart(12)} | ${power.toFixed(1).padStart(9)} | ${String(best.angle).padStart(5)} | ` +
        `${r.distance.toFixed(0).padStart(6)} m | ${r.maxAltitude.toFixed(0).padStart(10)} m | ${r.time.toFixed(1)} s`,
    );
  }
}
console.log(rows.join('\n'));

// ---- part 2: weeks of play ------------------------------------------------------------

const DAYS = 45;
const RUNS_PER_DAY = 8;
/** Average kick power and angle of a regular player. */
const POWER = 0.9;
const ANGLE = 42;
const SEEDS = [1, 2, 3];
const DAY_MS = 86_400_000;
const TARGETS = ['paris', 'marseille', 'maroc', 'nigeria'] as const;

interface RunResult {
  distance: number;
  coins: number;
}

const cache = new Map<string, RunResult>();

/** Average run for an equipment, memoised: equipment changes a few times a day at most. */
function runFor(eq: Equipment): RunResult {
  const key = `${eq.kickLevel}/${eq.solesLevel}/${eq.suitLevel}/${eq.magnetLevel}/${eq.rocketCharges}/${eq.rampLevel}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let distance = 0;
  let coins = 0;
  for (const seed of SEEDS) {
    const r = play(eq, POWER, ANGLE, seed);
    distance += r.distance;
    coins += r.coins + r.distanceCoins;
  }
  const out = { distance: distance / SEEDS.length, coins: coins / SEEDS.length };
  cache.set(key, out);
  return out;
}

function equipmentOf(save: SaveData): Equipment {
  const u = save.upgrades;
  return { ...defaultEquipment(), kickLevel: u.force, solesLevel: u.semelles, suitLevel: u.combinaison, magnetLevel: u.aimant, rocketCharges: u.fusee, rampLevel: u.tremplin };
}

/** Buy the cheapest upgrade affordable and unlocked, again and again. */
function shop(save: SaveData): void {
  for (;;) {
    let best: { id: (typeof UPGRADE_IDS)[number]; price: number } | null = null;
    for (const id of UPGRADE_IDS) {
      const level = save.upgrades[id];
      if (upgradeMaxed(id, level) || save.level < BALANCE.upgrades[id].unlock) continue;
      const price = upgradePrice(id, level);
      if (price <= save.coins && (!best || price < best.price)) best = { id, price };
    }
    if (!best) return;
    save.coins -= best.price;
    save.upgrades[best.id]++;
  }
}

function simulatePlayer(paying: boolean): { reached: Record<string, number>; days: number[] } {
  const save = defaultSave();
  const reached: Record<string, number> = {};
  const days: number[] = [];
  const start = Date.UTC(2026, 0, 1);
  for (let day = 1; day <= DAYS; day++) {
    const now = start + day * DAY_MS;
    if (paying && (day - 1) % 30 === 0) {
      grantStarsProduct(save, 'pass', now);
      grantStarsProduct(save, 'billets_m', now);
    }
    // Daily free income: streak, wheel (expected value), gifts.
    const streak = streakReward(Math.min(7, day), save.level);
    save.coins += streak.coins;
    const segments = BALANCE.wheel.segments;
    const weight = segments.reduce((a, s) => a + s.weight, 0);
    save.coins += segments.reduce((a, s) => a + (wheelReward(s, save.level).coins * s.weight) / weight, 0);
    const giftHours = paying ? BALANCE.premium.pass.giftHours : BALANCE.economy.giftHours;
    save.coins += giftAmount(save.level) * Math.min(3, 16 / giftHours);
    if (paying) for (const pack of [...BALANCE.premium.coinPacks].reverse()) while (buyCoinPack(save, pack)) void 0;
    for (let i = 0; i < RUNS_PER_DAY; i++) {
      shop(save);
      const r = runFor(equipmentOf(save));
      const coins = r.coins * coinMultiplier(save, now);
      save.coins += coins;
      save.xp += xpForRun(r.distance, coins);
      save.level = levelFromXp(save.xp).level;
      save.bestDistance = Math.max(save.bestDistance, r.distance);
    }
    days.push(save.bestDistance);
    for (const id of TARGETS) {
      const stage = STAGES.find((s) => s.id === id)!;
      if (!(id in reached) && save.bestDistance >= stage.from) reached[id] = day;
    }
  }
  return { reached, days };
}

const free = simulatePlayer(false);
const paid = simulatePlayer(true);
console.log('\njoueur virtuel, 8 parties par jour, 60 jours (gratuit | payant : pass + 200 billets par mois)');
console.log('jour | record gratuit | record payant');
for (let d = 1; d <= DAYS; d++) {
  console.log(`${String(d).padStart(4)} | ${(free.days[d - 1] ?? 0).toFixed(0).padStart(14)} m | ${(paid.days[d - 1] ?? 0).toFixed(0).padStart(13)} m`);
}
console.log('\npays        | jour gratuit | jour payant | rapport');
for (const id of TARGETS) {
  const f = free.reached[id];
  const p = paid.reached[id];
  const ratio = f && p ? (f / p).toFixed(1) : '—';
  console.log(`${id.padEnd(11)} | ${(f ? String(f) : `> ${DAYS}`).padStart(12)} | ${(p ? String(p) : `> ${DAYS}`).padStart(11)} | ${ratio}`);
}
