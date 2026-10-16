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
  above: 'Au-dessus de',
  endStage: 'Pays le plus loin',
  endLayer: 'Couche la plus haute',
  endAltitudeRecord: 'Record d’altitude !',
  stage_arras: 'Arras',
  stage_somme: 'La Somme',
  stage_paris: 'Paris',
  stage_campagne: 'Forêts et campagnes',
  stage_lyon: 'Lyon',
  stage_marseille: 'Marseille',
  stage_pyrenees: 'Pyrénées et Andorre',
  stage_espagne: 'Espagne',
  stage_mediterranee: 'Méditerranée',
  stage_maroc: 'Maroc',
  stage_algerie: 'Algérie',
  stage_tunisie: 'Tunisie',
  stage_soudan: 'Soudan',
  stage_somalie: 'Somalie',
  stage_congo: 'Congo',
  stage_nigeria: 'Nigéria',
  stage_desert: 'Grand désert',
  layer_troposphere: 'Troposphère',
  layer_stratosphere: 'Stratosphère',
  layer_orbite: 'Orbite',
  layer_lune: 'Lune',
  layer_espace: 'Espace profond',
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

export function stageName(id: string): string {
  return t(`stage_${id}` as TextKey);
}

export function layerName(id: string): string {
  return t(`layer_${id}` as TextKey);
}
