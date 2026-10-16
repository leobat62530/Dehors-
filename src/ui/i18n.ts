/** All player-facing text. French by default; English keys are in place, text to be written. */
const fr = {
  title: 'Dehors !',
  aimHint: 'Tire la godasse vers l’arrière, puis lâche',
  defaultName: 'Joueur',
  speedUnit: 'km/h',
  altitude: 'alt.',
  endTitle: 'Fin de course',
  endDistance: 'Distance',
  endAltitude: 'Altitude max',
  endSpeed: 'Vitesse max',
  endRecord: 'Nouveau record !',
  best: 'Record',
  replay: 'Rejouer',
  seed: 'Graine',
  pause: 'Pause',
  resume: 'Reprendre',
} as const;

export type TextKey = keyof typeof fr;

const en: Record<TextKey, string> = { ...fr };

const tables = { fr, en } as const;
export type Lang = keyof typeof tables;

let current: Lang = 'fr';

export function setLang(lang: Lang): void {
  current = lang;
}

export function t(key: TextKey): string {
  return tables[current][key];
}
