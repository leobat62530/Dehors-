import { BALANCE } from '../config/balance';
import { stageAt, type StageId } from '../game/world';
import { roundRect } from './assets';
import { STAGE_PALETTES } from './palettes';

/**
 * Parallax scenery: three planes behind the ground, each tiled in cells. A cell picks a landmark
 * from the stage under it, placed by a hash of its index, so the same distance always shows the
 * same scene. Landmarks are monuments, landscapes, objects and animals. Never inhabitants.
 * Everything is drawn in screen pixels; `shape` functions draw with the base at (0, 0), y up.
 */

type Shape = (ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) => void;

interface Landmark {
  shape: Shape;
  /** Height range in px at zoom 1. */
  hMin: number;
  hMax: number;
  /** Width as a fraction of height. */
  ratio: number;
  /** Chance (0..1) that a cell shows it. */
  p: number;
}

interface Plane {
  /** Fraction of the camera motion this plane follows. */
  factor: number;
  /** Cell width in px at zoom 1. */
  cell: number;
}

const PLANES: readonly Plane[] = [
  { factor: 0.06, cell: 260 },
  { factor: 0.18, cell: 200 },
  { factor: 0.42, cell: 150 },
];

function hash(i: number, salt: number): number {
  let h = (i * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---- shape vocabulary ---------------------------------------------------------

const block: Shape = (ctx, w, h) => {
  ctx.fillRect(-w / 2, 0, w, h);
};

const tower: Shape = (ctx, w, h) => {
  ctx.fillRect(-w / 2, 0, w, h * 0.8);
  ctx.beginPath();
  ctx.moveTo(-w / 2, h * 0.8);
  ctx.lineTo(0, h);
  ctx.lineTo(w / 2, h * 0.8);
  ctx.fill();
};

const belfry: Shape = (ctx, w, h) => {
  ctx.fillRect(-w / 2, 0, w, h * 0.65);
  ctx.fillRect(-w * 0.7, h * 0.6, w * 1.4, h * 0.08);
  ctx.fillRect(-w * 0.3, h * 0.68, w * 0.6, h * 0.16);
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, h * 0.84);
  ctx.lineTo(0, h);
  ctx.lineTo(w * 0.3, h * 0.84);
  ctx.fill();
};

const gable: Shape = (ctx, w, h) => {
  ctx.fillRect(-w / 2, 0, w, h * 0.6);
  ctx.beginPath();
  ctx.moveTo(-w / 2, h * 0.6);
  ctx.lineTo(-w * 0.3, h * 0.78);
  ctx.lineTo(-w * 0.15, h * 0.88);
  ctx.lineTo(0, h);
  ctx.lineTo(w * 0.15, h * 0.88);
  ctx.lineTo(w * 0.3, h * 0.78);
  ctx.lineTo(w / 2, h * 0.6);
  ctx.fill();
};

const eiffel: Shape = (ctx, w, h) => {
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.quadraticCurveTo(-w * 0.1, h * 0.35, -w * 0.06, h);
  ctx.lineTo(w * 0.06, h);
  ctx.quadraticCurveTo(w * 0.1, h * 0.35, w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-w * 0.32, h * 0.28, w * 0.64, h * 0.04);
  ctx.fillRect(-w * 0.18, h * 0.55, w * 0.36, h * 0.03);
};

const dome: Shape = (ctx, w, h) => {
  ctx.fillRect(-w / 2, 0, w, h * 0.5);
  ctx.beginPath();
  ctx.arc(0, h * 0.5, w / 2, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-w * 0.04, h * 0.5 + w / 2, w * 0.08, h - (h * 0.5 + w / 2));
};

const mountain: Shape = (ctx, w, h, seed) => {
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(-w * (0.1 + seed * 0.2), h);
  ctx.lineTo(w / 2, 0);
  ctx.fill();
};

const snowMountain: Shape = (ctx, w, h, seed) => {
  mountain(ctx, w, h, seed);
  const fill = ctx.fillStyle;
  ctx.fillStyle = '#ffffff';
  const px = -w * (0.1 + seed * 0.2);
  ctx.beginPath();
  ctx.moveTo(px, h);
  ctx.lineTo(px - w * 0.12, h * 0.72);
  ctx.lineTo(px + w * 0.14, h * 0.74);
  ctx.fill();
  ctx.fillStyle = fill;
};

const tree: Shape = (ctx, w, h) => {
  ctx.fillRect(-w * 0.08, 0, w * 0.16, h * 0.4);
  ctx.beginPath();
  ctx.arc(0, h * 0.65, w / 2, 0, Math.PI * 2);
  ctx.fill();
};

const pine: Shape = (ctx, w, h) => {
  ctx.fillRect(-w * 0.08, 0, w * 0.16, h * 0.3);
  ctx.beginPath();
  ctx.moveTo(-w / 2, h * 0.3);
  ctx.lineTo(0, h);
  ctx.lineTo(w / 2, h * 0.3);
  ctx.fill();
};

const palm: Shape = (ctx, w, h) => {
  ctx.fillRect(-w * 0.07, 0, w * 0.14, h * 0.75);
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.15 + (i / 4) * 0.7);
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * w * 0.3, h * 0.78 + Math.sin(a) * w * 0.12, w * 0.3, w * 0.09, -a, 0, Math.PI * 2);
    ctx.fill();
  }
};

const acacia: Shape = (ctx, w, h) => {
  ctx.fillRect(-w * 0.06, 0, w * 0.12, h * 0.6);
  ctx.beginPath();
  ctx.ellipse(0, h * 0.75, w / 2, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
};

const turbine: Shape = (ctx, w, h, seed) => {
  ctx.fillRect(-w * 0.05, 0, w * 0.1, h * 0.85);
  const a0 = seed * Math.PI * 2;
  for (let i = 0; i < 3; i++) {
    const a = a0 + (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.85);
    ctx.lineTo(Math.cos(a) * w * 0.5, h * 0.85 + Math.sin(a) * w * 0.5);
    ctx.lineWidth = w * 0.06;
    ctx.strokeStyle = ctx.fillStyle as string;
    ctx.stroke();
  }
};

const bale: Shape = (ctx, w, h) => {
  ctx.beginPath();
  ctx.arc(0, h / 2, h / 2, 0, Math.PI * 2);
  ctx.fill();
  void w;
};

const containers: Shape = (ctx, w, h, seed) => {
  const rows = 2 + Math.floor(seed * 2);
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    const off = (hash(r, Math.floor(seed * 100)) - 0.5) * w * 0.3;
    ctx.fillRect(-w / 2 + off, r * rh, w * 0.8, rh * 0.9);
  }
};

const skyline: Shape = (ctx, w, h, seed) => {
  const n = 4;
  const bw = w / n;
  for (let i = 0; i < n; i++) {
    const bh = h * (0.4 + hash(i, Math.floor(seed * 1000)) * 0.6);
    ctx.fillRect(-w / 2 + i * bw, 0, bw * 0.85, bh);
  }
};

const bridge: Shape = (ctx, w, h) => {
  ctx.fillRect(-w / 2, h * 0.5, w, h * 0.1);
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(i * w * 0.33, h * 0.5, w * 0.15, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillRect(-w * 0.03, h * 0.5, w * 0.06, h * 0.5);
  ctx.fillRect(w * 0.3, h * 0.5, w * 0.06, h * 0.5);
};

const amphitheatre: Shape = (ctx, w, h) => {
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, h, 0, Math.PI, 0);
  ctx.fill();
  const fill = ctx.fillStyle;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(i * w * 0.18, h * 0.45, w * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = fill;
};

const minaret: Shape = (ctx, w, h) => {
  ctx.fillRect(-w * 0.25, 0, w * 0.5, h * 0.85);
  ctx.fillRect(-w * 0.4, h * 0.6, w * 0.8, h * 0.06);
  ctx.beginPath();
  ctx.arc(0, h * 0.9, w * 0.25, 0, Math.PI * 2);
  ctx.fill();
};

const pyramid: Shape = (ctx, w, h) => {
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(0, h);
  ctx.lineTo(w / 2, 0);
  ctx.fill();
};

const dune: Shape = (ctx, w, h, seed) => {
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.quadraticCurveTo(-w * (0.2 - seed * 0.3), h * 1.6, w / 2, 0);
  ctx.fill();
};

const wave: Shape = (ctx, w, h) => {
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.quadraticCurveTo(-w * 0.25, h * 1.8, 0, h * 0.6);
  ctx.quadraticCurveTo(w * 0.25, 0, w / 2, 0);
  ctx.fill();
};

const ship: Shape = (ctx, w, h) => {
  ctx.beginPath();
  ctx.moveTo(-w / 2, h * 0.4);
  ctx.lineTo(w / 2, h * 0.4);
  ctx.lineTo(w * 0.4, 0);
  ctx.lineTo(-w * 0.4, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(w * 0.1, h * 0.4, w * 0.25, h * 0.6);
  ctx.fillRect(-w * 0.4, h * 0.4, w * 0.45, h * 0.3);
};

const rock: Shape = (ctx, w, h, seed) => {
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(-w * 0.35, h * (0.7 + seed * 0.3));
  ctx.lineTo(w * 0.1, h);
  ctx.lineTo(w * 0.45, h * 0.6);
  ctx.lineTo(w / 2, 0);
  ctx.fill();
};

const bull: Shape = (ctx, w, h) => {
  // The sheet-metal bull silhouette on a hill: an object, not an animal that moves.
  ctx.fillRect(-w * 0.45, h * 0.3, w * 0.9, h * 0.45);
  ctx.fillRect(-w * 0.4, 0, w * 0.1, h * 0.35);
  ctx.fillRect(w * 0.25, 0, w * 0.1, h * 0.35);
  ctx.fillRect(w * 0.4, h * 0.55, w * 0.25, h * 0.35);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.9);
  ctx.lineTo(w * 0.7, h);
  ctx.lineTo(w * 0.6, h * 0.8);
  ctx.fill();
};

const house: Shape = (ctx, w, h) => {
  ctx.fillRect(-w / 2, 0, w, h * 0.7);
  ctx.beginPath();
  ctx.moveTo(-w * 0.55, h * 0.7);
  ctx.lineTo(0, h);
  ctx.lineTo(w * 0.55, h * 0.7);
  ctx.fill();
};

const cubes: Shape = (ctx, w, h, seed) => {
  // White cubic houses in a cluster: architecture only.
  for (let i = 0; i < 4; i++) {
    const cw = w * (0.3 + hash(i, Math.floor(seed * 777)) * 0.2);
    const ch = h * (0.35 + hash(i + 9, Math.floor(seed * 777)) * 0.4);
    ctx.fillRect(-w / 2 + i * w * 0.22, 0, cw, ch);
  }
};

const balloon: Shape = (ctx, w, h) => {
  ctx.beginPath();
  ctx.ellipse(0, h * 0.7, w / 2, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-w * 0.1, h * 0.1, w * 0.2, h * 0.15);
};

const cable: Shape = (ctx, w, h) => {
  ctx.fillRect(-w * 0.04, 0, w * 0.08, h);
  ctx.fillRect(-w / 2, h * 0.9, w, h * 0.04);
  ctx.fillRect(-w * 0.35, h * 0.65, w * 0.18, h * 0.2);
};

const pump: Shape = (ctx, w, h) => {
  ctx.fillRect(-w / 2, h * 0.75, w, h * 0.08);
  ctx.fillRect(-w * 0.45, 0, w * 0.08, h * 0.78);
  ctx.fillRect(w * 0.37, 0, w * 0.08, h * 0.78);
  ctx.fillRect(-w * 0.12, 0, w * 0.24, h * 0.45);
};

const parasol: Shape = (ctx, w, h) => {
  ctx.fillRect(-w * 0.03, 0, w * 0.06, h * 0.8);
  ctx.beginPath();
  ctx.arc(0, h * 0.75, w / 2, Math.PI, 0);
  ctx.fill();
};

const waterfall: Shape = (ctx, w, h) => {
  ctx.fillRect(-w / 2, 0, w, h * 0.6);
  const fill = ctx.fillStyle;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(-w * 0.2, 0, w * 0.4, h * 0.6);
  ctx.fillStyle = fill;
  ctx.fillRect(-w * 0.6, h * 0.6, w * 1.2, h * 0.4);
};

const camel: Shape = (ctx, w, h) => {
  // An animal, like the pigeons and gulls. No rider, no harness.
  ctx.fillRect(-w * 0.4, h * 0.35, w * 0.8, h * 0.3);
  ctx.beginPath();
  ctx.arc(-w * 0.1, h * 0.65, w * 0.18, Math.PI, 0);
  ctx.arc(w * 0.2, h * 0.65, w * 0.18, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(w * 0.35, h * 0.5, w * 0.1, h * 0.4);
  ctx.fillRect(w * 0.35, h * 0.85, w * 0.25, h * 0.12);
  for (const lx of [-0.35, -0.2, 0.1, 0.25]) ctx.fillRect(lx * w, 0, w * 0.07, h * 0.36);
};

const cow: Shape = (ctx, w, h) => {
  ctx.fillRect(-w * 0.4, h * 0.35, w * 0.8, h * 0.4);
  ctx.fillRect(w * 0.3, h * 0.5, w * 0.25, h * 0.3);
  for (const lx of [-0.35, -0.2, 0.1, 0.25]) ctx.fillRect(lx * w, 0, w * 0.08, h * 0.36);
};

// ---- stage compositions -----------------------------------------------------------

type Composition = [Landmark[], Landmark[], Landmark[]];

const L = (shape: Shape, hMin: number, hMax: number, ratio: number, p: number): Landmark => ({
  shape,
  hMin,
  hMax,
  ratio,
  p,
});

const COMPOSITIONS: Record<StageId, Composition> = {
  arras: [
    [L(mountain, 40, 70, 3, 0.5), L(block, 20, 30, 2.5, 0.3)],
    [L(belfry, 150, 190, 0.25, 0.25), L(gable, 70, 110, 0.6, 0.8)],
    [L(house, 40, 60, 1.1, 0.5), L(tree, 40, 60, 0.8, 0.4)],
  ],
  somme: [
    [L(block, 10, 16, 6, 0.6)],
    [L(turbine, 120, 170, 0.5, 0.6), L(tree, 30, 50, 0.9, 0.3)],
    [L(bale, 30, 40, 1, 0.7), L(block, 6, 10, 8, 0.4)],
  ],
  paris: [
    [L(eiffel, 180, 220, 0.5, 0.2), L(dome, 90, 120, 0.7, 0.2), L(skyline, 50, 80, 2.2, 0.8)],
    [L(gable, 70, 100, 0.8, 0.9), L(block, 60, 90, 1.2, 0.5)],
    [L(block, 18, 24, 5, 0.9)],
  ],
  campagne: [
    [L(mountain, 50, 90, 3, 0.5), L(tower, 40, 60, 0.3, 0.25), L(balloon, 50, 70, 0.7, 0.2)],
    [L(tree, 50, 80, 0.9, 0.8), L(pine, 60, 90, 0.5, 0.5), L(house, 35, 50, 1, 0.3)],
    [L(cow, 22, 28, 1.6, 0.4), L(tree, 60, 90, 0.9, 0.5)],
  ],
  lyon: [
    [L(mountain, 60, 100, 2.5, 0.5), L(dome, 100, 130, 0.6, 0.25)],
    [L(block, 60, 100, 1, 0.9), L(tower, 110, 140, 0.3, 0.2)],
    [L(bridge, 50, 70, 3, 0.4), L(house, 40, 55, 1, 0.5)],
  ],
  marseille: [
    [L(mountain, 50, 80, 2.5, 0.6), L(dome, 120, 150, 0.4, 0.2)],
    [L(cubes, 50, 70, 2, 0.8), L(tower, 70, 90, 0.3, 0.2)],
    [L(containers, 50, 70, 1.6, 0.5), L(ship, 40, 60, 2.5, 0.3), L(palm, 60, 80, 0.6, 0.4)],
  ],
  pyrenees: [
    [L(snowMountain, 120, 200, 2.2, 0.9)],
    [L(snowMountain, 90, 140, 1.8, 0.8), L(cable, 100, 130, 1, 0.3)],
    [L(pine, 60, 90, 0.5, 0.7), L(pump, 40, 50, 2, 0.3)],
  ],
  espagne: [
    [L(mountain, 50, 80, 3, 0.5), L(bull, 50, 70, 1.6, 0.25)],
    [L(tower, 120, 170, 0.25, 0.4), L(amphitheatre, 50, 70, 2.5, 0.3), L(block, 40, 60, 1.5, 0.4)],
    [L(tree, 35, 50, 1.1, 0.7), L(parasol, 30, 40, 1, 0.3)],
  ],
  mediterranee: [
    [L(rock, 60, 100, 2, 0.3), L(block, 6, 10, 6, 0.5)],
    [L(ship, 30, 50, 3, 0.4), L(wave, 20, 30, 3, 0.5)],
    [L(wave, 30, 45, 2.6, 0.9)],
  ],
  maroc: [
    [L(mountain, 60, 110, 2.5, 0.7), L(dune, 40, 60, 2.5, 0.3)],
    [L(minaret, 120, 160, 0.3, 0.3), L(cubes, 50, 70, 2, 0.8), L(block, 40, 60, 2, 0.4)],
    [L(palm, 60, 80, 0.6, 0.5), L(camel, 26, 32, 1.5, 0.25)],
  ],
  algerie: [
    [L(mountain, 70, 120, 2.5, 0.7), L(tower, 120, 160, 0.4, 0.15)],
    [L(cubes, 60, 90, 2, 0.9), L(dome, 80, 100, 0.7, 0.2)],
    [L(containers, 50, 70, 1.6, 0.4), L(palm, 50, 70, 0.6, 0.4)],
  ],
  tunisie: [
    [L(block, 8, 14, 8, 0.6), L(mountain, 30, 50, 4, 0.3)],
    [L(cubes, 50, 70, 2, 0.8), L(amphitheatre, 60, 80, 2.5, 0.2), L(dome, 50, 70, 0.8, 0.3)],
    [L(tree, 30, 45, 1.1, 0.5), L(camel, 24, 30, 1.5, 0.2), L(dune, 30, 40, 3, 0.3)],
  ],
  soudan: [
    [L(dune, 40, 70, 3, 0.6), L(pyramid, 60, 90, 1.2, 0.3)],
    [L(pyramid, 50, 80, 1.1, 0.5), L(block, 8, 12, 6, 0.4)],
    [L(dune, 30, 50, 3, 0.8), L(palm, 40, 60, 0.6, 0.2)],
  ],
  somalie: [
    [L(rock, 60, 100, 2.2, 0.5), L(block, 6, 10, 8, 0.6)],
    [L(acacia, 50, 70, 1.2, 0.6), L(rock, 40, 60, 1.5, 0.3)],
    [L(acacia, 50, 80, 1.2, 0.5), L(wave, 20, 30, 3, 0.4)],
  ],
  congo: [
    [L(mountain, 50, 80, 3, 0.5), L(tree, 60, 90, 1, 0.9)],
    [L(tree, 80, 120, 1, 0.95), L(waterfall, 90, 130, 0.8, 0.2)],
    [L(tree, 90, 130, 1, 0.9), L(palm, 80, 110, 0.6, 0.5)],
  ],
  nigeria: [
    [L(rock, 80, 130, 1.6, 0.3), L(skyline, 60, 100, 2.5, 0.6)],
    [L(skyline, 70, 110, 2.2, 0.8), L(bridge, 50, 70, 3.2, 0.3)],
    [L(containers, 50, 70, 1.6, 0.5), L(acacia, 40, 60, 1.2, 0.4)],
  ],
  desert: [
    [L(dune, 50, 90, 3, 0.9)],
    [L(dune, 40, 70, 3, 0.9)],
    [L(dune, 30, 50, 3, 0.9), L(camel, 24, 30, 1.5, 0.08)],
  ],
};

/** Draws the three parallax planes with their base on the horizon line `oy` (screen px). */
export function drawScenery(
  ctx: CanvasRenderingContext2D,
  width: number,
  camX: number,
  camY: number,
  zoom: number,
  oy: number,
): void {
  const ppm = BALANCE.render.pixelsPerMetre;
  for (let p = 0; p < PLANES.length; p++) {
    const plane = PLANES[p] as Plane;
    const cell = plane.cell * zoom;
    const scrollPx = camX * ppm * zoom * plane.factor;
    const baseY = oy + camY * ppm * zoom * plane.factor * 0.15;
    const first = Math.floor(scrollPx / cell) - 1;
    const last = Math.floor((scrollPx + width) / cell) + 1;
    for (let i = first; i <= last; i++) {
      const sx = i * cell - scrollPx + cell * (0.2 + hash(i, 3 + p) * 0.6);
      // The stage under this cell: plane px back to world metres, so the scene changes at the border.
      const worldX = (i * cell) / (ppm * zoom * plane.factor);
      const stage = stageAt(worldX);
      const palette = STAGE_PALETTES[stage.id];
      const list = COMPOSITIONS[stage.id][p] as Landmark[];
      const roll = hash(i, 11 + p);
      let acc = 0;
      for (let k = 0; k < list.length; k++) {
        const lm = list[k] as Landmark;
        acc += lm.p;
        if (roll < acc) {
          const seed = hash(i, 23 + p + k);
          const h = (lm.hMin + (lm.hMax - lm.hMin) * seed) * zoom;
          const w = h * lm.ratio;
          ctx.fillStyle = p === 0 ? palette.far : p === 1 ? palette.mid : palette.near;
          ctx.save();
          ctx.translate(sx, baseY);
          ctx.scale(1, -1);
          lm.shape(ctx, w, h, seed);
          ctx.restore();
          break;
        }
      }
    }
  }
}

/** Road sign sweeping across the screen with a country name. */
export function drawBorderSign(
  ctx: CanvasRenderingContext2D,
  width: number,
  y: number,
  progress: number,
  text: string,
  fontSpec: string,
): void {
  const w = Math.min(width * 0.8, 360);
  const h = 64;
  const x = width + 20 - (width + w + 40) * progress;
  ctx.fillStyle = '#2f6b3a';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = fontSpec;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2);
  // post
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(x + w / 2 - 4, y + h, 8, 26);
}

/** Altitude sign, visually different from the road sign: a dark badge with an up/down chevron. */
export function drawLayerSign(
  ctx: CanvasRenderingContext2D,
  width: number,
  y: number,
  progress: number,
  text: string,
  rising: boolean,
  fontSpec: string,
): void {
  const w = Math.min(width * 0.7, 320);
  const h = 56;
  const x = -w - 20 + (width + w + 40) * progress;
  ctx.fillStyle = 'rgba(10,14,40,0.92)';
  roundRect(ctx, x, y, w, h, 28);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#9fd0ff';
  ctx.stroke();
  ctx.fillStyle = '#9fd0ff';
  ctx.beginPath();
  const cx = x + 30;
  const cy = y + h / 2;
  if (rising) {
    ctx.moveTo(cx - 9, cy + 6);
    ctx.lineTo(cx, cy - 6);
    ctx.lineTo(cx + 9, cy + 6);
  } else {
    ctx.moveTo(cx - 9, cy - 6);
    ctx.lineTo(cx, cy + 6);
    ctx.lineTo(cx + 9, cy - 6);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = fontSpec;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 52, cy);
}

/** Star field for the upper layers, deterministic and allocation-free. */
export function drawStars(ctx: CanvasRenderingContext2D, width: number, height: number, alpha: number, camX: number): void {
  if (alpha <= 0) return;
  ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
  const shift = (camX * 0.002) % width;
  for (let i = 0; i < 90; i++) {
    const x = ((hash(i, 101) * width - shift) % width + width) % width;
    const y = hash(i, 202) * height * 0.8;
    const r = 0.6 + hash(i, 303) * 1.4;
    ctx.fillRect(x, y, r, r);
  }
}
