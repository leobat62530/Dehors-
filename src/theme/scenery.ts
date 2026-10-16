import { BALANCE } from '../config/balance';
import { stageAt, type StageId } from '../game/world';
import { roundRect } from './assets';
import { STAGE_PALETTES, STAGE_TONES, type Tone } from './palettes';

/**
 * Parallax scenery in a flat cartoon style: sun and clouds in the sky, two ranges of rolling
 * hills, then three planes of landmarks tiled in cells. A cell picks a landmark from the stage
 * under it, placed by a hash of its index, so the same distance always shows the same scene.
 * Landmarks are monuments, landscapes, objects and animals. Never inhabitants.
 * Everything is drawn in screen pixels; `Shape` functions draw with the base at (0, 0), y up,
 * with a base colour, its shadow and its highlight.
 */

type Shape = (ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, t: Tone, leaf: Tone) => void;

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
  { factor: 0.08, cell: 260 },
  { factor: 0.2, cell: 210 },
  { factor: 0.45, cell: 160 },
];

const WHITE = '#ffffff';
const GLASS = 'rgba(255,244,200,0.85)';
const SHADOW = 'rgba(20,16,40,0.18)';
const CLOUD_SHADE = 'rgba(120,170,230,0.35)';

function hash(i: number, salt: number): number {
  let h = (i * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---- drawing vocabulary -----------------------------------------------------------

/** Right-hand face in shadow, from x to x + w on the band y..y + h. */
function side(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: Tone): void {
  ctx.fillStyle = t.dark;
  ctx.fillRect(x, y, w, h);
}

/** Grid of windows, some lit, inside the box (x, y, w, h). */
function windows(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cols: number, rows: number, seed: number): void {
  const cw = w / cols;
  const rh = h / rows;
  const ww = Math.max(1.5, cw * 0.42);
  const wh = Math.max(1.5, rh * 0.5);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = hash(r * 31 + c, Math.floor(seed * 9973)) > 0.35 ? GLASS : SHADOW;
      ctx.fillRect(x + c * cw + (cw - ww) / 2, y + r * rh + (rh - wh) / 2, ww, wh);
    }
  }
}

function tri(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();
  ctx.fill();
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ---- shapes ------------------------------------------------------------------------

const block: Shape = (ctx, w, h, seed, t) => {
  ctx.fillStyle = t.base;
  ctx.fillRect(-w / 2, 0, w, h);
  side(ctx, w * 0.25, 0, w * 0.25, h, t);
  windows(ctx, -w * 0.42, h * 0.1, w * 0.6, h * 0.8, 2 + Math.floor(seed * 2), 2 + Math.floor(h / 22), seed);
};

const tower: Shape = (ctx, w, h, seed, t) => {
  ctx.fillStyle = t.base;
  ctx.fillRect(-w / 2, 0, w, h * 0.78);
  side(ctx, w * 0.2, 0, w * 0.3, h * 0.78, t);
  ctx.fillStyle = t.dark;
  tri(ctx, -w * 0.6, h * 0.78, 0, h, w * 0.6, h * 0.78);
  windows(ctx, -w * 0.3, h * 0.15, w * 0.5, h * 0.55, 1, 3, seed);
};

const belfry: Shape = (ctx, w, h, seed, t) => {
  // The belfry of Arras: a square tower, a gallery, a bell chamber and a bulb under the spire.
  ctx.fillStyle = t.base;
  ctx.fillRect(-w / 2, 0, w, h * 0.62);
  side(ctx, w * 0.15, 0, w * 0.35, h * 0.62, t);
  ctx.fillStyle = t.light;
  ctx.fillRect(-w * 0.75, h * 0.6, w * 1.5, h * 0.06);
  ctx.fillStyle = t.base;
  ctx.fillRect(-w * 0.38, h * 0.66, w * 0.76, h * 0.14);
  side(ctx, w * 0.1, h * 0.66, w * 0.28, h * 0.14, t);
  ctx.fillStyle = t.dark;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.84, w * 0.42, h * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  tri(ctx, -w * 0.22, h * 0.86, 0, h, w * 0.22, h * 0.86);
  ctx.fillStyle = '#ffd860';
  disc(ctx, 0, h * 0.995, Math.max(1.5, w * 0.06));
  windows(ctx, -w * 0.3, h * 0.08, w * 0.42, h * 0.45, 1, 4, seed);
  ctx.fillStyle = SHADOW;
  ctx.fillRect(-w * 0.12, h * 0.68, w * 0.24, h * 0.1);
};

const gable: Shape = (ctx, w, h, seed, t) => {
  // Flemish stepped gable.
  ctx.fillStyle = t.base;
  ctx.fillRect(-w / 2, 0, w, h * 0.58);
  side(ctx, w * 0.2, 0, w * 0.3, h * 0.58, t);
  ctx.fillStyle = t.base;
  const steps = 3;
  for (let i = 0; i < steps; i++) {
    const sw = (w * (steps - i)) / steps;
    ctx.fillRect(-sw / 2, h * (0.58 + i * 0.13), sw, h * 0.14);
  }
  ctx.fillRect(-w * 0.1, h * 0.94, w * 0.2, h * 0.06);
  windows(ctx, -w * 0.4, h * 0.08, w * 0.6, h * 0.45, 2, 2, seed);
  ctx.fillStyle = SHADOW;
  ctx.fillRect(-w * 0.12, 0, w * 0.24, h * 0.14);
};

const eiffel: Shape = (ctx, w, h, seed, t) => {
  ctx.fillStyle = t.dark;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.quadraticCurveTo(-w * 0.1, h * 0.35, -w * 0.06, h);
  ctx.lineTo(w * 0.06, h);
  ctx.quadraticCurveTo(w * 0.1, h * 0.35, w / 2, 0);
  ctx.closePath();
  ctx.fill();
  // Arch at the base, platforms and a hint of lattice.
  ctx.fillStyle = t.light;
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, 0);
  ctx.quadraticCurveTo(0, h * 0.3, w * 0.3, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = t.base;
  ctx.fillRect(-w * 0.36, h * 0.27, w * 0.72, h * 0.035);
  ctx.fillRect(-w * 0.2, h * 0.53, w * 0.4, h * 0.03);
  ctx.strokeStyle = t.light;
  ctx.lineWidth = Math.max(1, w * 0.015);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const y = h * (0.06 + i * 0.12);
    const half = w * (0.42 - i * 0.08);
    ctx.moveTo(-half, y);
    ctx.lineTo(half * 0.9, y + h * 0.1);
    ctx.moveTo(half, y);
    ctx.lineTo(-half * 0.9, y + h * 0.1);
  }
  ctx.stroke();
  ctx.fillRect(-w * 0.02, h, w * 0.04, h * 0.06);
  void seed;
};

const dome: Shape = (ctx, w, h, seed, t) => {
  // A white basilica: two small domes beside a great one on a drum.
  ctx.fillStyle = t.base;
  ctx.fillRect(-w / 2, 0, w, h * 0.42);
  side(ctx, w * 0.25, 0, w * 0.25, h * 0.42, t);
  for (const sx of [-0.36, 0.36]) {
    ctx.fillStyle = t.base;
    ctx.fillRect(sx * w - w * 0.1, h * 0.42, w * 0.2, h * 0.12);
    ctx.beginPath();
    ctx.arc(sx * w, h * 0.54, w * 0.11, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = t.base;
  ctx.fillRect(-w * 0.22, h * 0.42, w * 0.44, h * 0.18);
  ctx.beginPath();
  ctx.arc(0, h * 0.6, w * 0.24, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = t.dark;
  ctx.beginPath();
  ctx.arc(0, h * 0.6, w * 0.24, 0, Math.PI * 0.5);
  ctx.lineTo(0, h * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = t.base;
  ctx.fillRect(-w * 0.025, h * 0.6 + w * 0.24, w * 0.05, h - (h * 0.6 + w * 0.24));
  windows(ctx, -w * 0.4, h * 0.08, w * 0.6, h * 0.25, 4, 1, seed);
};

const basilica: Shape = (ctx, w, h, seed, t) => {
  // Four corner towers on a long nave, as on the hill of Lyon.
  ctx.fillStyle = t.base;
  ctx.fillRect(-w / 2, 0, w, h * 0.6);
  side(ctx, w * 0.2, 0, w * 0.3, h * 0.6, t);
  for (const sx of [-0.42, -0.14, 0.14, 0.42]) {
    ctx.fillStyle = t.base;
    ctx.fillRect(sx * w - w * 0.07, h * 0.6, w * 0.14, h * 0.28);
    ctx.fillStyle = t.dark;
    tri(ctx, sx * w - w * 0.08, h * 0.88, sx * w, h, sx * w + w * 0.08, h * 0.88);
  }
  windows(ctx, -w * 0.4, h * 0.12, w * 0.55, h * 0.3, 4, 1, seed);
};

const pencil: Shape = (ctx, w, h, seed, t) => {
  ctx.fillStyle = t.base;
  ctx.fillRect(-w / 2, 0, w, h * 0.82);
  side(ctx, w * 0.15, 0, w * 0.35, h * 0.82, t);
  ctx.fillStyle = t.dark;
  tri(ctx, -w / 2, h * 0.82, 0, h, w / 2, h * 0.82);
  windows(ctx, -w * 0.4, h * 0.05, w * 0.55, h * 0.72, 2, 6, seed);
};

const mountain: Shape = (ctx, w, h, seed, t) => {
  const px = -w * (0.1 + seed * 0.2);
  ctx.fillStyle = t.base;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(px - w * 0.12, h * 0.6);
  ctx.lineTo(px, h);
  ctx.lineTo(px + w * 0.25, h * 0.7);
  ctx.lineTo(w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = t.dark;
  ctx.beginPath();
  ctx.moveTo(px, h);
  ctx.lineTo(px + w * 0.25, h * 0.7);
  ctx.lineTo(w / 2, 0);
  ctx.lineTo(px + w * 0.05, 0);
  ctx.closePath();
  ctx.fill();
};

const snowMountain: Shape = (ctx, w, h, seed, t, leaf) => {
  mountain(ctx, w, h, seed, t, leaf);
  const px = -w * (0.1 + seed * 0.2);
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.moveTo(px, h);
  ctx.lineTo(px - w * 0.1, h * 0.68);
  ctx.lineTo(px - w * 0.03, h * 0.72);
  ctx.lineTo(px + w * 0.06, h * 0.66);
  ctx.lineTo(px + w * 0.14, h * 0.74);
  ctx.closePath();
  ctx.fill();
};

const tree: Shape = (ctx, w, h, seed, t, leaf) => {
  ctx.fillStyle = t.dark;
  ctx.fillRect(-w * 0.07, 0, w * 0.14, h * 0.45);
  ctx.fillStyle = leaf.dark;
  disc(ctx, w * 0.12, h * 0.55, w * 0.36);
  ctx.fillStyle = leaf.base;
  disc(ctx, -w * 0.12, h * 0.6, w * 0.36);
  disc(ctx, w * 0.05, h * 0.75, w * 0.3);
  ctx.fillStyle = leaf.light;
  disc(ctx, -w * 0.12, h * 0.78, w * 0.16);
  void seed;
};

const pine: Shape = (ctx, w, h, seed, t, leaf) => {
  ctx.fillStyle = t.dark;
  ctx.fillRect(-w * 0.07, 0, w * 0.14, h * 0.3);
  for (let i = 0; i < 3; i++) {
    const y = h * (0.2 + i * 0.25);
    const half = w * (0.5 - i * 0.12);
    ctx.fillStyle = leaf.base;
    tri(ctx, -half, y, 0, y + h * 0.42, half, y);
    ctx.fillStyle = leaf.dark;
    tri(ctx, 0, y, 0, y + h * 0.42, half, y);
  }
  void seed;
};

const palm: Shape = (ctx, w, h, seed, t, leaf) => {
  ctx.strokeStyle = t.dark;
  ctx.lineWidth = Math.max(2, w * 0.1);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(w * 0.1, h * 0.5, w * 0.25, h * 0.85);
  ctx.stroke();
  const cx = w * 0.25;
  const cy = h * 0.85;
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.05 + (i / 5) * 0.9);
    ctx.fillStyle = i % 2 === 0 ? leaf.base : leaf.dark;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + Math.cos(a) * w * 0.4, cy + Math.sin(a) * w * 0.4 + w * 0.15, cx + Math.cos(a) * w * 0.65, cy + Math.sin(a) * w * 0.3 - w * 0.15);
    ctx.quadraticCurveTo(cx + Math.cos(a) * w * 0.35, cy + Math.sin(a) * w * 0.25, cx, cy);
    ctx.fill();
  }
  ctx.fillStyle = '#c9a43a';
  disc(ctx, cx, cy - w * 0.05, w * 0.07);
  void seed;
};

const acacia: Shape = (ctx, w, h, seed, t, leaf) => {
  ctx.strokeStyle = t.dark;
  ctx.lineWidth = Math.max(2, w * 0.07);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, h * 0.5);
  ctx.lineTo(-w * 0.25, h * 0.75);
  ctx.moveTo(0, h * 0.5);
  ctx.lineTo(w * 0.3, h * 0.72);
  ctx.stroke();
  ctx.fillStyle = leaf.dark;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.78, w / 2, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = leaf.base;
  ctx.beginPath();
  ctx.ellipse(-w * 0.05, h * 0.84, w * 0.4, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  void seed;
};

const turbine: Shape = (ctx, w, h, seed) => {
  ctx.fillStyle = '#e8eef3';
  ctx.beginPath();
  ctx.moveTo(-w * 0.07, 0);
  ctx.lineTo(w * 0.07, 0);
  ctx.lineTo(w * 0.035, h * 0.85);
  ctx.lineTo(-w * 0.035, h * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c7d1da';
  ctx.fillRect(0, 0, w * 0.07, h * 0.85);
  const a0 = seed * Math.PI * 2;
  ctx.strokeStyle = '#f4f7fa';
  ctx.lineWidth = Math.max(2, w * 0.05);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = a0 + (i * Math.PI * 2) / 3;
    ctx.moveTo(0, h * 0.85);
    ctx.lineTo(Math.cos(a) * w * 0.5, h * 0.85 + Math.sin(a) * w * 0.5);
  }
  ctx.stroke();
  ctx.fillStyle = '#c7d1da';
  disc(ctx, 0, h * 0.85, w * 0.05);
};

const bale: Shape = (ctx, w, h, seed, t) => {
  ctx.fillStyle = t.base;
  disc(ctx, 0, h / 2, h / 2);
  ctx.strokeStyle = t.dark;
  ctx.lineWidth = Math.max(1, h * 0.06);
  ctx.beginPath();
  ctx.arc(0, h / 2, h * 0.3, 0, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, h / 2, h * 0.12, Math.PI, Math.PI * 2.5);
  ctx.stroke();
  void w;
  void seed;
};

const containers: Shape = (ctx, w, h, seed, t) => {
  const rows = 2 + Math.floor(seed * 2);
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    const off = (hash(r, Math.floor(seed * 100)) - 0.5) * w * 0.3;
    ctx.fillStyle = r % 2 === 0 ? t.base : t.dark;
    ctx.fillRect(-w / 2 + off, r * rh, w * 0.8, rh * 0.9);
    ctx.fillStyle = SHADOW;
    for (let k = 1; k < 4; k++) ctx.fillRect(-w / 2 + off + (w * 0.8 * k) / 4, r * rh, 1, rh * 0.9);
  }
};

const skyline: Shape = (ctx, w, h, seed, t) => {
  const n = 5;
  const bw = w / n;
  for (let i = 0; i < n; i++) {
    const bh = h * (0.4 + hash(i, Math.floor(seed * 1000)) * 0.6);
    const x = -w / 2 + i * bw;
    ctx.fillStyle = t.base;
    ctx.fillRect(x, 0, bw * 0.85, bh);
    side(ctx, x + bw * 0.6, 0, bw * 0.25, bh, t);
    windows(ctx, x + bw * 0.08, h * 0.05, bw * 0.45, bh - h * 0.1, 2, Math.max(2, Math.floor(bh / 14)), seed + i);
  }
};

const bridge: Shape = (ctx, w, h, seed, t) => {
  // Deck on piers, with a tower and its cables.
  ctx.fillStyle = t.dark;
  for (const px of [-0.35, 0, 0.35]) ctx.fillRect(px * w - w * 0.03, 0, w * 0.06, h * 0.5);
  ctx.fillStyle = t.base;
  ctx.fillRect(-w / 2, h * 0.5, w, h * 0.1);
  ctx.fillStyle = t.light;
  ctx.fillRect(-w / 2, h * 0.6, w, h * 0.02);
  ctx.fillStyle = t.base;
  ctx.fillRect(-w * 0.03, h * 0.5, w * 0.06, h * 0.5);
  ctx.fillRect(w * 0.32, h * 0.5, w * 0.06, h * 0.5);
  ctx.strokeStyle = t.dark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    ctx.moveTo(0, h);
    ctx.lineTo(-w * 0.45 + i * w * 0.08, h * 0.6);
    ctx.moveTo(w * 0.35, h);
    ctx.lineTo(w * 0.05 + i * w * 0.08, h * 0.6);
  }
  ctx.stroke();
  void seed;
};

const amphitheatre: Shape = (ctx, w, h, seed, t) => {
  ctx.fillStyle = t.base;
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, h, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = t.dark;
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, h, 0, Math.PI * 1.5, Math.PI * 2);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = SHADOW;
  for (let i = -3; i <= 3; i++) {
    const x = i * w * 0.12;
    const top = h * Math.sqrt(Math.max(0, 1 - (x / (w / 2)) ** 2));
    ctx.beginPath();
    ctx.arc(x, top * 0.55, w * 0.035, Math.PI, 0);
    ctx.lineTo(x + w * 0.035, top * 0.3);
    ctx.lineTo(x - w * 0.035, top * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  void seed;
};

const minaret: Shape = (ctx, w, h, seed, t) => {
  ctx.fillStyle = t.base;
  ctx.fillRect(-w * 0.25, 0, w * 0.5, h * 0.78);
  side(ctx, w * 0.08, 0, w * 0.17, h * 0.78, t);
  ctx.fillStyle = t.light;
  ctx.fillRect(-w * 0.38, h * 0.62, w * 0.76, h * 0.05);
  ctx.fillStyle = t.base;
  ctx.fillRect(-w * 0.15, h * 0.78, w * 0.3, h * 0.1);
  ctx.fillStyle = t.dark;
  ctx.beginPath();
  ctx.arc(0, h * 0.88, w * 0.15, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#ffd860';
  for (let i = 0; i < 3; i++) disc(ctx, 0, h * (0.91 + i * 0.03), Math.max(1, w * (0.06 - i * 0.015)));
  ctx.fillStyle = SHADOW;
  ctx.fillRect(-w * 0.08, h * 0.3, w * 0.16, h * 0.14);
  void seed;
};

const pyramid: Shape = (ctx, w, h, seed, t) => {
  ctx.fillStyle = t.base;
  tri(ctx, -w / 2, 0, 0, h, w / 2, 0);
  ctx.fillStyle = t.dark;
  tri(ctx, 0, h, w / 2, 0, w * 0.05, 0);
  ctx.strokeStyle = SHADOW;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 5; i++) {
    const y = (h * i) / 5;
    const half = (w / 2) * (1 - i / 5);
    ctx.moveTo(-half, y);
    ctx.lineTo(half, y);
  }
  ctx.stroke();
  void seed;
};

const dune: Shape = (ctx, w, h, seed, t) => {
  const peak = -w * (0.2 - seed * 0.3);
  ctx.fillStyle = t.base;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.quadraticCurveTo(peak - w * 0.1, h * 1.4, peak, h);
  ctx.quadraticCurveTo(peak + w * 0.2, h * 0.5, w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = t.dark;
  ctx.beginPath();
  ctx.moveTo(peak, h);
  ctx.quadraticCurveTo(peak + w * 0.2, h * 0.5, w / 2, 0);
  ctx.lineTo(peak + w * 0.05, 0);
  ctx.closePath();
  ctx.fill();
};

const wave: Shape = (ctx, w, h) => {
  // A low crest of foam: a thin white curl over the water, not a mound.
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = Math.max(1.5, h * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-w / 2, h * 0.1);
  ctx.quadraticCurveTo(-w * 0.2, h * 0.6, 0, h * 0.35);
  ctx.quadraticCurveTo(w * 0.2, h * 0.1, w / 2, h * 0.3);
  ctx.stroke();
  ctx.fillStyle = WHITE;
  disc(ctx, w * 0.05, h * 0.45, h * 0.12);
};

const ship: Shape = (ctx, w, h, seed, t) => {
  ctx.fillStyle = t.base;
  ctx.beginPath();
  ctx.moveTo(-w / 2, h * 0.4);
  ctx.lineTo(w / 2, h * 0.4);
  ctx.lineTo(w * 0.42, 0);
  ctx.lineTo(-w * 0.42, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = t.dark;
  ctx.fillRect(-w * 0.42, 0, w * 0.84, h * 0.08);
  ctx.fillStyle = WHITE;
  ctx.fillRect(-w * 0.1, h * 0.4, w * 0.35, h * 0.3);
  ctx.fillRect(0, h * 0.7, w * 0.15, h * 0.2);
  ctx.fillStyle = '#e63946';
  ctx.fillRect(w * 0.08, h * 0.9, w * 0.05, h * 0.1);
  ctx.fillStyle = SHADOW;
  for (let i = 0; i < 4; i++) disc(ctx, -w * 0.05 + i * w * 0.08, h * 0.55, h * 0.04);
  void seed;
};

const rock: Shape = (ctx, w, h, seed, t) => {
  ctx.fillStyle = t.base;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(-w * 0.35, h * (0.7 + seed * 0.3));
  ctx.lineTo(w * 0.1, h);
  ctx.lineTo(w * 0.45, h * 0.6);
  ctx.lineTo(w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = t.dark;
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h);
  ctx.lineTo(w * 0.45, h * 0.6);
  ctx.lineTo(w / 2, 0);
  ctx.lineTo(w * 0.12, 0);
  ctx.closePath();
  ctx.fill();
};

const bull: Shape = (ctx, w, h, seed, t) => {
  // The sheet-metal bull silhouette on a hill: an object, not an animal that moves.
  ctx.fillStyle = '#1b1d2a';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.55, w * 0.42, h * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-w * 0.38, 0, w * 0.1, h * 0.4);
  ctx.fillRect(w * 0.22, 0, w * 0.1, h * 0.4);
  ctx.fillRect(w * 0.35, h * 0.55, w * 0.25, h * 0.3);
  tri(ctx, w * 0.5, h * 0.85, w * 0.72, h, w * 0.58, h * 0.78);
  tri(ctx, w * 0.42, h * 0.85, w * 0.3, h * 1.02, w * 0.5, h * 0.8);
  ctx.fillRect(-w * 0.1, 0, w * 0.04, h * 0.5);
  void seed;
  void t;
};

const house: Shape = (ctx, w, h, seed, t) => {
  ctx.fillStyle = t.light;
  ctx.fillRect(-w / 2, 0, w, h * 0.62);
  side(ctx, w * 0.2, 0, w * 0.3, h * 0.62, t);
  ctx.fillStyle = t.dark;
  tri(ctx, -w * 0.58, h * 0.6, 0, h, w * 0.58, h * 0.6);
  ctx.fillStyle = t.base;
  tri(ctx, -w * 0.58, h * 0.6, 0, h, 0, h * 0.6);
  ctx.fillStyle = '#5a3a1e';
  ctx.fillRect(-w * 0.1, 0, w * 0.2, h * 0.32);
  ctx.fillStyle = GLASS;
  ctx.fillRect(w * 0.18, h * 0.25, w * 0.18, h * 0.18);
  ctx.fillRect(-w * 0.38, h * 0.25, w * 0.18, h * 0.18);
  ctx.fillStyle = t.dark;
  ctx.fillRect(w * 0.22, h * 0.72, w * 0.1, h * 0.22);
  void seed;
};

const cubes: Shape = (ctx, w, h, seed, t) => {
  // White cubic houses in a cluster, blue doors: architecture only.
  for (let i = 0; i < 4; i++) {
    const cw = w * (0.3 + hash(i, Math.floor(seed * 777)) * 0.2);
    const ch = h * (0.35 + hash(i + 9, Math.floor(seed * 777)) * 0.4);
    const x = -w / 2 + i * w * 0.22;
    ctx.fillStyle = t.base;
    ctx.fillRect(x, 0, cw, ch);
    side(ctx, x + cw * 0.7, 0, cw * 0.3, ch, t);
    ctx.fillStyle = '#2a6fcf';
    ctx.fillRect(x + cw * 0.2, 0, cw * 0.18, ch * 0.45);
    ctx.fillRect(x + cw * 0.45, ch * 0.55, cw * 0.15, ch * 0.2);
  }
};

const balloon: Shape = (ctx, w, h, seed) => {
  ctx.fillStyle = seed > 0.5 ? '#e63946' : '#f2b134';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.68, w / 2, h * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.68, w * 0.18, h * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a3a1e';
  ctx.fillRect(-w * 0.1, h * 0.1, w * 0.2, h * 0.14);
  ctx.strokeStyle = '#5a3a1e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-w * 0.08, h * 0.24);
  ctx.lineTo(-w * 0.3, h * 0.45);
  ctx.moveTo(w * 0.08, h * 0.24);
  ctx.lineTo(w * 0.3, h * 0.45);
  ctx.stroke();
};

const cable: Shape = (ctx, w, h, seed, t) => {
  ctx.fillStyle = t.base;
  ctx.fillRect(-w * 0.04, 0, w * 0.08, h);
  ctx.fillRect(-w / 2, h * 0.9, w, h * 0.04);
  ctx.strokeStyle = t.base;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-w / 2, h * 0.92);
  ctx.lineTo(w / 2, h * 0.92);
  ctx.stroke();
  ctx.fillStyle = '#e63946';
  ctx.fillRect(-w * 0.38, h * 0.66, w * 0.18, h * 0.2);
  ctx.fillRect(-w * 0.3, h * 0.86, w * 0.02, h * 0.06);
  void seed;
};

const windmill: Shape = (ctx, w, h, seed) => {
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, 0);
  ctx.lineTo(w * 0.3, 0);
  ctx.lineTo(w * 0.24, h * 0.7);
  ctx.lineTo(-w * 0.24, h * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = SHADOW;
  ctx.fillRect(w * 0.05, 0, w * 0.22, h * 0.7);
  ctx.fillStyle = '#2b2b2b';
  tri(ctx, -w * 0.3, h * 0.7, 0, h * 0.95, w * 0.3, h * 0.7);
  ctx.strokeStyle = '#5a3a1e';
  ctx.lineWidth = Math.max(1, w * 0.04);
  ctx.beginPath();
  const a0 = seed * 1.5;
  for (let i = 0; i < 4; i++) {
    const a = a0 + (i * Math.PI) / 2;
    ctx.moveTo(0, h * 0.75);
    ctx.lineTo(Math.cos(a) * w * 0.55, h * 0.75 + Math.sin(a) * w * 0.55);
  }
  ctx.stroke();
  ctx.fillStyle = '#5a3a1e';
  ctx.fillRect(-w * 0.08, 0, w * 0.14, h * 0.25);
};

const lighthouse: Shape = (ctx, w, h, seed) => {
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.moveTo(-w * 0.4, 0);
  ctx.lineTo(w * 0.4, 0);
  ctx.lineTo(w * 0.28, h * 0.8);
  ctx.lineTo(-w * 0.28, h * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e63946';
  for (let i = 0; i < 3; i++) ctx.fillRect(-w * 0.38 + i * w * 0.03, h * (0.12 + i * 0.25), w * 0.76 - i * w * 0.06, h * 0.12);
  ctx.fillStyle = '#1b1d2a';
  ctx.fillRect(-w * 0.32, h * 0.8, w * 0.64, h * 0.05);
  ctx.fillStyle = '#ffd860';
  ctx.fillRect(-w * 0.2, h * 0.85, w * 0.4, h * 0.1);
  ctx.fillStyle = '#1b1d2a';
  tri(ctx, -w * 0.28, h * 0.95, 0, h, w * 0.28, h * 0.95);
  void seed;
};

const pump: Shape = (ctx, w, h, seed, t) => {
  ctx.fillStyle = t.base;
  ctx.fillRect(-w / 2, h * 0.75, w, h * 0.08);
  ctx.fillRect(-w * 0.45, 0, w * 0.08, h * 0.78);
  ctx.fillRect(w * 0.37, 0, w * 0.08, h * 0.78);
  ctx.fillRect(-w * 0.12, 0, w * 0.24, h * 0.45);
  ctx.fillStyle = t.dark;
  ctx.fillRect(-w / 2, h * 0.75, w * 0.3, h * 0.25);
  void seed;
};

const parasol: Shape = (ctx, w, h, seed) => {
  ctx.fillStyle = '#5a3a1e';
  ctx.fillRect(-w * 0.03, 0, w * 0.06, h * 0.8);
  ctx.fillStyle = seed > 0.5 ? '#e63946' : '#2a9d8f';
  ctx.beginPath();
  ctx.arc(0, h * 0.72, w / 2, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.arc(0, h * 0.72, w / 2, Math.PI * 1.25, Math.PI * 1.5);
  ctx.lineTo(0, h * 0.72);
  ctx.closePath();
  ctx.fill();
};

const waterfall: Shape = (ctx, w, h, seed, t) => {
  ctx.fillStyle = t.base;
  ctx.fillRect(-w / 2, 0, w, h * 0.62);
  side(ctx, w * 0.2, 0, w * 0.3, h * 0.62, t);
  ctx.fillStyle = '#bfe3ff';
  ctx.fillRect(-w * 0.2, 0, w * 0.4, h * 0.62);
  ctx.fillStyle = WHITE;
  ctx.fillRect(-w * 0.12, 0, w * 0.1, h * 0.62);
  ctx.fillRect(w * 0.04, 0, w * 0.06, h * 0.62);
  ctx.fillStyle = t.base;
  ctx.fillRect(-w * 0.6, h * 0.6, w * 1.2, h * 0.4);
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.35, h * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  void seed;
};

const camel: Shape = (ctx, w, h, seed, t) => {
  // An animal, like the pigeons and gulls. No rider, no harness.
  ctx.fillStyle = t.base;
  roundRect(ctx, -w * 0.42, h * 0.35, w * 0.84, h * 0.3, h * 0.12);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-w * 0.1, h * 0.65, w * 0.17, Math.PI, 0);
  ctx.arc(w * 0.2, h * 0.65, w * 0.17, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(w * 0.35, h * 0.5, w * 0.1, h * 0.42);
  roundRect(ctx, w * 0.33, h * 0.84, w * 0.27, h * 0.14, h * 0.05);
  ctx.fill();
  for (const lx of [-0.35, -0.2, 0.1, 0.25]) ctx.fillRect(lx * w, 0, w * 0.07, h * 0.36);
  ctx.fillStyle = '#1b1d2a';
  disc(ctx, w * 0.52, h * 0.93, Math.max(1, h * 0.03));
  void seed;
};

const cow: Shape = (ctx, w, h, seed) => {
  ctx.fillStyle = WHITE;
  roundRect(ctx, -w * 0.42, h * 0.35, w * 0.84, h * 0.4, h * 0.1);
  ctx.fill();
  ctx.fillRect(w * 0.3, h * 0.5, w * 0.26, h * 0.32);
  for (const lx of [-0.35, -0.2, 0.1, 0.25]) ctx.fillRect(lx * w, 0, w * 0.08, h * 0.36);
  ctx.fillStyle = '#1b1d2a';
  disc(ctx, -w * 0.15 + seed * w * 0.1, h * 0.55, h * 0.12);
  disc(ctx, w * 0.15, h * 0.62, h * 0.09);
  ctx.fillStyle = '#f4a0a0';
  ctx.fillRect(w * 0.44, h * 0.5, w * 0.12, h * 0.1);
};

const maqam: Shape = (ctx, w, h, seed, t) => {
  // Three concrete palms meeting at the top: a monument, as on the heights of Algiers.
  ctx.fillStyle = t.base;
  for (const sx of [-0.4, 0, 0.4]) {
    ctx.beginPath();
    ctx.moveTo(sx * w - w * 0.1, 0);
    ctx.lineTo(sx * w + w * 0.1, 0);
    ctx.quadraticCurveTo(sx * w * 0.5, h * 0.7, 0, h);
    ctx.quadraticCurveTo(sx * w * 0.4, h * 0.6, sx * w - w * 0.1, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = t.dark;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, 0);
  ctx.lineTo(w * 0.5, 0);
  ctx.quadraticCurveTo(w * 0.2, h * 0.7, 0, h);
  ctx.quadraticCurveTo(w * 0.16, h * 0.6, w * 0.3, 0);
  ctx.closePath();
  ctx.fill();
  void seed;
};

const bigRock: Shape = (ctx, w, h, seed, t) => {
  ctx.fillStyle = t.base;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.quadraticCurveTo(-w * 0.45, h * 1.1, 0, h);
  ctx.quadraticCurveTo(w * 0.45, h * 1.05, w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = t.dark;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.quadraticCurveTo(w * 0.45, h * 1.05, w / 2, 0);
  ctx.lineTo(w * 0.08, 0);
  ctx.closePath();
  ctx.fill();
  void seed;
};

const fence: Shape = (ctx, w, h, seed, t) => {
  ctx.fillStyle = t.base;
  for (let i = 0; i < 4; i++) ctx.fillRect(-w / 2 + (i * w) / 3 - w * 0.03, 0, w * 0.06, h);
  ctx.fillRect(-w / 2, h * 0.35, w, h * 0.12);
  ctx.fillRect(-w / 2, h * 0.7, w, h * 0.12);
  void seed;
};

const bush: Shape = (ctx, w, h, seed, t, leaf) => {
  ctx.fillStyle = leaf.dark;
  disc(ctx, w * 0.2, h * 0.4, h * 0.45);
  ctx.fillStyle = leaf.base;
  disc(ctx, -w * 0.2, h * 0.45, h * 0.5);
  disc(ctx, w * 0.05, h * 0.6, h * 0.4);
  void seed;
  void t;
};

const cactus: Shape = (ctx, w, h, seed, t, leaf) => {
  ctx.fillStyle = leaf.base;
  roundRect(ctx, -w * 0.15, 0, w * 0.3, h, w * 0.15);
  ctx.fill();
  roundRect(ctx, -w * 0.5, h * 0.35, w * 0.25, h * 0.4, w * 0.12);
  ctx.fill();
  ctx.fillRect(-w * 0.5, h * 0.35, w * 0.4, h * 0.14);
  roundRect(ctx, w * 0.25, h * 0.45, w * 0.25, h * 0.35, w * 0.12);
  ctx.fill();
  ctx.fillRect(w * 0.1, h * 0.45, w * 0.4, h * 0.14);
  ctx.fillStyle = leaf.dark;
  ctx.fillRect(w * 0.02, 0, w * 0.1, h * 0.9);
  void seed;
  void t;
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
    [L(belfry, 170, 210, 0.22, 0.2), L(gable, 60, 90, 0.7, 0.5), L(block, 40, 60, 1.6, 0.3)],
    [L(gable, 80, 120, 0.6, 0.7), L(tree, 50, 70, 0.9, 0.3)],
    [L(house, 45, 65, 1.1, 0.4), L(tree, 55, 80, 0.8, 0.3), L(fence, 18, 22, 3.5, 0.2), L(bush, 18, 26, 1.6, 0.1)],
  ],
  somme: [
    [L(turbine, 130, 180, 0.5, 0.5), L(tree, 30, 50, 0.9, 0.2)],
    [L(turbine, 150, 200, 0.5, 0.4), L(tree, 40, 60, 0.9, 0.3), L(house, 35, 50, 1.1, 0.2)],
    [L(bale, 28, 36, 1, 0.5), L(fence, 18, 22, 3.5, 0.3), L(bush, 16, 24, 1.6, 0.2)],
  ],
  paris: [
    [L(eiffel, 220, 260, 0.5, 0.15), L(dome, 100, 130, 0.9, 0.15), L(skyline, 60, 90, 2.4, 0.7)],
    [L(gable, 70, 100, 0.8, 0.3), L(block, 70, 100, 1.1, 0.6)],
    [L(block, 30, 44, 2.6, 0.5), L(tree, 40, 55, 0.8, 0.3), L(fence, 16, 20, 3, 0.2)],
  ],
  campagne: [
    [L(mountain, 60, 110, 2.8, 0.5), L(tower, 50, 70, 0.3, 0.2), L(balloon, 50, 70, 0.7, 0.2)],
    [L(tree, 55, 85, 0.9, 0.6), L(pine, 70, 100, 0.5, 0.3), L(house, 40, 55, 1, 0.1)],
    [L(cow, 22, 28, 1.6, 0.3), L(tree, 60, 90, 0.9, 0.3), L(bush, 16, 24, 1.6, 0.2), L(fence, 18, 22, 3.5, 0.2)],
  ],
  lyon: [
    [L(mountain, 70, 120, 2.5, 0.4), L(basilica, 110, 140, 1.2, 0.2), L(pencil, 130, 160, 0.28, 0.2), L(skyline, 50, 70, 2.2, 0.2)],
    [L(block, 60, 100, 1, 0.7), L(tower, 110, 140, 0.3, 0.2)],
    [L(bridge, 50, 70, 3, 0.3), L(house, 40, 55, 1, 0.4), L(tree, 40, 60, 0.8, 0.3)],
  ],
  marseille: [
    [L(rock, 60, 100, 2.5, 0.5), L(tower, 130, 160, 0.3, 0.2), L(lighthouse, 70, 90, 0.35, 0.1)],
    [L(cubes, 50, 70, 2, 0.6), L(tower, 70, 90, 0.3, 0.2), L(palm, 60, 80, 0.7, 0.2)],
    [L(containers, 50, 70, 1.6, 0.3), L(ship, 40, 60, 2.5, 0.2), L(palm, 60, 85, 0.7, 0.4), L(parasol, 30, 40, 1, 0.1)],
  ],
  pyrenees: [
    [L(snowMountain, 140, 220, 2.2, 0.9)],
    [L(snowMountain, 100, 150, 1.8, 0.7), L(cable, 100, 130, 1, 0.3)],
    [L(pine, 60, 100, 0.5, 0.7), L(rock, 20, 30, 1.6, 0.2)],
  ],
  espagne: [
    [L(mountain, 50, 90, 3, 0.5), L(bull, 50, 70, 1.6, 0.25), L(windmill, 70, 90, 0.6, 0.25)],
    [L(tower, 120, 170, 0.25, 0.3), L(amphitheatre, 50, 70, 2.5, 0.3), L(windmill, 60, 80, 0.6, 0.2), L(block, 40, 60, 1.5, 0.2)],
    [L(tree, 35, 50, 1.1, 0.4), L(parasol, 30, 40, 1, 0.2), L(cactus, 24, 34, 0.8, 0.2), L(house, 35, 50, 1.1, 0.2)],
  ],
  mediterranee: [
    [L(rock, 60, 100, 2, 0.2), L(lighthouse, 60, 80, 0.35, 0.1), L(ship, 20, 30, 3, 0.2)],
    [L(ship, 30, 50, 3, 0.4), L(wave, 20, 30, 3, 0.4)],
    [L(wave, 30, 45, 2.6, 0.9)],
  ],
  maroc: [
    [L(mountain, 60, 110, 2.5, 0.5), L(dune, 40, 60, 2.5, 0.3)],
    [L(minaret, 130, 170, 0.3, 0.3), L(cubes, 50, 70, 2, 0.5), L(pump, 40, 50, 2, 0.1)],
    [L(palm, 60, 85, 0.7, 0.5), L(camel, 26, 32, 1.5, 0.2), L(bush, 16, 22, 1.6, 0.1)],
  ],
  algerie: [
    [L(mountain, 70, 120, 2.5, 0.6), L(maqam, 120, 150, 0.8, 0.15), L(tower, 100, 130, 0.4, 0.1)],
    [L(cubes, 60, 90, 2, 0.8), L(dome, 80, 100, 0.9, 0.2)],
    [L(containers, 50, 70, 1.6, 0.3), L(palm, 50, 70, 0.7, 0.4), L(ship, 30, 40, 2.5, 0.1)],
  ],
  tunisie: [
    [L(mountain, 30, 50, 4, 0.3), L(amphitheatre, 70, 90, 2.5, 0.2), L(cubes, 40, 60, 2, 0.3)],
    [L(cubes, 50, 70, 2, 0.7), L(dome, 50, 70, 0.9, 0.3)],
    [L(tree, 30, 45, 1.1, 0.3), L(camel, 24, 30, 1.5, 0.2), L(dune, 30, 40, 3, 0.3), L(palm, 45, 60, 0.7, 0.2)],
  ],
  soudan: [
    [L(dune, 40, 70, 3, 0.5), L(pyramid, 70, 100, 0.9, 0.4)],
    [L(pyramid, 60, 90, 0.9, 0.5), L(dune, 30, 50, 3, 0.3)],
    [L(dune, 30, 50, 3, 0.6), L(palm, 40, 60, 0.7, 0.2), L(camel, 24, 30, 1.5, 0.1)],
  ],
  somalie: [
    [L(rock, 60, 100, 2.2, 0.4), L(bigRock, 50, 80, 1.6, 0.2), L(ship, 20, 30, 3, 0.1)],
    [L(acacia, 50, 70, 1.3, 0.5), L(rock, 40, 60, 1.5, 0.3)],
    [L(acacia, 50, 80, 1.3, 0.4), L(rock, 20, 30, 1.6, 0.2), L(bush, 16, 22, 1.6, 0.2)],
  ],
  congo: [
    [L(mountain, 50, 80, 3, 0.4), L(tree, 60, 90, 1, 0.6)],
    [L(tree, 80, 120, 1, 0.8), L(waterfall, 90, 130, 0.8, 0.2)],
    [L(tree, 90, 130, 1, 0.6), L(palm, 80, 110, 0.7, 0.3), L(bush, 25, 35, 1.6, 0.1)],
  ],
  nigeria: [
    [L(bigRock, 90, 140, 1.4, 0.2), L(skyline, 70, 110, 2.5, 0.7)],
    [L(skyline, 70, 110, 2.2, 0.6), L(bridge, 50, 70, 3.2, 0.3)],
    [L(containers, 50, 70, 1.6, 0.3), L(acacia, 40, 60, 1.3, 0.3), L(block, 30, 44, 2.4, 0.3)],
  ],
  desert: [
    [L(dune, 50, 90, 3, 0.9)],
    [L(dune, 40, 70, 3, 0.9)],
    [L(dune, 30, 50, 3, 0.8), L(camel, 24, 30, 1.5, 0.08), L(cactus, 20, 30, 0.8, 0.05)],
  ],
};

// ---- sky ------------------------------------------------------------------------------

/** Sun disc with a soft halo; fixed high in the sky, drifting very slowly with the camera. */
export function drawSun(ctx: CanvasRenderingContext2D, width: number, height: number, camX: number, stageId: StageId): void {
  const colour = STAGE_PALETTES[stageId].sun;
  if (!colour) return;
  const x = width * 0.8 - ((camX * 0.02) % (width * 0.3));
  const y = height * 0.12;
  const r = Math.min(width, height) * 0.06;
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.14;
  disc(ctx, x, y, r * 2.6);
  ctx.globalAlpha = 0.22;
  disc(ctx, x, y, r * 1.7);
  ctx.globalAlpha = 1;
  disc(ctx, x, y, r);
}

/** Two layers of fluffy clouds, tiled in cells so the same sky always returns. */
export function drawClouds(ctx: CanvasRenderingContext2D, width: number, horizonY: number, camX: number, zoom: number, stageId: StageId): void {
  const alpha = STAGE_PALETTES[stageId].clouds;
  if (alpha <= 0) return;
  const ppm = BALANCE.render.pixelsPerMetre;
  for (let layer = 0; layer < 2; layer++) {
    const factor = layer === 0 ? 0.02 : 0.05;
    const cell = (layer === 0 ? 420 : 300) * zoom;
    const scrollPx = camX * ppm * zoom * factor;
    const first = Math.floor(scrollPx / cell) - 1;
    const last = Math.floor((scrollPx + width) / cell) + 1;
    ctx.globalAlpha = alpha * (layer === 0 ? 0.6 : 0.95);
    for (let i = first; i <= last; i++) {
      if (hash(i, 41 + layer) > 0.75) continue;
      const x = i * cell - scrollPx + cell * hash(i, 43 + layer);
      const y = horizonY * (0.08 + hash(i, 47 + layer) * 0.5);
      const s = (18 + hash(i, 53 + layer) * 22) * zoom * (layer === 0 ? 0.8 : 1);
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.rect(x - s * 1.1, y + s * 0.2, s * 2.5, s * 0.5);
      ctx.arc(x - s * 1.1, y + s * 0.2, s * 0.7, 0, Math.PI * 2);
      ctx.arc(x - s * 0.3, y - s * 0.3, s * 0.95, 0, Math.PI * 2);
      ctx.arc(x + s * 0.7, y - s * 0.05, s * 0.8, 0, Math.PI * 2);
      ctx.arc(x + s * 1.4, y + s * 0.3, s * 0.55, 0, Math.PI * 2);
      ctx.fill();
      // A soft blue underside, kept inside the cloud's flat bottom.
      ctx.fillStyle = CLOUD_SHADE;
      ctx.beginPath();
      ctx.ellipse(x + s * 0.15, y + s * 0.5, s * 1.5, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ---- hills and landmarks ----------------------------------------------------------

/** One continuous range of rolling hills whose height follows the stage relief under each point. */
function drawHills(ctx: CanvasRenderingContext2D, width: number, camX: number, zoom: number, baseY: number, factor: number, freq: number, phase: number, light: boolean): void {
  const ppm = BALANCE.render.pixelsPerMetre;
  const scrollPx = camX * ppm * zoom * factor;
  const step = 16;
  ctx.beginPath();
  ctx.moveTo(-4, baseY + 4);
  let currentStage = stageAt(camX).id;
  let fill = light ? STAGE_TONES[currentStage].hills.light : STAGE_TONES[currentStage].hills.base;
  for (let x = -step; x <= width + step; x += step) {
    const px = x + scrollPx;
    const worldX = px / (ppm * zoom * factor);
    const stage = stageAt(Math.max(0, worldX));
    const relief = STAGE_PALETTES[stage.id].relief;
    if (stage.id !== currentStage) {
      // Fill what we have in the colour of the stage we are leaving, then start the next run.
      ctx.lineTo(x, baseY + 4);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      currentStage = stage.id;
      fill = light ? STAGE_TONES[currentStage].hills.light : STAGE_TONES[currentStage].hills.base;
      ctx.beginPath();
      ctx.moveTo(x, baseY + 4);
    }
    const amp = (light ? 240 : 140) * zoom * relief;
    const yy = baseY - amp * (0.35 + 0.35 * Math.sin(px * freq + phase) + 0.3 * Math.sin(px * freq * 2.7 + phase * 1.7)) - (light ? 10 : 2) * zoom;
    ctx.lineTo(x, yy);
  }
  ctx.lineTo(width + 4, baseY + 4);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Draws the hills and the three parallax planes with their base on the horizon line `oy` (screen px). */
export function drawScenery(
  ctx: CanvasRenderingContext2D,
  width: number,
  camX: number,
  camY: number,
  zoom: number,
  oy: number,
): void {
  const ppm = BALANCE.render.pixelsPerMetre;
  const lift = camY * ppm * zoom;
  drawHills(ctx, width, camX, zoom, oy + lift * 0.02 * 0.15, 0.02, 0.0025, 0.8, true);
  drawHills(ctx, width, camX, zoom, oy + lift * 0.045 * 0.15, 0.045, 0.0041, 2.1, false);
  for (let p = 0; p < PLANES.length; p++) {
    const plane = PLANES[p] as Plane;
    const cell = plane.cell * zoom;
    const scrollPx = camX * ppm * zoom * plane.factor;
    const baseY = oy + lift * plane.factor * 0.15;
    const first = Math.floor(scrollPx / cell) - 1;
    const last = Math.floor((scrollPx + width) / cell) + 1;
    for (let i = first; i <= last; i++) {
      const sx = i * cell - scrollPx + cell * (0.2 + hash(i, 3 + p) * 0.6);
      // The stage under this cell: plane px back to world metres, so the scene changes at the border.
      const worldX = (i * cell) / (ppm * zoom * plane.factor);
      const stage = stageAt(Math.max(0, worldX));
      const tones = STAGE_TONES[stage.id];
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
          const tone = p === 0 ? tones.far : p === 1 ? tones.mid : tones.near;
          ctx.save();
          ctx.translate(sx, baseY);
          ctx.scale(1, -1);
          lm.shape(ctx, w, h, seed, tone, tones.leaf);
          ctx.restore();
          break;
        }
      }
    }
  }
}

// ---- ground ------------------------------------------------------------------------

/** Ground under the horizon line: a lit band, the body, and a texture that depends on the stage. */
export function drawGround(ctx: CanvasRenderingContext2D, width: number, height: number, ox: number, oy: number, scale: number, camX: number): void {
  if (oy >= height) return;
  const stage = stageAt(camX).id;
  const palette = STAGE_PALETTES[stage];
  const tones = STAGE_TONES[stage].ground;
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, oy, width, height - oy);
  const band = Math.max(4, 0.7 * scale);
  ctx.fillStyle = tones.light;
  ctx.fillRect(0, oy, width, band);
  ctx.fillStyle = palette.groundDark;
  ctx.fillRect(0, oy + band, width, Math.max(2, 0.2 * scale));
  // A darker band lower down gives the flat ground some depth.
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = tones.dark;
  ctx.fillRect(0, oy + (height - oy) * 0.45, width, height - oy);
  ctx.globalAlpha = 0.3;
  ctx.fillRect(0, oy + (height - oy) * 0.8, width, height - oy);
  ctx.globalAlpha = 1;
  // Texture tiles every few metres of world x, so it scrolls with the track.
  const kind = palette.ground_kind;
  const spacing = 3;
  const first = Math.floor(-ox / scale / spacing) * spacing;
  const last = (width - ox) / scale;
  const s = Math.max(scale, 6);
  for (let x = first; x <= last; x += spacing) {
    const i = Math.round(x / spacing);
    const r = hash(i, 7);
    const sx = ox + x * scale + r * spacing * scale * 0.6;
    const depth = oy + band + (height - oy - band) * (0.1 + hash(i, 9) * 0.6);
    switch (kind) {
      case 'herbe':
      case 'jungle':
        ctx.fillStyle = tones.dark;
        tri(ctx, sx - s * 0.12, depth, sx, depth - s * (kind === 'jungle' ? 0.5 : 0.3), sx + s * 0.12, depth);
        if (r > 0.6) {
          ctx.fillStyle = tones.light;
          tri(ctx, sx + s * 0.2, oy + band, sx + s * 0.28, oy + band - s * 0.25, sx + s * 0.36, oy + band);
        }
        break;
      case 'sable':
      case 'terre':
        ctx.fillStyle = r > 0.5 ? tones.dark : tones.light;
        ctx.beginPath();
        ctx.ellipse(sx, depth, s * 0.16, s * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'eau':
        ctx.fillStyle = tones.light;
        roundRect(ctx, sx, depth, s * (0.6 + r), Math.max(1, s * 0.05), 1);
        ctx.fill();
        break;
      case 'neige':
        ctx.fillStyle = tones.dark;
        ctx.beginPath();
        ctx.ellipse(sx, depth, s * 0.3, s * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'bitume':
        if (i % 2 === 0) {
          ctx.fillStyle = '#f3f3f3';
          ctx.fillRect(sx, oy + band + s * 0.9, s * 1.2, Math.max(1.5, s * 0.08));
        }
        break;
    }
  }
  // Distance ticks every 10 m on the lit band give a sense of speed.
  const tick = BALANCE.render.groundTickSpacing;
  const tFirst = Math.floor(-ox / scale / tick) * tick;
  ctx.fillStyle = palette.groundDark;
  for (let x = tFirst; x <= last; x += tick) {
    const sx = ox + x * scale;
    const big = Math.round(x) % (tick * 10) === 0;
    ctx.fillRect(sx - 1, oy, 2, big ? band : band * 0.5);
  }
}

// ---- signs and stars ----------------------------------------------------------------

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
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, x + 4, y + 6, w, h, 10);
  ctx.fill();
  ctx.fillStyle = '#2f6b3a';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 7);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = fontSpec;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2, w - 24);
  // post
  ctx.fillStyle = '#8a8f99';
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
  ctx.fillText(text, x + 52, cy, w - 64);
}

/** Star field for the upper layers, deterministic and allocation-free. */
export function drawStars(ctx: CanvasRenderingContext2D, width: number, height: number, alpha: number, camX: number): void {
  if (alpha <= 0) return;
  ctx.fillStyle = WHITE;
  ctx.globalAlpha = alpha;
  const shift = (camX * 0.002) % width;
  for (let i = 0; i < 90; i++) {
    const x = ((hash(i, 101) * width - shift) % width + width) % width;
    const y = hash(i, 202) * height * 0.8;
    const r = 0.6 + hash(i, 303) * 1.4;
    ctx.fillRect(x, y, r, r);
  }
  ctx.globalAlpha = 1;
}
