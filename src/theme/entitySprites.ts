import type { Entity } from '../game/entities';
import type { StageId } from '../game/world';
import { roundRect } from './assets';
import { STAGE_PALETTES } from './palettes';
import { THEME } from './theme';

/**
 * Placeholder sprites for everything met in flight. Each draws centred on the entity's x, with
 * its base at y = 0 and up positive, in metres: the renderer sets the transform. Replacing one
 * with a PNG or SVG touches nothing else.
 */
type Draw = (ctx: CanvasRenderingContext2D, e: Entity, t: number) => void;

const outline = (ctx: CanvasRenderingContext2D): void => {
  ctx.lineWidth = 0.12;
  ctx.strokeStyle = THEME.outline;
  ctx.lineJoin = 'round';
};

const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
};

const wings = (ctx: CanvasRenderingContext2D, w: number, y: number, flap: number): void => {
  ctx.beginPath();
  ctx.moveTo(-w * 0.1, y);
  ctx.quadraticCurveTo(-w * 0.5, y + flap, -w * 0.9, y + flap * 0.4);
  ctx.moveTo(w * 0.1, y);
  ctx.quadraticCurveTo(w * 0.5, y + flap, w * 0.9, y + flap * 0.4);
  ctx.lineWidth = 0.18;
  ctx.stroke();
};

const BOUNCERS: Record<string, Draw> = {
  pigeon(ctx, e, t) {
    outline(ctx);
    ctx.fillStyle = '#9aa3ad';
    circle(ctx, 0, e.h * 0.5, e.h * 0.4);
    ctx.fillStyle = THEME.outline;
    circle(ctx, e.h * 0.3, e.h * 0.7, 0.06);
    ctx.strokeStyle = '#7d8790';
    wings(ctx, e.w, e.h * 0.55, Math.sin(t * 18 + e.seed * 6) * 0.5);
  },
  ballon(ctx, e, t) {
    outline(ctx);
    const hue = Math.floor(e.seed * 360);
    ctx.fillStyle = `hsl(${hue} 85% 60%)`;
    const bob = Math.sin(t * 2 + e.seed * 9) * 0.1;
    ctx.beginPath();
    ctx.ellipse(0, e.h * 0.62 + bob, e.w * 0.45, e.h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, e.h * 0.2 + bob);
    ctx.lineTo(0, 0);
    ctx.stroke();
  },
  mouette(ctx, e, t) {
    outline(ctx);
    ctx.fillStyle = '#ffffff';
    circle(ctx, 0, e.h * 0.5, e.h * 0.35);
    ctx.fillStyle = '#f2b134';
    ctx.fillRect(e.h * 0.3, e.h * 0.42, 0.35, 0.14);
    ctx.strokeStyle = '#dcdcdc';
    wings(ctx, e.w, e.h * 0.55, Math.sin(t * 10 + e.seed * 6) * 0.6);
  },
  drone(ctx, e, t) {
    outline(ctx);
    ctx.fillStyle = '#3b3f4a';
    ctx.fillRect(-e.w * 0.2, e.h * 0.3, e.w * 0.4, e.h * 0.35);
    ctx.strokeRect(-e.w * 0.2, e.h * 0.3, e.w * 0.4, e.h * 0.35);
    ctx.fillStyle = '#9aa3ad';
    const spin = (t * 40 + e.seed) % 1;
    for (const sx of [-1, 1]) {
      ctx.fillRect(sx * e.w * 0.4 - 0.05, e.h * 0.5, 0.1, e.h * 0.3);
      ctx.fillRect(sx * e.w * 0.4 - e.w * 0.25 * (0.4 + spin * 0.6), e.h * 0.78, e.w * 0.5 * (0.4 + spin * 0.6), 0.1);
    }
    ctx.fillStyle = '#e6b800';
    ctx.fillRect(-e.w * 0.12, e.h * 0.05, e.w * 0.24, e.h * 0.25);
    ctx.strokeRect(-e.w * 0.12, e.h * 0.05, e.w * 0.24, e.h * 0.25);
  },
  montgolfiere(ctx, e) {
    outline(ctx);
    ctx.fillStyle = e.seed > 0.5 ? '#e63946' : '#2a9d8f';
    ctx.beginPath();
    ctx.ellipse(0, e.h * 0.65, e.w * 0.5, e.h * 0.33, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f4e3c1';
    ctx.beginPath();
    ctx.ellipse(0, e.h * 0.65, e.w * 0.18, e.h * 0.33, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(-e.w * 0.12, 0, e.w * 0.24, e.h * 0.14);
    ctx.strokeRect(-e.w * 0.12, 0, e.w * 0.24, e.h * 0.14);
    ctx.beginPath();
    ctx.moveTo(-e.w * 0.1, e.h * 0.14);
    ctx.lineTo(-e.w * 0.3, e.h * 0.4);
    ctx.moveTo(e.w * 0.1, e.h * 0.14);
    ctx.lineTo(e.w * 0.3, e.h * 0.4);
    ctx.stroke();
  },
  trampoline(ctx, e) {
    outline(ctx);
    ctx.fillStyle = '#2b2b2b';
    for (const sx of [-0.4, 0.4]) ctx.fillRect(sx * e.w - 0.1, 0, 0.2, e.h);
    ctx.fillStyle = '#1f6fb5';
    ctx.fillRect(-e.w / 2, e.h, e.w, 0.22);
    ctx.strokeRect(-e.w / 2, e.h, e.w, 0.22);
  },
  chameau(ctx, e, t) {
    outline(ctx);
    ctx.fillStyle = '#d9a35a';
    const stride = Math.sin(t * 3 + e.seed * 5) * 0.15;
    ctx.fillRect(-e.w * 0.4, e.h * 0.4, e.w * 0.8, e.h * 0.3);
    ctx.strokeRect(-e.w * 0.4, e.h * 0.4, e.w * 0.8, e.h * 0.3);
    ctx.beginPath();
    ctx.arc(-e.w * 0.12, e.h * 0.7, e.w * 0.17, Math.PI, 0);
    ctx.arc(e.w * 0.17, e.h * 0.7, e.w * 0.17, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(e.w * 0.36, e.h * 0.55, e.w * 0.1, e.h * 0.42);
    ctx.fillRect(e.w * 0.36, e.h * 0.88, e.w * 0.26, e.h * 0.12);
    for (const lx of [-0.34, -0.2, 0.1, 0.24]) ctx.fillRect(lx * e.w + stride * (lx > 0 ? 1 : -1), 0, e.w * 0.07, e.h * 0.42);
  },
  thermique(ctx, e, t) {
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 0.16;
    for (let i = 0; i < 3; i++) {
      const phase = ((t * 0.6 + i / 3 + e.seed) % 1) * e.h;
      ctx.beginPath();
      ctx.moveTo(-e.w * 0.35, phase);
      ctx.quadraticCurveTo(0, phase + 0.8, e.w * 0.35, phase);
      ctx.stroke();
    }
  },
  poisson(ctx, e, t) {
    outline(ctx);
    ctx.fillStyle = '#5bc0eb';
    ctx.beginPath();
    ctx.ellipse(0, e.h * 0.5, e.w * 0.4, e.h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-e.w * 0.4, e.h * 0.5);
    ctx.lineTo(-e.w * 0.55, e.h * 0.85);
    ctx.lineTo(-e.w * 0.55, e.h * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#cfefff';
    wings(ctx, e.w * 0.8, e.h * 0.6, Math.sin(t * 14 + e.seed) * 0.4 + 0.3);
  },
  satellite(ctx, e, t) {
    outline(ctx);
    ctx.save();
    ctx.translate(0, e.h * 0.5);
    ctx.rotate(t * 0.4 + e.seed * 6);
    ctx.fillStyle = '#d0d4dc';
    ctx.fillRect(-e.w * 0.12, -e.h * 0.2, e.w * 0.24, e.h * 0.4);
    ctx.strokeRect(-e.w * 0.12, -e.h * 0.2, e.w * 0.24, e.h * 0.4);
    ctx.fillStyle = '#2b5fd9';
    for (const sx of [-1, 1]) {
      ctx.fillRect(sx > 0 ? e.w * 0.14 : -e.w * 0.5, -e.h * 0.12, e.w * 0.36, e.h * 0.24);
      ctx.strokeRect(sx > 0 ? e.w * 0.14 : -e.w * 0.5, -e.h * 0.12, e.w * 0.36, e.h * 0.24);
    }
    ctx.restore();
  },
};

const coinStack = (ctx: CanvasRenderingContext2D, w: number, h: number): void => {
  outline(ctx);
  ctx.fillStyle = '#7bc96f';
  roundRect(ctx, -w * 0.45, h * 0.1, w * 0.9, h * 0.55, 0.15);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e8f5e3';
  ctx.fillRect(-w * 0.15, h * 0.1, w * 0.3, h * 0.55);
  ctx.strokeRect(-w * 0.15, h * 0.1, w * 0.3, h * 0.55);
};

const BOOSTERS: Record<string, Draw> = {
  liasse(ctx, e) {
    coinStack(ctx, e.w, e.h);
  },
  sacoche(ctx, e) {
    outline(ctx);
    ctx.fillStyle = '#2b2b2b';
    roundRect(ctx, -e.w * 0.45, 0, e.w * 0.9, e.h * 0.6, 0.25);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, e.h * 0.6, e.w * 0.35, Math.PI, 0);
    ctx.lineWidth = 0.14;
    ctx.stroke();
    ctx.fillStyle = THEME.accent;
    circle(ctx, 0, e.h * 0.3, 0.22);
  },
  scooter(ctx, e, t) {
    outline(ctx);
    ctx.save();
    ctx.rotate(0.6 + Math.sin(t * 6) * 0.05);
    ctx.fillStyle = '#e63946';
    roundRect(ctx, -e.w * 0.45, e.h * 0.3, e.w * 0.9, e.h * 0.3, 0.2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2b2b2b';
    circle(ctx, -e.w * 0.35, e.h * 0.15, e.h * 0.18);
    circle(ctx, e.w * 0.35, e.h * 0.15, e.h * 0.18);
    ctx.fillRect(e.w * 0.3, e.h * 0.55, 0.12, e.h * 0.35);
    ctx.restore();
  },
  video(ctx, e, t) {
    outline(ctx);
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, -e.w * 0.45, 0, e.w * 0.9, e.h * 0.7, 0.15);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.moveTo(-0.2, e.h * 0.2);
    ctx.lineTo(0.3, e.h * 0.35);
    ctx.lineTo(-0.2, e.h * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = THEME.outline;
    ctx.font = '600 0.45px sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.scale(1, -1);
    ctx.fillText(`${Math.floor((t * 97 + e.seed * 900) % 999)}k`, 0, -e.h * 0.85);
    ctx.restore();
  },
  clopes(ctx, e) {
    outline(ctx);
    ctx.fillStyle = '#f4e3c1';
    ctx.fillRect(-e.w * 0.45, e.h * 0.15, e.w * 0.9, e.h * 0.5);
    ctx.strokeRect(-e.w * 0.45, e.h * 0.15, e.w * 0.9, e.h * 0.5);
    ctx.fillStyle = '#b5473a';
    ctx.fillRect(-e.w * 0.45, e.h * 0.45, e.w * 0.9, e.h * 0.2);
  },
  pastis(ctx, e) {
    outline(ctx);
    ctx.fillStyle = '#f7e27a';
    ctx.beginPath();
    ctx.moveTo(-e.w * 0.3, 0);
    ctx.lineTo(e.w * 0.3, 0);
    ctx.lineTo(e.w * 0.35, e.h * 0.9);
    ctx.lineTo(-e.w * 0.35, e.h * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(-e.w * 0.3, e.h * 0.55, e.w * 0.6, e.h * 0.3);
  },
  niche(ctx, e) {
    outline(ctx);
    ctx.fillStyle = '#c9a43a';
    roundRect(ctx, -e.w * 0.45, 0, e.w * 0.9, e.h * 0.6, 0.2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = THEME.outline;
    ctx.fillRect(-e.w * 0.15, e.h * 0.15, e.w * 0.3, e.h * 0.3);
  },
  jet(ctx, e) {
    outline(ctx);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-e.w * 0.5, e.h * 0.4);
    ctx.lineTo(e.w * 0.5, e.h * 0.5);
    ctx.lineTo(e.w * 0.2, e.h * 0.7);
    ctx.lineTo(-e.w * 0.45, e.h * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-e.w * 0.45, e.h * 0.6, e.w * 0.15, e.h * 0.3);
  },
  the(ctx, e) {
    outline(ctx);
    ctx.fillStyle = '#c0c0c0';
    ctx.beginPath();
    ctx.ellipse(0, e.h * 0.1, e.w * 0.5, e.h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d9b44a';
    ctx.fillRect(-e.w * 0.18, e.h * 0.15, e.w * 0.36, e.h * 0.5);
    ctx.strokeRect(-e.w * 0.18, e.h * 0.15, e.w * 0.36, e.h * 0.5);
    ctx.fillStyle = '#3fa34d';
    ctx.fillRect(-e.w * 0.1, e.h * 0.62, e.w * 0.2, e.h * 0.12);
  },
  mirage(ctx, e, t) {
    ctx.fillStyle = `rgba(120,200,255,${(0.25 + Math.sin(t * 3 + e.seed * 4) * 0.15).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(0, e.h * 0.4, e.w * 0.7, e.h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  gourde(ctx, e) {
    outline(ctx);
    ctx.fillStyle = '#4a7fa8';
    roundRect(ctx, -e.w * 0.3, 0, e.w * 0.6, e.h * 0.7, 0.3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(-e.w * 0.12, e.h * 0.7, e.w * 0.24, e.h * 0.2);
  },
};

/** A generic fictional figure: head, torso, no face detail beyond eyes, no skin colour. */
const figure = (ctx: CanvasRenderingContext2D, e: Entity, torso: string, hair: string | null): void => {
  outline(ctx);
  ctx.fillStyle = torso;
  roundRect(ctx, -e.w * 0.3, 0, e.w * 0.6, e.h * 0.55, 0.2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = THEME.body;
  circle(ctx, 0, e.h * 0.72, e.h * 0.18);
  if (hair) {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(0, e.h * 0.78, e.h * 0.19, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = THEME.outline;
  circle(ctx, -0.12, e.h * 0.73, 0.05);
  circle(ctx, 0.12, e.h * 0.73, 0.05);
};

const OBSTACLES: Record<string, Draw> = {
  militante(ctx, e, t) {
    figure(ctx, e, '#2b2b2b', '#3fa9f5');
    ctx.fillStyle = '#ff5fa2';
    ctx.beginPath();
    ctx.arc(0.1, e.h * 0.8, e.h * 0.12, Math.PI, 0);
    ctx.fill();
    // waving arms
    ctx.strokeStyle = THEME.body;
    ctx.lineWidth = 0.2;
    const a = Math.sin(t * 12) * 0.4;
    ctx.beginPath();
    ctx.moveTo(-e.w * 0.3, e.h * 0.45);
    ctx.lineTo(-e.w * 0.6, e.h * (0.7 + a * 0.2));
    ctx.moveTo(e.w * 0.3, e.h * 0.45);
    ctx.lineTo(e.w * 0.6, e.h * (0.7 - a * 0.2));
    ctx.stroke();
  },
  association(ctx, e) {
    figure(ctx, e, '#2a9d8f', '#6b4f3a');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-e.w * 0.7, e.h * 0.2, e.w * 1.4, e.h * 0.25);
    ctx.strokeRect(-e.w * 0.7, e.h * 0.2, e.w * 1.4, e.h * 0.25);
    ctx.fillStyle = THEME.outline;
    for (let i = 0; i < 4; i++) ctx.fillRect(-e.w * 0.6 + i * e.w * 0.32, e.h * 0.3, e.w * 0.22, 0.08);
  },
  helico(ctx, e, t) {
    outline(ctx);
    ctx.fillStyle = '#1f3a93';
    roundRect(ctx, -e.w * 0.5, e.h * 0.2, e.w, e.h * 0.45, 0.4);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(e.w * 0.4, e.h * 0.4, e.w * 0.6, 0.18);
    ctx.fillStyle = '#9aa3ad';
    const spin = Math.abs(Math.sin(t * 30));
    ctx.fillRect(-e.w * 0.8 * spin, e.h * 0.7, e.w * 1.6 * spin, 0.12);
    ctx.fillRect(-0.06, e.h * 0.62, 0.12, e.h * 0.1);
  },
  radar(ctx, e, t) {
    outline(ctx);
    ctx.fillStyle = '#6b6b6b';
    ctx.fillRect(-e.w * 0.08, 0, e.w * 0.16, e.h * 0.5);
    ctx.fillStyle = '#3b3f4a';
    roundRect(ctx, -e.w * 0.35, e.h * 0.5, e.w * 0.7, e.h * 0.45, 0.15);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = Math.sin(t * 6 + e.seed * 9) > 0.7 ? '#ffffff' : '#111';
    circle(ctx, 0, e.h * 0.72, 0.22);
  },
  gendarme(ctx, e, t) {
    figure(ctx, e, '#1f3a93', null);
    ctx.fillStyle = '#1f3a93';
    ctx.fillRect(-e.h * 0.2, e.h * 0.84, e.h * 0.4, e.h * 0.12);
    ctx.strokeRect(-e.h * 0.2, e.h * 0.84, e.h * 0.4, e.h * 0.12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-e.w * 0.3, e.h * 0.3, e.w * 0.6, 0.12);
    ctx.strokeStyle = THEME.body;
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.moveTo(e.w * 0.3, e.h * 0.45);
    ctx.lineTo(e.w * 0.65, e.h * (0.5 + Math.sin(t * 4) * 0.05));
    ctx.stroke();
  },
  impot(ctx, e) {
    outline(ctx);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-e.w * 0.35, 0, e.w * 0.7, e.h * 0.9);
    ctx.strokeRect(-e.w * 0.35, 0, e.w * 0.7, e.h * 0.9);
    ctx.fillStyle = THEME.danger;
    for (let i = 0; i < 4; i++) ctx.fillRect(-e.w * 0.25, e.h * (0.15 + i * 0.18), e.w * 0.5, 0.08);
  },
  baril(ctx, e) {
    outline(ctx);
    ctx.fillStyle = '#2b2b2b';
    roundRect(ctx, -e.w * 0.35, 0, e.w * 0.7, e.h * 0.9, 0.15);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#6b6b6b';
    ctx.fillRect(-e.w * 0.35, e.h * 0.3, e.w * 0.7, 0.1);
    ctx.fillRect(-e.w * 0.35, e.h * 0.6, e.w * 0.7, 0.1);
  },
  urssaf(ctx, e) {
    figure(ctx, e, '#6b6b6b', '#2b2b2b');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(e.w * 0.2, e.h * 0.25, e.w * 0.4, e.h * 0.3);
    ctx.strokeRect(e.w * 0.2, e.h * 0.25, e.w * 0.4, e.h * 0.3);
  },
};

/** Wall skins, one per stage: a simple reskin of the same obstacle. */
type WallSkin = (ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) => void;

const stripes = (ctx: CanvasRenderingContext2D, w: number, h: number, a: string, b: string, step: number): void => {
  for (let y = 0; y < h; y += step) {
    ctx.fillStyle = Math.floor(y / step) % 2 === 0 ? a : b;
    ctx.fillRect(-w / 2, y, w, Math.min(step, h - y));
  }
};

const blocks = (ctx: CanvasRenderingContext2D, w: number, h: number, color: string, mortar: string, bh: number): void => {
  ctx.fillStyle = color;
  ctx.fillRect(-w / 2, 0, w, h);
  ctx.fillStyle = mortar;
  for (let y = bh; y < h; y += bh) ctx.fillRect(-w / 2, y, w, bh * 0.08);
  for (let y = 0; y < h; y += bh) ctx.fillRect(Math.floor(y / bh) % 2 === 0 ? -w * 0.1 : w * 0.1, y, w * 0.04, bh);
};

const WALL_SKINS: Record<StageId, WallSkin> = {
  arras: (ctx, w, h) => stripes(ctx, w, h, '#e63946', '#ffffff', 2.5),
  somme: (ctx, w, h) => blocks(ctx, w, h, '#e3c45a', '#b8962f', 3),
  paris: (ctx, w, h) => blocks(ctx, w, h, '#8a8f99', '#5f636b', 4),
  campagne: (ctx, w, h) => stripes(ctx, w, h, '#6fa36b', '#4d7a4a', 3),
  lyon: (ctx, w, h) => {
    ctx.fillStyle = '#b8b8b8';
    ctx.fillRect(-w / 2, 0, w, h);
    ctx.fillStyle = '#6b6b6b';
    for (let y = 0; y < h; y += 3) ctx.fillRect(-w / 2, y, w, 0.3);
    ctx.fillRect(-w * 0.1, 0, w * 0.2, h);
  },
  marseille: (ctx, w, h) => stripes(ctx, w, h, '#1f6fa8', '#e63946', 3),
  pyrenees: (ctx, w, h) => stripes(ctx, w, h, '#ffffff', '#d84f3a', 2),
  espagne: (ctx, w, h) => {
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(-w / 2, 0, w, h);
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(-w / 2, h * 0.3, w, h * 0.4);
  },
  mediterranee: (ctx, w, h) => {
    ctx.fillStyle = '#1f6fb5';
    ctx.fillRect(-w / 2, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, h, w * 1.5, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  maroc: (ctx, w, h) => blocks(ctx, w, h, '#c98a4a', '#9a6433', 4),
  algerie: (ctx, w, h) => stripes(ctx, w, h, '#2f6fa8', '#d9d9d9', 3),
  tunisie: (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-w / 2, 0, w, h);
    ctx.fillStyle = '#2a6fcf';
    for (let y = 2; y < h; y += 6) ctx.fillRect(-w / 2, y, w, 1.2);
  },
  soudan: (ctx, w, h) => blocks(ctx, w, h, '#d9a35a', '#a8763a', 5),
  somalie: (ctx, w, h) => blocks(ctx, w, h, '#b58a5a', '#8a6a44', 7),
  congo: (ctx, w, h) => {
    ctx.fillStyle = '#5a3a1e';
    ctx.fillRect(-w / 2, 0, w, h);
    ctx.fillStyle = '#3f8a3a';
    for (let y = 0; y < h; y += 4) ctx.fillRect(-w / 2, y + 1, w, 0.6);
  },
  nigeria: (ctx, w, h) => stripes(ctx, w, h, '#d84f3a', '#3b3f4a', 3),
  desert: (ctx, w, h) => {
    ctx.fillStyle = '#f0c070';
    ctx.fillRect(-w / 2, 0, w, h);
    ctx.fillStyle = '#c48f3c';
    for (let y = 0; y < h; y += 5) ctx.fillRect(-w / 2, y, w, 0.5);
  },
};

export function drawEntity(ctx: CanvasRenderingContext2D, e: Entity, t: number, stageId: StageId): void {
  if (e.type === 'wall') {
    const skin = WALL_SKINS[stageId] ?? WALL_SKINS.arras;
    ctx.save();
    if (e.used) {
      // Shattered: the wall crumbles in a cloud of rubble for a moment.
      const k = Math.min(1, e.usedTime / 0.6);
      ctx.globalAlpha = 1 - k;
      ctx.translate(0, -k * e.h * 0.6);
    }
    skin(ctx, e.w, e.h, e.seed);
    ctx.lineWidth = 0.3;
    ctx.strokeStyle = THEME.outline;
    ctx.strokeRect(-e.w / 2, 0, e.w, e.h);
    ctx.restore();
    return;
  }
  if (e.type === 'coin') {
    // Gold disc, bobbing; bigger when it is worth more. Pops upward when picked.
    const r = 0.5 + Math.min(4, e.value - 1) * 0.08;
    const bob = Math.sin(t * 4 + e.seed * 6) * 0.12;
    ctx.save();
    if (e.used) {
      const k = Math.min(1, e.usedTime / 0.4);
      ctx.globalAlpha = 1 - k;
      ctx.translate(0, k * 2.5);
    }
    ctx.translate(0, r + bob);
    ctx.fillStyle = THEME.accent;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 0.12;
    ctx.strokeStyle = '#b8860b';
    ctx.stroke();
    ctx.fillStyle = '#fff2b0';
    ctx.beginPath();
    ctx.arc(-r * 0.25, r * 0.25, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const draw = e.type === 'bouncer' ? BOUNCERS[e.kind] : e.type === 'booster' ? BOOSTERS[e.kind] : OBSTACLES[e.kind];
  if (!draw) return;
  ctx.save();
  if (e.used) {
    const k = Math.min(1, e.usedTime / 0.5);
    ctx.globalAlpha = 1 - k;
    if (e.type === 'bouncer') ctx.rotate(k * 3);
    if (e.type === 'booster') ctx.translate(0, k * 3);
  }
  draw(ctx, e, t);
  ctx.restore();
}

export const WALL_PALETTE = STAGE_PALETTES;
