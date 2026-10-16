import type { LayerId, StageId } from '../game/world';

/** Colours of one ground stage: sky, ground and the three parallax planes. Placeholders. */
export interface StagePalette {
  skyTop: string;
  skyBottom: string;
  ground: string;
  groundDark: string;
  far: string;
  mid: string;
  near: string;
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
  arras: { skyTop: '#5aa9e6', skyBottom: '#bfe3ff', ground: '#6bbf59', groundDark: '#3f8f3a', far: '#9bb8d4', mid: '#b5473a', near: '#8b2f27' },
  somme: { skyTop: '#8da5bd', skyBottom: '#d9e2ea', ground: '#9fbf5a', groundDark: '#6f8f3a', far: '#aab9c8', mid: '#f0f0f0', near: '#c9a43a' },
  paris: { skyTop: '#4f8fd6', skyBottom: '#cfe6ff', ground: '#8a8f99', groundDark: '#5f636b', far: '#8fa3b8', mid: '#6d7580', near: '#c9b79c' },
  campagne: { skyTop: '#59b0e9', skyBottom: '#d6f0ff', ground: '#5fb84f', groundDark: '#3a8a2e', far: '#7fa88a', mid: '#2f6b3a', near: '#4e9b3f' },
  lyon: { skyTop: '#5c9ad8', skyBottom: '#d4e8f7', ground: '#8fb06a', groundDark: '#5e7d45', far: '#a1b4c4', mid: '#d9b48a', near: '#4a7fa8' },
  marseille: { skyTop: '#2f8fe0', skyBottom: '#bfe6ff', ground: '#d6c08a', groundDark: '#a8925e', far: '#9fc7dd', mid: '#f4e3c1', near: '#1f6fa8' },
  pyrenees: { skyTop: '#6aa6e0', skyBottom: '#e8f3ff', ground: '#f2f6fa', groundDark: '#b9c6d3', far: '#c8d7e6', mid: '#7b8fa4', near: '#d84f3a' },
  espagne: { skyTop: '#3d8fe3', skyBottom: '#ffe4a8', ground: '#d8b36a', groundDark: '#a9843f', far: '#c6a46f', mid: '#8c6a3a', near: '#2b2b2b' },
  mediterranee: { skyTop: '#2f86e6', skyBottom: '#bfe3ff', ground: '#1f6fb5', groundDark: '#155084', far: '#a9c9e6', mid: '#ffffff', near: '#3a3a3a' },
  maroc: { skyTop: '#4d9ae0', skyBottom: '#ffd9a1', ground: '#e0b56e', groundDark: '#b5883f', far: '#b89a6a', mid: '#d9c3a0', near: '#8a5a2b' },
  algerie: { skyTop: '#3f93e3', skyBottom: '#d2ecff', ground: '#dcc58f', groundDark: '#a8925e', far: '#9fb8c9', mid: '#f5f5f5', near: '#2f6fa8' },
  tunisie: { skyTop: '#3d9be8', skyBottom: '#eaf6ff', ground: '#e6d6a3', groundDark: '#b8a46e', far: '#c7d3dc', mid: '#ffffff', near: '#2a6fcf' },
  soudan: { skyTop: '#6aa0d8', skyBottom: '#ffd79a', ground: '#e3b86f', groundDark: '#b48a42', far: '#c89f6a', mid: '#b5803f', near: '#3a7fc0' },
  somalie: { skyTop: '#4f9fe3', skyBottom: '#dff1ff', ground: '#d9c08a', groundDark: '#a8925e', far: '#9fc0d8', mid: '#c7a26a', near: '#5f8f3a' },
  congo: { skyTop: '#5f8fb5', skyBottom: '#cfe3d8', ground: '#3f8a3a', groundDark: '#2a5f28', far: '#7fa58f', mid: '#2f6b3a', near: '#1f4a28' },
  nigeria: { skyTop: '#4a96e0', skyBottom: '#ffe0b0', ground: '#c9a85e', groundDark: '#967b3c', far: '#8fa8bf', mid: '#5f6b78', near: '#7a5a2b' },
  desert: { skyTop: '#f6a24a', skyBottom: '#ffe3b0', ground: '#f0c070', groundDark: '#c48f3c', far: '#e9b36a', mid: '#d99a4f', near: '#b8762e' },
};

export const LAYER_PALETTES: Record<LayerId, LayerPalette> = {
  troposphere: { skyTop: '#5aa9e6', skyBottom: '#bfe3ff', stars: 0, horizon: '#6bbf59' },
  stratosphere: { skyTop: '#06102a', skyBottom: '#2f6fb5', stars: 0.5, horizon: '#7fb2e0' },
  orbite: { skyTop: '#02040c', skyBottom: '#0a1a3a', stars: 1, horizon: '#3b7fd0' },
  lune: { skyTop: '#000000', skyBottom: '#101018', stars: 1, horizon: '#b8b8c0' },
  espace: { skyTop: '#07021a', skyBottom: '#2a0f4a', stars: 1, horizon: '#6a3fb0' },
};
