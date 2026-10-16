import { BALANCE } from '../config/balance';
import { UPGRADE_IDS, type UpgradeId } from './progress';

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
  };
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
