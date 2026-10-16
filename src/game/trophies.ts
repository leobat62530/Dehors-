import { BALANCE } from '../config/balance';
import type { SaveData } from './save';
import { LAYERS, STAGES } from './world';

export type TrophyDef = (typeof BALANCE.trophies)[number];
export type TrophyId = TrophyDef['id'];
export const TROPHIES = BALANCE.trophies;

/** Current value and target of a trophy, for the progress bar. Country ones use distance, sky ones altitude. */
export function trophyProgress(def: TrophyDef, save: SaveData): { value: number; target: number } {
  switch (def.kind) {
    case 'stage': {
      const stage = STAGES.find((s) => s.id === def.stage);
      return { value: save.bestDistance, target: stage?.from ?? Infinity };
    }
    case 'layer': {
      const layer = LAYERS.find((l) => l.id === def.layer);
      return { value: save.bestAltitude, target: layer?.from ?? Infinity };
    }
    case 'runs':
      return { value: save.runs, target: def.value };
    case 'barriers':
      return { value: save.stats.barriers, target: def.value };
    case 'walls':
      return { value: save.stats.wallsBroken, target: def.value };
    case 'controls':
      return { value: save.stats.controlsAvoided, target: def.value };
    case 'chain':
      return { value: save.stats.bestChain, target: def.value };
    case 'coins':
      return { value: save.totalCoins, target: def.value };
    case 'level':
      return { value: save.level, target: def.value };
    case 'shop': {
      let maxed = 0;
      let total = 0;
      for (const id in BALANCE.upgrades) {
        total++;
        if (save.upgrades[id as keyof typeof BALANCE.upgrades] >= BALANCE.upgrades[id as keyof typeof BALANCE.upgrades].levels) maxed++;
      }
      return { value: maxed, target: total };
    }
  }
}

export function trophyUnlocked(def: TrophyDef, save: SaveData): boolean {
  const p = trophyProgress(def, save);
  return p.value >= p.target;
}

/** Unlock every trophy the save now satisfies, pay its reward, and return the new ones. */
export function awardTrophies(save: SaveData): TrophyDef[] {
  const fresh: TrophyDef[] = [];
  for (const def of TROPHIES) {
    if (save.trophies.includes(def.id)) continue;
    if (!trophyUnlocked(def, save)) continue;
    save.trophies.push(def.id);
    save.coins += def.reward;
    save.totalCoins += def.reward;
    fresh.push(def);
  }
  return fresh;
}
