import { BALANCE } from '../config/balance';

export type StageId = (typeof BALANCE.stages)[number]['id'];
export type LayerId = (typeof BALANCE.layers)[number]['id'];

export interface Stage {
  readonly id: StageId;
  readonly from: number;
  readonly wind: number;
}

export interface Layer {
  readonly id: LayerId;
  readonly from: number;
}

const STAGES: readonly Stage[] = BALANCE.stages;
const LAYERS: readonly Layer[] = BALANCE.layers;

/** Index of the ground stage for a distance x (m). Depends on x only, never on altitude. */
export function stageIndexAt(x: number): number {
  let i = 0;
  for (let k = 1; k < STAGES.length; k++) {
    if (x >= (STAGES[k] as Stage).from) i = k;
    else break;
  }
  return i;
}

export function stageAt(x: number): Stage {
  return STAGES[stageIndexAt(x)] as Stage;
}

/** Index of the sky layer for an altitude y (m). Depends on y only, never on distance. */
export function layerIndexAt(y: number): number {
  let i = 0;
  for (let k = 1; k < LAYERS.length; k++) {
    if (y >= (LAYERS[k] as Layer).from) i = k;
    else break;
  }
  return i;
}

export function layerAt(y: number): Layer {
  return LAYERS[layerIndexAt(y)] as Layer;
}

/** Start of the next stage after x, or Infinity on the endless final stage. */
export function nextBorderAfter(x: number): number {
  const i = stageIndexAt(x);
  const next = STAGES[i + 1];
  return next ? next.from : Number.POSITIVE_INFINITY;
}

/** Distance (m) from x to the next stage border, Infinity on the endless final stage. */
export function distanceToNextBorder(x: number): number {
  return nextBorderAfter(x) - x;
}

export const STAGE_COUNT = STAGES.length;
export const LAYER_COUNT = LAYERS.length;
export { STAGES, LAYERS };
