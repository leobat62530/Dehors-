import { BALANCE } from '../config/balance';

/** Persistent progression. Versioned so future updates can migrate old saves. */
export interface SaveData {
  version: number;
  bestDistance: number;
  bestAltitude: number;
  runs: number;
}

export function defaultSave(): SaveData {
  return { version: BALANCE.save.schemaVersion, bestDistance: 0, bestAltitude: 0, runs: 0 };
}

/** Bring any stored object up to the current schema. Unknown or broken data gives a fresh save. */
export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  return {
    version: BALANCE.save.schemaVersion,
    bestDistance: num(r.bestDistance),
    bestAltitude: num(r.bestAltitude),
    runs: Math.floor(num(r.runs)),
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
