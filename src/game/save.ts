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
}

export function defaultProfile(): Profile {
  return { ...defaultLook(), name: BALANCE.customisation.defaultName, nationality: '' };
}

export function defaultStats(): Stats {
  return { wallsBroken: 0, controlsAvoided: 0, bestChain: 0, barriers: 0 };
}

export function defaultSettings(): Settings {
  return { sound: true, haptics: true, lang: 'fr' };
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
  const knownTrophies = new Set<string>(BALANCE.trophies.map((t) => t.id));
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
