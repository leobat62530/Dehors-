import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { pickNewer } from '../src/telegram/webapp';
import { Particles, Trail } from '../src/ui/fx';

describe('effects pools', () => {
  it('the trail keeps the last N points without growing', () => {
    const trail = new Trail(4);
    for (let i = 0; i < 10; i++) trail.push(i, i);
    expect(trail.length).toBe(4);
    trail.clear();
    expect(trail.length).toBe(0);
  });

  it('particles reuse their slots and die after their lifetime', () => {
    const p = new Particles(8);
    p.burst(0, 0, 6, 1);
    expect(p.countActive()).toBe(6);
    p.burst(0, 0, 6, 2);
    expect(p.countActive()).toBe(8);
    expect(p.items.length).toBe(8);
    for (let i = 0; i < 2 / (1 / BALANCE.loop.physicsHz); i++) p.update(1 / BALANCE.loop.physicsHz);
    expect(p.countActive()).toBe(0);
  });
});

describe('cloud save choice', () => {
  it('keeps the save that has lived longer, cloud when equal', () => {
    const a = JSON.stringify({ runs: 3, totalCoins: 100 });
    const b = JSON.stringify({ runs: 5, totalCoins: 20 });
    expect(pickNewer(a, b)).toBe(b);
    expect(pickNewer(b, a)).toBe(b);
    expect(pickNewer(a, a)).toBe(a);
    expect(pickNewer(null, a)).toBe(a);
    expect(pickNewer(a, null)).toBe(a);
    expect(pickNewer('not json', a)).toBe('not json');
  });
});
