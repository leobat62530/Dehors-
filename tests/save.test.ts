import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { Rng } from '../src/core/rng';
import { defaultSave, type KeyValueStore, loadSave, migrate, writeSave } from '../src/game/save';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('save', () => {
  it('round-trips through storage', () => {
    const store = memoryStore();
    const save = { ...defaultSave(), bestDistance: 321.5, bestAltitude: 80, runs: 4 };
    writeSave(store, save);
    expect(loadSave(store)).toEqual(save);
  });

  it('recovers from broken or foreign data', () => {
    const store = memoryStore();
    store.setItem(BALANCE.save.storageKey, '{not json');
    expect(loadSave(store)).toEqual(defaultSave());
    expect(migrate({ bestDistance: -5, runs: 'x' })).toEqual(defaultSave());
    expect(loadSave(null)).toEqual(defaultSave());
  });

  it('migrates an older save to the current schema without losing the record', () => {
    const migrated = migrate({ version: 0, bestDistance: 250 });
    expect(migrated.version).toBe(BALANCE.save.schemaVersion);
    expect(migrated.bestDistance).toBe(250);
  });
});

describe('rng', () => {
  it('is reproducible from its seed and stays in range', () => {
    const a = new Rng(99);
    const b = new Rng(99);
    for (let i = 0; i < 1000; i++) {
      const v = a.next();
      expect(v).toBe(b.next());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });
});
