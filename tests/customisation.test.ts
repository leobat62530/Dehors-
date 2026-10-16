import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { countryName, flagOf } from '../src/config/countries';
import { cleanName, defaultSave, migrate } from '../src/game/save';
import { defaultEquipment, Run } from '../src/game/run';
import { awardTrophies, TROPHIES, trophyProgress } from '../src/game/trophies';
import { CHARACTER_POSE, drawCharacter } from '../src/theme/character';
import { GENDERS, HAIRSTYLES, OUTFIT_IDS, OUTFITS } from '../src/theme/wardrobe';

const DT = 1 / BALANCE.loop.physicsHz;

/** A canvas context that accepts every call and does nothing. */
function fakeContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  return new Proxy({} as CanvasRenderingContext2D, {
    get: (_t, prop) => (prop === 'createLinearGradient' ? () => gradient : () => undefined),
    set: () => true,
  });
}

function play(seed: number): number {
  const run = new Run(seed, defaultEquipment());
  run.aim.power = 1;
  run.aim.angle = 43;
  run.aiming = true;
  run.release();
  for (let i = 0; i < 300 / DT && run.phase !== 'ended'; i++) run.step(DT);
  return run.distance;
}

describe('customisation', () => {
  it('the name is free text, 16 characters at most, without line breaks, Joueur when empty', () => {
    expect(cleanName('  Kévin\nDu 62  ')).toBe('Kévin Du 62');
    expect(cleanName('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBe('ABCDEFGHIJKLMNOP');
    expect(cleanName('   ')).toBe(BALANCE.customisation.defaultName);
  });

  it('every gender wears every outfit and every hairstyle, and none of it touches balance or the run', () => {
    const before = JSON.stringify(BALANCE);
    const reference = play(7);
    const ctx = fakeContext();
    for (const gender of GENDERS) {
      for (const hair of HAIRSTYLES) {
        for (const outfit of OUTFIT_IDS) {
          for (const pose of Object.values(CHARACTER_POSE)) {
            drawCharacter(ctx, { gender, hair, outfit, colours: [1, 2, 3], shoes: 'bulle' }, pose);
          }
        }
      }
    }
    expect(JSON.stringify(BALANCE)).toBe(before);
    expect(play(7)).toBe(reference);
  });

  it('the default outfit is the polo, tracksuit, cap, bag and bubble-sole trainers', () => {
    expect(OUTFITS.depart).toMatchObject({ top: 'polo', legs: 'survet', head: 'casquette', accessory: 'sacoche', shoes: 'bulle' });
    expect(OUTFIT_IDS).toHaveLength(7);
  });

  it('nationality is a code shown as a name and a flag, never a rule', () => {
    expect(countryName('FR')).toBe('France');
    expect(countryName('')).toBeNull();
    expect(flagOf('FR')).toBe('🇫🇷');
    expect(flagOf('')).toBe('');
    expect(JSON.stringify(BALANCE)).not.toContain('"FR"');
  });

  it('a v2 save gains a default profile, empty trophies and zero stats', () => {
    const s = migrate({ version: 2, coins: 12, xp: 500, upgrades: { force: 2 } });
    expect(s.profile.name).toBe('Joueur');
    expect(s.profile.outfit).toBe('depart');
    expect(s.profile.nationality).toBe('');
    expect(s.trophies).toEqual([]);
    expect(s.stats.wallsBroken).toBe(0);
    expect(s.settings).toEqual({ sound: true, haptics: true, lang: 'fr', lab: false });
    expect(s.coins).toBe(12);
    expect(s.upgrades.force).toBe(2);
  });

  it('a broken profile falls back field by field', () => {
    const s = migrate({ ...defaultSave(), profile: { name: 'Zoé', gender: 'x', hair: 'longue', outfit: 'tutu', colours: [1, 99, 2], nationality: 'fr' } });
    expect(s.profile.name).toBe('Zoé');
    expect(s.profile.gender).toBe('n');
    expect(s.profile.hair).toBe('longue');
    expect(s.profile.outfit).toBe('depart');
    expect(s.profile.colours).toEqual([1, 0, 2]);
    expect(s.profile.nationality).toBe('');
  });
});

describe('trophies', () => {
  it('there are at least twenty-four, each with a reward from balance.ts', () => {
    expect(TROPHIES.length).toBeGreaterThanOrEqual(24);
    for (const def of TROPHIES) expect(def.reward).toBeGreaterThan(0);
  });

  it('country trophies validate on distance, sky trophies on altitude, never mixed', () => {
    const high = { ...defaultSave(), bestAltitude: 1e9, bestDistance: 0 };
    for (const def of TROPHIES) {
      const p = trophyProgress(def, high);
      if (def.kind === 'stage') expect(p.value).toBeLessThan(p.target);
      if (def.kind === 'layer') expect(p.value).toBeGreaterThanOrEqual(p.target);
    }
    const far = { ...defaultSave(), bestAltitude: 0, bestDistance: 1e9 };
    for (const def of TROPHIES) {
      const p = trophyProgress(def, far);
      if (def.kind === 'stage') expect(p.value).toBeGreaterThanOrEqual(p.target);
      if (def.kind === 'layer') expect(p.value).toBeLessThan(p.target);
    }
  });

  it('awards pay once and are remembered', () => {
    const s = { ...defaultSave(), runs: 1, bestDistance: 600 };
    const first = awardTrophies(s);
    expect(first.map((d) => d.id).sort()).toEqual(['premier_lancer', 'sortie_arras']);
    expect(s.coins).toBe(10 + 15);
    expect(awardTrophies(s)).toEqual([]);
    expect(s.coins).toBe(25);
  });

  it('the full shop trophy needs every upgrade at its maximum', () => {
    const s = defaultSave();
    for (const id in BALANCE.upgrades) s.upgrades[id as keyof typeof BALANCE.upgrades] = BALANCE.upgrades[id as keyof typeof BALANCE.upgrades].levels;
    expect(awardTrophies(s).some((d) => d.id === 'boutique_complete')).toBe(true);
    s.upgrades.force = 0;
    s.trophies = [];
    expect(awardTrophies(s).some((d) => d.id === 'boutique_complete')).toBe(false);
  });
});
