import { colourAt, type Look, OUTFITS, shoesOf } from './wardrobe';
import { roundRect } from './assets';
import { THEME } from './theme';

/** Pose indices shared with the renderer: on all fours, flying, rolling, standing (record). */
export const CHARACTER_POSE = { fours: 0, flight: 1, roll: 2, stand: 3 } as const;

const OUT = 0.12;
const DARK = 'rgba(20,16,40,0.16)';
const LIGHT = 'rgba(255,255,255,0.22)';
const SKIN_SHADE = 'rgba(120,60,20,0.18)';

/**
 * The one cartoon body for everyone, dressed from the wardrobe manifest: a big head, a round
 * torso and four jointed limbs. Drawn centred at (0, 0) in metres, y up, facing right. The ground
 * is at y = -1.3 when on all fours. `t` drives the limb animation. No skin tone, no feature that
 * follows the nationality.
 */
export function drawCharacter(ctx: CanvasRenderingContext2D, look: Look, pose: number, t = 0): void {
  const outfit = OUTFITS[look.outfit];
  const top = colourAt(look.colours[0]);
  const legs = colourAt(look.colours[1]);
  const shoeColour = colourAt(look.colours[2]);
  const shoes = shoesOf(look);
  const standing = pose === CHARACTER_POSE.stand;
  const flying = pose === CHARACTER_POSE.flight;
  const rolling = pose === CHARACTER_POSE.roll;
  ctx.lineWidth = OUT;
  ctx.strokeStyle = THEME.outline;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.save();
  const bob = pose === CHARACTER_POSE.fours ? Math.sin(t * 7) * 0.04 : 0;
  const flutter = Math.sin(t * 16);

  const covered = outfit.legs !== 'short' && outfit.legs !== 'none';
  const legColour = outfit.legs === 'none' ? top : covered ? legs : THEME.body;
  const sleeve = top;

  // ---- limbs behind the torso -----------------------------------------------------
  if (rolling) {
    // Face-first skid: legs kicking in the air behind, one arm scraping the ground ahead.
    const f = flutter * 0.15;
    limb(ctx, legColour, -0.7, 0.0, -1.25, 0.55 + f, -1.15, 1.25 - f, outfit.legs);
    limb(ctx, legColour, -0.5, 0.15, -0.85, 0.85 - f, -0.3, 1.4 + f, outfit.legs);
    drawShoe(ctx, shoes, shoeColour, -1.15, 1.25 - f, 2.6);
    drawShoe(ctx, shoes, shoeColour, -0.3, 1.4 + f, 2.2);
    limb(ctx, sleeve, 0.2, -0.2, -0.15, 0.45, 0.35, 0.9, 'none', THEME.body);
    hand(ctx, 0.35, 0.9);
  } else if (standing) {
    // Upright: legs straight down, arms raised in a V.
    limb(ctx, legColour, -0.28, -0.2, -0.34, -0.75, -0.32, -1.3, outfit.legs);
    limb(ctx, legColour, 0.22, -0.2, 0.28, -0.75, 0.3, -1.3, outfit.legs);
    drawShoe(ctx, shoes, shoeColour, -0.32, -1.3, 0);
    drawShoe(ctx, shoes, shoeColour, 0.3, -1.3, 0);
    limb(ctx, sleeve, -0.45, 0.55, -0.95, 1.0, -1.25, 1.6, 'none', THEME.body);
    limb(ctx, sleeve, 0.45, 0.55, 0.95, 1.0, 1.25, 1.6, 'none', THEME.body);
  } else if (flying) {
    // Arms stretched forward, legs trailing and fluttering behind.
    const f = flutter * 0.12;
    limb(ctx, legColour, -0.85, -0.2, -1.4, -0.35 + f, -1.95, -0.25 - f, outfit.legs);
    limb(ctx, legColour, -0.75, -0.45, -1.3, -0.7 - f, -1.85, -0.6 + f, outfit.legs);
    drawShoe(ctx, shoes, shoeColour, -1.95, -0.25 - f, -1.5);
    drawShoe(ctx, shoes, shoeColour, -1.85, -0.6 + f, -1.5);
    limb(ctx, sleeve, 0.35, 0.35, 0.65, 1.0, 1.25, 1.45 + f, 'none', THEME.body);
    limb(ctx, sleeve, 0.45, -0.35, 1.1, -0.75, 1.85, -0.55 - f, 'none', THEME.body);
  } else {
    // All fours, ready to be kicked: arms planted in front, legs behind, a nervous bob.
    const k = Math.sin(t * 7 + 1) * 0.03;
    limb(ctx, legColour, -0.95, -0.35, -1.15, -0.85 + k, -1.05, -1.3, outfit.legs);
    limb(ctx, legColour, -0.6, -0.4, -0.7, -0.85 - k, -0.55, -1.3, outfit.legs);
    drawShoe(ctx, shoes, shoeColour, -1.05, -1.3, 0);
    drawShoe(ctx, shoes, shoeColour, -0.55, -1.3, 0);
    limb(ctx, sleeve, 0.35, -0.3, 0.55, -0.85 - k, 0.75, -1.3, 'none', THEME.body);
    limb(ctx, sleeve, 0.7, -0.35, 1.0, -0.85 + k, 1.2, -1.3, 'none', THEME.body);
    hand(ctx, 0.75, -1.3);
    hand(ctx, 1.2, -1.3);
  }

  // ---- torso ------------------------------------------------------------------------
  ctx.save();
  ctx.translate(0, bob);
  const tw = rolling ? 1.7 : standing ? 1.1 : 1.8;
  const th = rolling ? 1.0 : standing ? 1.3 : 1.0;
  const tx = rolling ? -0.85 : standing ? -0.55 : -1.0;
  const ty = standing ? 0.15 : rolling ? -0.35 : 0;
  ctx.translate(0, ty);
  if (rolling) ctx.rotate(-0.42);
  ctx.fillStyle = top;
  roundRect(ctx, tx, -th / 2, tw, th, 0.46);
  ctx.fill();
  ctx.stroke();
  // Belly shade and shoulder highlight give the body some volume.
  ctx.fillStyle = DARK;
  roundRect(ctx, tx + 0.08, -th / 2 + 0.06, tw - 0.16, th * 0.36, 0.3);
  ctx.fill();
  ctx.fillStyle = LIGHT;
  roundRect(ctx, tx + 0.25, th / 2 - 0.3, tw * 0.5, 0.16, 0.08);
  ctx.fill();
  drawTopDetails(ctx, outfit.top, top, legs, standing);
  if (outfit.accessory === 'sacoche' && !rolling) {
    ctx.strokeStyle = '#3b2a1a';
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    ctx.moveTo(-0.6, th / 2);
    ctx.lineTo(0.35, -th / 2 + 0.05);
    ctx.stroke();
    ctx.strokeStyle = THEME.outline;
    ctx.lineWidth = OUT;
    ctx.fillStyle = '#3b2a1a';
    roundRect(ctx, -0.45, -0.4, 0.62, 0.42, 0.1);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c9a43a';
    roundRect(ctx, -0.22, -0.28, 0.16, 0.12, 0.03);
    ctx.fill();
  }
  if (outfit.accessory === 'cravate' && !rolling) {
    ctx.fillStyle = THEME.danger;
    ctx.beginPath();
    ctx.moveTo(0.7, 0.3);
    ctx.lineTo(0.15, 0.08);
    ctx.lineTo(0.7, -0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // ---- head ---------------------------------------------------------------------------
  const headX = rolling ? 1.3 : standing ? 0.05 : 1.15;
  const headY = (rolling ? -0.58 : standing ? 1.45 : flying ? 0.45 : 0.4) + bob;
  const R = 0.72;
  drawHair(ctx, look.hair, headX, headY, R, 'back');
  if (outfit.top === 'sweat') {
    // Hood resting behind the head.
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.ellipse(headX - 0.55, headY - 0.05, 0.5, 0.62, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = THEME.body;
  ctx.beginPath();
  ctx.arc(headX, headY, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = SKIN_SHADE;
  ctx.beginPath();
  ctx.arc(headX, headY, R, Math.PI * 1.15, Math.PI * 1.85);
  ctx.closePath();
  ctx.fill();
  // Ear on the visible side.
  ctx.fillStyle = THEME.body;
  ctx.beginPath();
  ctx.arc(headX - R * 0.92, headY - 0.02, 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawFace(ctx, headX, headY, R, pose, t);
  drawHair(ctx, look.hair, headX, headY, R, 'front');
  if (outfit.head === 'casquette') {
    ctx.fillStyle = legs;
    ctx.beginPath();
    ctx.arc(headX, headY + 0.12, R * 1.02, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = LIGHT;
    ctx.beginPath();
    ctx.arc(headX - 0.15, headY + 0.15, R * 0.9, Math.PI * 0.55, Math.PI * 0.85);
    ctx.lineTo(headX - 0.15, headY + 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = legs;
    roundRect(ctx, headX + 0.25, headY + 0.1, 0.85, 0.2, 0.08);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = THEME.outline;
    ctx.beginPath();
    ctx.arc(headX, headY + R + 0.1, 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  if (outfit.head === 'casque_tissu') {
    ctx.fillStyle = '#ffc531';
    ctx.beginPath();
    ctx.arc(headX, headY + 0.1, R * 1.08, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = LIGHT;
    roundRect(ctx, headX - 0.5, headY + 0.5, 0.6, 0.14, 0.06);
    ctx.fill();
    roundRect(ctx, headX - R * 1.15, headY + 0.08, R * 2.3, 0.14, 0.05);
    ctx.fillStyle = '#ffc531';
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** A limb as two jointed capsules: root, joint, end. `cover` says whether fabric covers it. */
function limb(
  ctx: CanvasRenderingContext2D,
  colour: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cover: string,
  forearm?: string,
): void {
  const bare = forearm !== undefined;
  const skin = forearm ?? THEME.body;
  ctx.lineWidth = 0.34 + OUT * 2;
  ctx.strokeStyle = THEME.outline;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.lineWidth = 0.34;
  ctx.strokeStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  if (cover === 'short') {
    ctx.stroke();
    ctx.strokeStyle = skin;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
  if (cover === 'survet') {
    ctx.lineWidth = 0.08;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  if (cover === 'chaussettes') {
    ctx.lineWidth = 0.34;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo((x1 + x2) / 2, (y1 + y2) / 2);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  // Sleeves stop at the elbow so a hand shows at the end of an arm.
  if (bare) {
    ctx.lineWidth = 0.34;
    ctx.strokeStyle = skin;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.lineWidth = OUT;
  ctx.strokeStyle = THEME.outline;
}

function hand(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = THEME.body;
  ctx.beginPath();
  ctx.arc(x, y, 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawFace(ctx: CanvasRenderingContext2D, hx: number, hy: number, r: number, pose: number, t: number): void {
  const ex = hx + r * 0.42;
  const ey = hy + r * 0.12;
  ctx.lineWidth = OUT;
  if (pose === CHARACTER_POSE.roll) {
    // Skidding on the face: eyes squeezed shut, teeth gritted, cheek scraping.
    ctx.strokeStyle = THEME.outline;
    ctx.lineWidth = 0.1;
    for (const ox of [-0.12, 0.3]) {
      ctx.beginPath();
      ctx.moveTo(ex + ox - 0.12, ey + 0.1);
      ctx.lineTo(ex + ox, ey - 0.02);
      ctx.lineTo(ex + ox + 0.12, ey + 0.1);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, ex - 0.08, ey - 0.46, 0.5, 0.18, 0.05);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      ctx.moveTo(ex - 0.08 + i * 0.125, ey - 0.46);
      ctx.lineTo(ex - 0.08 + i * 0.125, ey - 0.28);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(220,80,80,0.5)';
    ctx.beginPath();
    ctx.ellipse(ex - 0.15, ey - 0.25, 0.14, 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = OUT;
    return;
  }
  const scream = pose === CHARACTER_POSE.flight;
  const grin = pose === CHARACTER_POSE.stand;
  // Eyes: whites, pupils looking ahead, a blink now and then.
  const blink = !scream && Math.sin(t * 1.7) > 0.985;
  for (const ox of [-0.1, 0.32]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const ry = scream ? 0.2 : grin ? 0.1 : 0.16;
    ctx.ellipse(ex + ox, ey, 0.15, blink ? 0.03 : ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (!blink) {
      ctx.fillStyle = THEME.outline;
      ctx.beginPath();
      ctx.arc(ex + ox + 0.05, ey - 0.02, scream ? 0.05 : 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Brows: worried on all fours, raised in flight, happy when standing.
  ctx.strokeStyle = THEME.outline;
  ctx.lineWidth = 0.09;
  ctx.beginPath();
  if (scream) {
    ctx.moveTo(ex - 0.25, ey + 0.34);
    ctx.lineTo(ex, ey + 0.4);
    ctx.moveTo(ex + 0.2, ey + 0.4);
    ctx.lineTo(ex + 0.45, ey + 0.32);
  } else if (grin) {
    ctx.moveTo(ex - 0.25, ey + 0.26);
    ctx.quadraticCurveTo(ex - 0.1, ey + 0.36, ex + 0.03, ey + 0.28);
    ctx.moveTo(ex + 0.2, ey + 0.28);
    ctx.quadraticCurveTo(ex + 0.33, ey + 0.38, ex + 0.46, ey + 0.26);
  } else {
    ctx.moveTo(ex - 0.26, ey + 0.3);
    ctx.lineTo(ex - 0.02, ey + 0.22);
    ctx.moveTo(ex + 0.2, ey + 0.2);
    ctx.lineTo(ex + 0.46, ey + 0.3);
  }
  ctx.stroke();
  // Mouth.
  ctx.lineWidth = OUT;
  if (scream) {
    ctx.fillStyle = '#5a1e2a';
    ctx.beginPath();
    ctx.ellipse(ex + 0.15, ey - 0.38, 0.16, 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ex + 0.02, ey - 0.26, 0.26, 0.06);
  } else if (grin) {
    ctx.fillStyle = '#5a1e2a';
    ctx.beginPath();
    ctx.moveTo(ex - 0.12, ey - 0.3);
    ctx.quadraticCurveTo(ex + 0.15, ey - 0.62, ex + 0.42, ey - 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ex - 0.08, ey - 0.36, 0.46, 0.07);
  } else {
    ctx.beginPath();
    ctx.moveTo(ex - 0.05, ey - 0.38);
    ctx.quadraticCurveTo(ex + 0.15, ey - 0.3, ex + 0.35, ey - 0.4);
    ctx.stroke();
    // A drop of sweat.
    ctx.fillStyle = '#9fd0ff';
    ctx.beginPath();
    ctx.moveTo(hx - r * 0.55, hy + r * 0.55);
    ctx.lineTo(hx - r * 0.45, hy + r * 0.3);
    ctx.lineTo(hx - r * 0.65, hy + r * 0.3);
    ctx.closePath();
    ctx.fill();
  }
}

function drawTopDetails(ctx: CanvasRenderingContext2D, top: string, colour: string, legs: string, standing: boolean): void {
  ctx.lineWidth = OUT;
  if (standing) {
    // Upright, the torso is vertical: only the dress and the football number carry over.
    if (top === 'robe') {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(-0.55, -0.45);
      ctx.lineTo(-0.85, -1.05);
      ctx.lineTo(0.85, -1.05);
      ctx.lineTo(0.55, -0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (top === 'maillot') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-0.2, -0.5, 0.4, 1.1);
    }
    return;
  }
  switch (top) {
    case 'polo':
      // Collar up at the neck, a stylised crocodile on the chest.
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(0.45, 0.5);
      ctx.lineTo(0.8, 0.3);
      ctx.lineTo(0.8, -0.1);
      ctx.lineTo(0.45, 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.moveTo(-0.1, 0.1);
      ctx.lineTo(0.3, 0.2);
      ctx.lineTo(0.2, 0.02);
      ctx.lineTo(0.32, -0.08);
      ctx.lineTo(-0.1, -0.02);
      ctx.closePath();
      ctx.fill();
      break;
    case 'veste':
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0.8, 0.45);
      ctx.lineTo(0.15, 0.1);
      ctx.lineTo(0.8, -0.35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = DARK;
      ctx.fillRect(-0.95, -0.5, 0.5, 1.0);
      break;
    case 'combinaison':
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-0.95, -0.08, 1.7, 0.16);
      ctx.fillStyle = '#c0c8d0';
      ctx.fillRect(-0.95, -0.08, 1.7, 0.05);
      ctx.fillStyle = legs;
      roundRect(ctx, -0.3, -0.5, 0.55, 0.3, 0.06);
      ctx.fill();
      ctx.stroke();
      break;
    case 'maillot':
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-0.45, -0.5, 0.5, 1.0);
      ctx.fillStyle = THEME.outline;
      ctx.font = '700 0.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.scale(1, -1);
      ctx.fillText('10', -0.2, 0);
      ctx.restore();
      break;
    case 'robe':
      // The dress flares below the torso.
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(-1.0, -0.3);
      ctx.lineTo(-1.35, -0.95);
      ctx.lineTo(0.1, -0.95);
      ctx.lineTo(0.05, -0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = LIGHT;
      ctx.fillRect(-1.1, -0.75, 1.0, 0.1);
      break;
    case 'tshirt':
      ctx.fillStyle = LIGHT;
      roundRect(ctx, -0.5, -0.2, 0.9, 0.3, 0.1);
      ctx.fill();
      break;
    case 'sweat':
      // Kangaroo pocket and drawstrings.
      ctx.fillStyle = DARK;
      roundRect(ctx, -0.7, -0.45, 0.9, 0.35, 0.1);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      ctx.moveTo(0.55, 0.4);
      ctx.lineTo(0.5, 0.0);
      ctx.moveTo(0.7, 0.4);
      ctx.lineTo(0.72, 0.05);
      ctx.stroke();
      ctx.strokeStyle = THEME.outline;
      ctx.lineWidth = OUT;
      break;
  }
}

/** A shoe with its toe pointing along `tilt` radians from +x; drawn at the ankle (x, y). */
function drawShoe(ctx: CanvasRenderingContext2D, shoes: string, colour: string, x: number, y: number, tilt: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.lineWidth = OUT;
  ctx.strokeStyle = THEME.outline;
  ctx.fillStyle = colour;
  switch (shoes) {
    case 'bulle': {
      roundRect(ctx, -0.28, -0.22, 0.66, 0.36, 0.12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, -0.3, -0.32, 0.7, 0.16, 0.08);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#bfe3ff';
      roundRect(ctx, -0.2, -0.3, 0.5, 0.08, 0.04);
      ctx.fill();
      break;
    }
    case 'ville':
      ctx.fillStyle = '#3b2a1a';
      roundRect(ctx, -0.26, -0.26, 0.64, 0.3, 0.1);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = LIGHT;
      roundRect(ctx, -0.15, -0.12, 0.3, 0.08, 0.04);
      ctx.fill();
      break;
    case 'bottes':
      roundRect(ctx, -0.22, -0.3, 0.44, 0.65, 0.1);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3b2a1a';
      roundRect(ctx, -0.26, -0.34, 0.6, 0.16, 0.06);
      ctx.fill();
      ctx.stroke();
      break;
    case 'tongs':
      roundRect(ctx, -0.26, -0.2, 0.6, 0.12, 0.06);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = THEME.body;
      roundRect(ctx, -0.2, -0.1, 0.46, 0.2, 0.1);
      ctx.fill();
      ctx.stroke();
      break;
    case 'crampons':
      roundRect(ctx, -0.26, -0.22, 0.6, 0.3, 0.1);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = THEME.outline;
      for (const sx of [-0.16, -0.02, 0.12, 0.26]) ctx.fillRect(sx - 0.03, -0.32, 0.06, 0.1);
      break;
    default:
      roundRect(ctx, -0.26, -0.22, 0.6, 0.3, 0.1);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, -0.26, -0.3, 0.6, 0.12, 0.05);
      ctx.fill();
      ctx.stroke();
  }
  ctx.restore();
}

function drawHair(ctx: CanvasRenderingContext2D, hair: string, hx: number, hy: number, r: number, layer: 'back' | 'front'): void {
  const colour = '#3b2a1a';
  ctx.fillStyle = colour;
  ctx.lineWidth = OUT;
  ctx.strokeStyle = THEME.outline;
  if (layer === 'back') {
    if (hair === 'longue') {
      ctx.beginPath();
      ctx.moveTo(hx - r * 0.2, hy + r * 0.9);
      ctx.quadraticCurveTo(hx - r * 1.7, hy + r * 0.4, hx - r * 1.5, hy - r * 1.0);
      ctx.quadraticCurveTo(hx - r * 0.9, hy - r * 0.9, hx - r * 0.4, hy - r * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (hair === 'attachee') {
      ctx.beginPath();
      ctx.arc(hx - r * 1.05, hy + r * 0.3, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    return;
  }
  if (hair === 'rasee') {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.arc(hx, hy + 0.05, r * 0.98, Math.PI * 0.05, Math.PI * 0.95);
    ctx.closePath();
    ctx.fill();
    return;
  }
  // Short, long and tied all share a fringe swept forward.
  ctx.beginPath();
  ctx.arc(hx, hy + 0.04, r * 1.02, Math.PI * 0.12, Math.PI * 1.08);
  ctx.quadraticCurveTo(hx - r * 0.2, hy + r * 0.55, hx + r * 0.25, hy + r * 0.45);
  ctx.quadraticCurveTo(hx + r * 0.75, hy + r * 0.35, hx + r * 1.02 * Math.cos(Math.PI * 0.12), hy + 0.04 + r * 1.02 * Math.sin(Math.PI * 0.12));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = LIGHT;
  ctx.beginPath();
  ctx.arc(hx - r * 0.2, hy + r * 0.55, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
}
