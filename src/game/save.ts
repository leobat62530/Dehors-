import { BALANCE } from '../config/balance';
import { defaultLook, FABRIC_COLOURS, GENDERS, HAIRSTYLES, type Look, OUTFITS, type OutfitId } from '../theme/wardrobe';
import { UPGRADE_IDS, type UpgradeId } from './progress';

export interface Profile extends Look {
  name: string;
  /** ISO 3166-1 alpha-2 code, empty when not specified. Display only. */
  nationality: string;
}

export interface Stats {
  wallsBroken: number;
  controlsAvoided: number;
  bestChain: number;
  barriers: number;
}

export interface Settings {
  sound: boolean;
  haptics: boolean;
  lang: 'fr' | 'en';
  /** The tuning lab is unlocked (seven taps on the title). */
  lab: boolean;
}

export type GadgetId = (typeof BALANCE.premium.gadgets)[number]['id'];
export const GADGET_IDS = BALANCE.premium.gadgets.map((g) => g.id) as GadgetId[];

/** Premium currency, pass, gadgets and the spending guard. Server-reconciled once payments are live. */
export interface Premium {
  billets: number;
  /** Billets ever received, for the dashboard. */
  totalBillets: number;
  /** Highest time accelerator index bought, 0 when none. */
  timeScaleOwned: number;
  /** Pass expiry (ms), 0 when none. */
  passUntil: number;
  /** One-run gadgets held, per kind. */
  gadgets: Record<GadgetId, number>;
  /** Starter pack: when it was first offered (ms, 0 = not yet) and whether it was bought. */
  starterOfferedAt: number;
  starterBought: boolean;
  /** Stars spent on the day `spendDay` (local day index). */
  spendDay: number;
  spendStars: number;
  /** Number of Stars purchases made. */
  purchases: number;
}

/** Daily loops: login streak, free wheel, challenges. Days are local day indices (days since epoch). */
export interface Daily {
  /** Current streak day (1..7), 0 before the first visit. */
  streakDay: number;
  streakLastDay: number;
  /** Last day the wheel was spun, 0 when never. */
  wheelDay: number;
  challengeDay: number;
  challengeProgress: number[];
  challengeClaimed: boolean[];
}

/** What the anti-churn rules look at. */
export interface Retention {
  /** Last time the game was open (ms). */
  lastSeen: number;
  /** Runs in a row without real progress. */
  stallRuns: number;
  /** Last run distances, newest last. */
  recent: number[];
  /** Runs left during which the end screen shows the gain since the last purchase, and the average before it. */
  boostRuns: number;
  boostBaseline: number;
}

/** Persistent progression. Versioned so future updates can migrate old saves. */
export interface SaveData {
  version: number;
  bestDistance: number;
  bestAltitude: number;
  runs: number;
  coins: number;
  /** Coins ever earned, for trophies. */
  totalCoins: number;
  /** Player level, 1-based, derived from xp and kept for display. */
  level: number;
  xp: number;
  upgrades: Record<UpgradeId, number>;
  /** Equipped helmet and its remaining wall charges, null when none. */
  helmet: { id: string; charges: number } | null;
  /** Timestamp (ms) of the last free gift, 0 when never taken. */
  lastGift: number;
  profile: Profile;
  trophies: string[];
  stats: Stats;
  settings: Settings;
  premium: Premium;
  daily: Daily;
  retention: Retention;
}

export function defaultGadgets(): Record<GadgetId, number> {
  const g = {} as Record<GadgetId, number>;
  for (const id of GADGET_IDS) g[id] = 0;
  return g;
}

export function defaultPremium(): Premium {
  return {
    billets: 0,
    totalBillets: 0,
    timeScaleOwned: 0,
    passUntil: 0,
    gadgets: defaultGadgets(),
    starterOfferedAt: 0,
    starterBought: false,
    spendDay: 0,
    spendStars: 0,
    purchases: 0,
  };
}

export function defaultDaily(): Daily {
  return { streakDay: 0, streakLastDay: 0, wheelDay: 0, challengeDay: 0, challengeProgress: [], challengeClaimed: [] };
}

export function defaultRetention(): Retention {
  return { lastSeen: 0, stallRuns: 0, recent: [], boostRuns: 0, boostBaseline: 0 };
}

export function defaultProfile(): Profile {
  return { ...defaultLook(), name: BALANCE.customisation.defaultName, nationality: '' };
}

export function defaultStats(): Stats {
  return { wallsBroken: 0, controlsAvoided: 0, bestChain: 0, barriers: 0 };
}

export function defaultSettings(): Settings {
  return { sound: true, haptics: true, lang: 'fr', lab: false };
}

/** Name as typed, without line breaks, trimmed and cut to the limit; the default when empty. */
export function cleanName(raw: string): string {
  const name = raw.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, BALANCE.customisation.nameMaxLength).trim();
  return name.length > 0 ? name : BALANCE.customisation.defaultName;
}

export function defaultUpgrades(): Record<UpgradeId, number> {
  const u = {} as Record<UpgradeId, number>;
  for (const id of UPGRADE_IDS) u[id] = 0;
  return u;
}

export function defaultSave(): SaveData {
  return {
    version: BALANCE.save.schemaVersion,
    bestDistance: 0,
    bestAltitude: 0,
    runs: 0,
    coins: 0,
    totalCoins: 0,
    level: 1,
    xp: 0,
    upgrades: defaultUpgrades(),
    helmet: null,
    lastGift: 0,
    profile: defaultProfile(),
    trophies: [],
    stats: defaultStats(),
    settings: defaultSettings(),
    premium: defaultPremium(),
    daily: defaultDaily(),
    retention: defaultRetention(),
  };
}

function migrateProfile(raw: unknown): Profile {
  const p = defaultProfile();
  if (!raw || typeof raw !== 'object') return p;
  const r = raw as Partial<Profile>;
  if (typeof r.name === 'string') p.name = cleanName(r.name);
  if (typeof r.nationality === 'string' && /^[A-Z]{2}$/.test(r.nationality)) p.nationality = r.nationality;
  if (GENDERS.includes(r.gender as never)) p.gender = r.gender as Profile['gender'];
  if (HAIRSTYLES.includes(r.hair as never)) p.hair = r.hair as Profile['hair'];
  if (typeof r.outfit === 'string' && r.outfit in OUTFITS) p.outfit = r.outfit as OutfitId;
  if (Array.isArray(r.colours) && r.colours.length === 3) {
    p.colours = r.colours.map((c) => (typeof c === 'number' && c >= 0 && c < FABRIC_COLOURS.length ? Math.floor(c) : 0)) as [number, number, number];
  }
  if (typeof r.shoes === 'string') p.shoes = r.shoes;
  return p;
}

/** Bring any stored object up to the current schema. Unknown or broken data gives a fresh save. */
export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  const helmet =
    r.helmet && typeof r.helmet === 'object' && typeof r.helmet.id === 'string' && num(r.helmet.charges) > 0
      ? { id: r.helmet.id, charges: Math.floor(num(r.helmet.charges)) }
      : null;
  const upgrades = defaultUpgrades();
  const ru = (r.upgrades ?? {}) as Partial<Record<UpgradeId, unknown>>;
  for (const id of UPGRADE_IDS) upgrades[id] = Math.min(BALANCE.upgrades[id].levels, Math.floor(num(ru[id])));
  const rs = (r.stats ?? {}) as Partial<Stats>;
  const rset = (r.settings ?? {}) as Partial<Settings>;
  const rp = (r.premium ?? {}) as Partial<Premium>;
  const rd = (r.daily ?? {}) as Partial<Daily>;
  const rr = (r.retention ?? {}) as Partial<Retention>;
  const knownTrophies = new Set<string>(BALANCE.trophies.map((t) => t.id));
  const gadgets = defaultGadgets();
  const rg = (rp.gadgets ?? {}) as Partial<Record<GadgetId, unknown>>;
  for (const id of GADGET_IDS) gadgets[id] = Math.min(BALANCE.premium.gadgetMax, Math.floor(num(rg[id])));
  const numbers = (v: unknown, max: number): number[] =>
    Array.isArray(v) ? v.slice(0, max).map((x) => Math.floor(num(x))) : [];
  const flags = (v: unknown, max: number): boolean[] => (Array.isArray(v) ? v.slice(0, max).map((x) => x === true) : []);
  return {
    version: BALANCE.save.schemaVersion,
    bestDistance: num(r.bestDistance),
    bestAltitude: num(r.bestAltitude),
    runs: Math.floor(num(r.runs)),
    coins: Math.floor(num(r.coins)),
    totalCoins: Math.floor(Math.max(num(r.totalCoins), num(r.coins))),
    level: Math.max(1, Math.floor(num(r.level))),
    xp: Math.floor(num(r.xp)),
    upgrades,
    helmet,
    lastGift: Math.floor(num(r.lastGift)),
    profile: migrateProfile(r.profile),
    trophies: Array.isArray(r.trophies) ? r.trophies.filter((id): id is string => typeof id === 'string' && knownTrophies.has(id)) : [],
    stats: {
      wallsBroken: Math.floor(num(rs.wallsBroken)),
      controlsAvoided: Math.floor(num(rs.controlsAvoided)),
      bestChain: Math.floor(num(rs.bestChain)),
      barriers: Math.floor(num(rs.barriers)),
    },
    settings: {
      sound: rset.sound !== false,
      haptics: rset.haptics !== false,
      lang: rset.lang === 'en' ? 'en' : 'fr',
      lab: rset.lab === true,
    },
    premium: {
      billets: Math.floor(num(rp.billets)),
      totalBillets: Math.floor(Math.max(num(rp.totalBillets), num(rp.billets))),
      timeScaleOwned: Math.min(BALANCE.timeScale.steps.length - 1, Math.floor(num(rp.timeScaleOwned))),
      passUntil: Math.floor(num(rp.passUntil)),
      gadgets,
      starterOfferedAt: Math.floor(num(rp.starterOfferedAt)),
      starterBought: rp.starterBought === true,
      spendDay: Math.floor(num(rp.spendDay)),
      spendStars: Math.floor(num(rp.spendStars)),
      purchases: Math.floor(num(rp.purchases)),
    },
    daily: {
      streakDay: Math.min(BALANCE.streak.coinsBase.length, Math.floor(num(rd.streakDay))),
      streakLastDay: Math.floor(num(rd.streakLastDay)),
      wheelDay: Math.floor(num(rd.wheelDay)),
      challengeDay: Math.floor(num(rd.challengeDay)),
      challengeProgress: numbers(rd.challengeProgress, BALANCE.challenges.perDay),
      challengeClaimed: flags(rd.challengeClaimed, BALANCE.challenges.perDay),
    },
    retention: {
      lastSeen: Math.floor(num(rr.lastSeen)),
      stallRuns: Math.floor(num(rr.stallRuns)),
      recent: Array.isArray(rr.recent) ? rr.recent.slice(-BALANCE.premium.recentRuns).map((x) => num(x)) : [],
      boostRuns: Math.floor(num(rr.boostRuns)),
      boostBaseline: num(rr.boostBaseline),
    },
  };
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadSave(store: KeyValueStore | null): SaveData {
  if (!store) return defaultSave();
  try {
    const text = store.getItem(BALANCE.save.storageKey);
    return migrate(text ? JSON.parse(text) : null);
  } catch {
    return defaultSave();
  }
}

export function writeSave(store: KeyValueStore | null, data: SaveData): void {
  if (!store) return;
  try {
    store.setItem(BALANCE.save.storageKey, JSON.stringify(data));
  } catch {
    // Storage full or blocked: progression stays in memory for this session.
  }
}
