import type { LayerId, StageId } from '../game/world';

/** What the ground is made of: picks the texture drawn under the horizon line. */
export type GroundKind = 'herbe' | 'sable' | 'eau' | 'neige' | 'bitume' | 'terre' | 'jungle';

/** Colours of one ground stage: sky, ground and the parallax planes. */
export interface StagePalette {
  skyTop: string;
  skyBottom: string;
  ground: string;
  groundDark: string;
  /** Rolling hills on the horizon. */
  hills: string;
  /** Big silhouettes far away. */
  far: string;
  /** Monuments and buildings. */
  mid: string;
  /** Trees, houses and objects close to the track. */
  near: string;
  /** Vegetation accent (tree canopies, bushes). */
  leaf: string;
  /** Height of the far hills, 0 flat to 1 mountains. */
  relief: number;
  ground_kind: GroundKind;
  /** Colour of the sun disc; empty for none (night, fog). */
  sun: string;
  /** Opacity of the clouds, 0 for a clear sky. */
  clouds: number;
}

/** Colours of one sky layer, used above the tropopause instead of the stage sky. */
export interface LayerPalette {
  skyTop: string;
  skyBottom: string;
  /** Opacity of the star field, 0 for none. */
  stars: number;
  /** Colour of the planet curvature seen far below. */
  horizon: string;
}

export const STAGE_PALETTES: Record<StageId, StagePalette> = {
  arras: { skyTop: '#4f9fe8', skyBottom: '#cde9ff', ground: '#6fc35c', groundDark: '#4a9a3f', hills: '#8fcf7a', far: '#7fb0d8', mid: '#b5473a', near: '#8b2f27', leaf: '#3f9a3a', relief: 0.25, ground_kind: 'herbe', sun: '#fff1a8', clouds: 0.95 },
  somme: { skyTop: '#7fa9d2', skyBottom: '#e3ecf3', ground: '#a4c45f', groundDark: '#7a9a3e', hills: '#b7cf86', far: '#9fb6c9', mid: '#eef0f2', near: '#c9a43a', leaf: '#5f9a3a', relief: 0.1, ground_kind: 'herbe', sun: '#fff6c8', clouds: 1 },
  paris: { skyTop: '#4a8fdc', skyBottom: '#d8ecff', ground: '#8d929c', groundDark: '#5f636b', hills: '#a6b4c6', far: '#8ea4ba', mid: '#c9b79c', near: '#7d7a86', leaf: '#4f8f3a', relief: 0.15, ground_kind: 'bitume', sun: '#fff1a8', clouds: 0.8 },
  campagne: { skyTop: '#55b0ec', skyBottom: '#dcf3ff', ground: '#63bd50', groundDark: '#3f8f32', hills: '#86c66d', far: '#7fb28e', mid: '#c98a4a', near: '#8b5a2b', leaf: '#2f7a3a', relief: 0.35, ground_kind: 'herbe', sun: '#fff1a8', clouds: 0.9 },
  lyon: { skyTop: '#5898d8', skyBottom: '#d9eaf8', ground: '#93b26c', groundDark: '#5e7d45', hills: '#9cb6c9', far: '#8ea4ba', mid: '#d9b48a', near: '#4a7fa8', leaf: '#3f8f3a', relief: 0.5, ground_kind: 'herbe', sun: '#fff1a8', clouds: 0.7 },
  marseille: { skyTop: '#2b8ee6', skyBottom: '#c4eaff', ground: '#d9c38c', groundDark: '#a8925e', hills: '#a9bcc6', far: '#9fc7dd', mid: '#f4e3c1', near: '#1f6fa8', leaf: '#3f8f5a', relief: 0.55, ground_kind: 'sable', sun: '#ffe88a', clouds: 0.3 },
  pyrenees: { skyTop: '#5c9fe0', skyBottom: '#eaf4ff', ground: '#f2f6fa', groundDark: '#b9c6d3', hills: '#d8e3ee', far: '#9bb2c8', mid: '#6f8196', near: '#2f5a3a', leaf: '#2f5a3a', relief: 1, ground_kind: 'neige', sun: '#fff8d8', clouds: 0.8 },
  espagne: { skyTop: '#3d8fe3', skyBottom: '#ffe4a8', ground: '#d8b36a', groundDark: '#a9843f', hills: '#d9b77a', far: '#c6a46f', mid: '#f1e3c4', near: '#2b2b2b', leaf: '#5f8f3a', relief: 0.45, ground_kind: 'terre', sun: '#ffd060', clouds: 0.2 },
  mediterranee: { skyTop: '#2f86e6', skyBottom: '#c6e6ff', ground: '#1f6fb5', groundDark: '#155084', hills: '#2f86d6', far: '#a9c9e6', mid: '#ffffff', near: '#3a3a3a', leaf: '#3a3a3a', relief: 0, ground_kind: 'eau', sun: '#ffe88a', clouds: 0.5 },
  maroc: { skyTop: '#4d9ae0', skyBottom: '#ffd9a1', ground: '#e0b56e', groundDark: '#b5883f', hills: '#d8a86a', far: '#b89a6a', mid: '#d9c3a0', near: '#8a5a2b', leaf: '#4f8f3a', relief: 0.6, ground_kind: 'sable', sun: '#ffd060', clouds: 0.15 },
  algerie: { skyTop: '#3f93e3', skyBottom: '#d2ecff', ground: '#dcc58f', groundDark: '#a8925e', hills: '#c9bb95', far: '#9fb8c9', mid: '#f5f5f5', near: '#2f6fa8', leaf: '#4f8f3a', relief: 0.5, ground_kind: 'sable', sun: '#ffe88a', clouds: 0.3 },
  tunisie: { skyTop: '#3d9be8', skyBottom: '#eaf6ff', ground: '#e6d6a3', groundDark: '#b8a46e', hills: '#d9cfa8', far: '#c7d3dc', mid: '#ffffff', near: '#2a6fcf', leaf: '#4f8f3a', relief: 0.2, ground_kind: 'sable', sun: '#ffe88a', clouds: 0.3 },
  soudan: { skyTop: '#6aa0d8', skyBottom: '#ffd79a', ground: '#e3b86f', groundDark: '#b48a42', hills: '#d9a860', far: '#c89f6a', mid: '#b5803f', near: '#8a5a2b', leaf: '#6f8f3a', relief: 0.3, ground_kind: 'sable', sun: '#ffd060', clouds: 0.05 },
  somalie: { skyTop: '#4f9fe3', skyBottom: '#dff1ff', ground: '#d9c08a', groundDark: '#a8925e', hills: '#c9b48a', far: '#9fc0d8', mid: '#c7a26a', near: '#5f8f3a', leaf: '#5f8f3a', relief: 0.3, ground_kind: 'terre', sun: '#ffe88a', clouds: 0.3 },
  congo: { skyTop: '#5f8fb5', skyBottom: '#cfe3d8', ground: '#3f8a3a', groundDark: '#2a5f28', hills: '#5f9a6a', far: '#7fa58f', mid: '#2f6b3a', near: '#1f4a28', leaf: '#2f7a3a', relief: 0.4, ground_kind: 'jungle', sun: '', clouds: 1 },
  nigeria: { skyTop: '#4a96e0', skyBottom: '#ffe0b0', ground: '#c9a85e', groundDark: '#967b3c', hills: '#b8a070', far: '#8fa8bf', mid: '#5f6b78', near: '#7a5a2b', leaf: '#4f8f3a', relief: 0.35, ground_kind: 'terre', sun: '#ffd060', clouds: 0.5 },
  desert: { skyTop: '#f6a24a', skyBottom: '#ffe3b0', ground: '#f0c070', groundDark: '#c48f3c', hills: '#e8b060', far: '#e9b36a', mid: '#d99a4f', near: '#b8762e', leaf: '#8f8f3a', relief: 0.4, ground_kind: 'sable', sun: '#fff0a0', clouds: 0 },
};

export const LAYER_PALETTES: Record<LayerId, LayerPalette> = {
  troposphere: { skyTop: '#5aa9e6', skyBottom: '#bfe3ff', stars: 0, horizon: '#6bbf59' },
  stratosphere: { skyTop: '#06102a', skyBottom: '#2f6fb5', stars: 0.5, horizon: '#7fb2e0' },
  orbite: { skyTop: '#02040c', skyBottom: '#0a1a3a', stars: 1, horizon: '#3b7fd0' },
  lune: { skyTop: '#000000', skyBottom: '#101018', stars: 1, horizon: '#b8b8c0' },
  espace: { skyTop: '#07021a', skyBottom: '#2a0f4a', stars: 1, horizon: '#6a3fb0' },
};

/** Darkens (k < 0) or lightens (k > 0) a #rrggbb colour by a fraction. */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const f = (c: number): number => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  return `#${((f(r) << 16) | (f(g) << 8) | f(b)).toString(16).padStart(6, '0')}`;
}

/** Base, shadow and highlight of one plane colour, precomputed so the render loop allocates nothing. */
export interface Tone {
  base: string;
  dark: string;
  light: string;
}

export interface StageTones {
  hills: Tone;
  far: Tone;
  mid: Tone;
  near: Tone;
  leaf: Tone;
  ground: Tone;
}

const tone = (c: string): Tone => ({ base: c, dark: shade(c, -0.22), light: shade(c, 0.28) });

export const STAGE_TONES: Record<StageId, StageTones> = Object.fromEntries(
  (Object.keys(STAGE_PALETTES) as StageId[]).map((id) => {
    const p = STAGE_PALETTES[id];
    return [id, { hills: tone(p.hills), far: tone(p.far), mid: tone(p.mid), near: tone(p.near), leaf: tone(p.leaf), ground: tone(p.ground) }];
  }),
) as Record<StageId, StageTones>;
