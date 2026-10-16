import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { LAB_GROUPS, labDefault, labOverrides, readParam, resetLab, writeParam } from '../src/ui/lab';

describe('tuning lab', () => {
  it('every lab parameter points at a number in BALANCE, inside its own range', () => {
    for (const g of LAB_GROUPS) {
      for (const p of g.params) {
        const v = readParam(p.path);
        expect(Number.isFinite(v), p.path).toBe(true);
        expect(v, p.path).toBeGreaterThanOrEqual(p.min);
        expect(v, p.path).toBeLessThanOrEqual(p.max);
      }
    }
  });

  it('writes straight into BALANCE and reports only what differs from the shipped value', () => {
    const before = BALANCE.physics.gravity;
    expect(labOverrides()).toEqual({});
    writeParam('physics.gravity', before + 3);
    expect(BALANCE.physics.gravity).toBe(before + 3);
    expect(labOverrides()).toEqual({ 'physics.gravity': before + 3 });
    expect(labDefault('physics.gravity')).toBe(before);
    resetLab();
    expect(BALANCE.physics.gravity).toBe(before);
    expect(labOverrides()).toEqual({});
  });

  it('ignores unknown paths and non-numbers', () => {
    writeParam('physics.nothing', 1);
    writeParam('stages', 1);
    expect(Number.isNaN(readParam('physics.nothing'))).toBe(true);
    expect(labOverrides()).toEqual({});
  });
});
