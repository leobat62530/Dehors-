import { colourAt, type Look, OUTFITS, shoesOf } from './wardrobe';
import { roundRect } from './assets';
import { THEME } from './theme';

/** Pose indices shared with the renderer: on all fours, flying, rolling, standing (record). */
export const CHARACTER_POSE = { fours: 0, flight: 1, roll: 2, stand: 3 } as const;

const W = 2.2;
const H = 1.6;

/**
 * The one cartoon body for everyone, dressed from the wardrobe manifest. Drawn centred at (0, 0)
 * in metres, y up, facing right. No skin tone, no feature that follows the nationality.
 */
export function drawCharacter(ctx: CanvasRenderingContext2D, look: Look, pose: number): void {
  const outfit = OUTFITS[look.outfit];
  const top = colourAt(look.colours[0]);
  const legs = colourAt(look.colours[1]);
  const shoeColour = colourAt(look.colours[2]);
  const shoes = shoesOf(look);
  const standing = pose === CHARACTER_POSE.stand;
  ctx.lineWidth = 0.14;
  ctx.strokeStyle = THEME.outline;
  ctx.lineJoin = 'round';

  ctx.save();
  if (standing) ctx.rotate(Math.PI / 2);
  // Legs behind the torso: four on all fours, two tucked back in flight, none in a roll.
  const legCount = pose === CHARACTER_POSE.fours || standing ? 4 : pose === CHARACTER_POSE.flight ? 2 : 0;
  const legXs = legCount === 4 ? [-0.75, -0.35, 0.45, 0.85] : [-0.7, -0.3];
  const legTop = -H / 2 + 0.1;
  const legLen = legCount === 4 ? 0.6 : 0.45;
  for (const lx of legXs) {
    const covered = outfit.legs !== 'short' && outfit.legs !== 'none';
    const legColour = outfit.legs === 'none' ? top : covered ? legs : THEME.body;
    ctx.fillStyle = legColour;
    ctx.fillRect(lx - 0.13, legTop - legLen, 0.26, legLen + 0.1);
    ctx.strokeRect(lx - 0.13, legTop - legLen, 0.26, legLen + 0.1);
    if (outfit.legs === 'survet') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(lx - 0.03, legTop - legLen, 0.06, legLen);
    }
    if (outfit.legs === 'chaussettes') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(lx - 0.13, legTop - legLen, 0.26, 0.25);
    }
    drawShoe(ctx, shoes, shoeColour, lx, legTop - legLen);
  }

  // Torso: shoulders and hips follow the gender, same face and animations for all.
  const front = look.gender === 'm' ? 0.92 : look.gender === 'f' ? 0.74 : 0.8;
  const back = look.gender === 'f' ? 0.92 : look.gender === 'm' ? 0.74 : 0.8;
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(-W / 2, -H / 2 + (1 - back) * 0.5);
  ctx.lineTo(-W / 2, H / 2 - (1 - back) * 0.5);
  ctx.quadraticCurveTo(0, H / 2 + 0.12, W / 2, H / 2 - (1 - front) * 0.5);
  ctx.lineTo(W / 2, -H / 2 + (1 - front) * 0.5);
  ctx.quadraticCurveTo(0, -H / 2 - 0.1, -W / 2, -H / 2 + (1 - back) * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  drawTopDetails(ctx, outfit.top, top, legs);
  if (outfit.accessory === 'sacoche') {
    ctx.strokeStyle = '#3b2a1a';
    ctx.lineWidth = 0.16;
    ctx.beginPath();
    ctx.moveTo(-0.9, H / 2);
    ctx.lineTo(0.4, -H / 2 + 0.1);
    ctx.stroke();
    ctx.fillStyle = '#3b2a1a';
    roundRect(ctx, -0.3, -0.35, 0.6, 0.45, 0.1);
    ctx.fill();
    ctx.strokeStyle = THEME.outline;
    ctx.lineWidth = 0.14;
    ctx.stroke();
  }
  if (outfit.accessory === 'cravate') {
    ctx.fillStyle = THEME.danger;
    ctx.beginPath();
    ctx.moveTo(0.75, 0.25);
    ctx.lineTo(0.2, 0.05);
    ctx.lineTo(0.75, -0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Head at the front, same for everyone: eyes, brows, mouth.
  const headX = W / 2 + 0.25;
  const headY = pose === CHARACTER_POSE.fours || standing ? 0.15 : 0.35;
  drawHair(ctx, look.hair, headX, headY, 'back');
  ctx.fillStyle = THEME.body;
  ctx.beginPath();
  ctx.arc(headX, headY, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawHair(ctx, look.hair, headX, headY, 'front');
  ctx.fillStyle = THEME.outline;
  ctx.beginPath();
  ctx.arc(headX + 0.2, headY + 0.15, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 0.08;
  ctx.beginPath();
  ctx.moveTo(headX + 0.05, headY + 0.36);
  ctx.lineTo(headX + 0.35, headY + 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(headX + 0.22, headY - 0.18);
  ctx.lineTo(headX + 0.48, headY - 0.12);
  ctx.stroke();
  ctx.lineWidth = 0.14;
  if (outfit.head === 'casquette') {
    ctx.fillStyle = legs;
    ctx.beginPath();
    ctx.arc(headX, headY + 0.1, 0.62, 0, Math.PI, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(headX + 0.3, headY + 0.08, 0.7, 0.14);
    ctx.strokeRect(headX + 0.3, headY + 0.08, 0.7, 0.14);
  }
  if (outfit.head === 'casque_tissu') {
    ctx.fillStyle = '#ffc531';
    ctx.beginPath();
    ctx.arc(headX, headY + 0.1, 0.68, 0, Math.PI, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (outfit.top === 'sweat') {
    // Hood resting behind the head.
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.arc(headX - 0.55, headY - 0.1, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawTopDetails(ctx: CanvasRenderingContext2D, top: string, colour: string, legs: string): void {
  ctx.fillStyle = '#ffffff';
  switch (top) {
    case 'polo':
      // Collar up and a stylised crocodile.
      ctx.fillStyle = colour;
      ctx.fillRect(W / 2 - 0.3, 0.3, 0.3, 0.55);
      ctx.strokeRect(W / 2 - 0.3, 0.3, 0.3, 0.55);
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.moveTo(0.2, 0.2);
      ctx.lineTo(0.55, 0.3);
      ctx.lineTo(0.45, 0.12);
      ctx.lineTo(0.2, 0.05);
      ctx.closePath();
      ctx.fill();
      break;
    case 'veste':
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(W / 2, 0.5);
      ctx.lineTo(0.3, 0.05);
      ctx.lineTo(W / 2, -0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'combinaison':
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-0.9, -0.1, 1.6, 0.16);
      ctx.fillStyle = legs;
      ctx.fillRect(-0.2, -0.65, 0.5, 0.35);
      ctx.strokeRect(-0.2, -0.65, 0.5, 0.35);
      break;
    case 'maillot':
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-0.35, -0.45, 0.5, 0.9);
      ctx.fillStyle = THEME.outline;
      ctx.fillRect(-0.15, -0.3, 0.1, 0.6);
      break;
    case 'robe':
      // The dress hangs below the torso.
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(-W / 2, -H / 2 + 0.1);
      ctx.lineTo(-W / 2 - 0.25, -H / 2 - 0.5);
      ctx.lineTo(0.3, -H / 2 - 0.5);
      ctx.lineTo(0.2, -H / 2 + 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'tshirt':
    case 'sweat':
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(-0.3, -0.2, 0.6, 0.12);
      break;
  }
}

function drawShoe(ctx: CanvasRenderingContext2D, shoes: string, colour: string, x: number, y: number): void {
  ctx.fillStyle = colour;
  switch (shoes) {
    case 'bulle': {
      roundRect(ctx, x - 0.22, y - 0.18, 0.5, 0.3, 0.08);
      ctx.fill();
      ctx.stroke();
      const g = ctx.createLinearGradient(x - 0.22, y - 0.32, x + 0.28, y - 0.18);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#bfe3ff');
      ctx.fillStyle = g;
      roundRect(ctx, x - 0.26, y - 0.34, 0.58, 0.18, 0.08);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'ville':
      ctx.fillStyle = '#3b2a1a';
      roundRect(ctx, x - 0.2, y - 0.2, 0.5, 0.22, 0.06);
      ctx.fill();
      ctx.stroke();
      break;
    case 'bottes':
      ctx.fillRect(x - 0.16, y - 0.22, 0.32, 0.5);
      ctx.strokeRect(x - 0.16, y - 0.22, 0.32, 0.5);
      ctx.fillStyle = '#3b2a1a';
      ctx.fillRect(x - 0.2, y - 0.3, 0.46, 0.12);
      break;
    case 'tongs':
      ctx.fillRect(x - 0.2, y - 0.14, 0.46, 0.08);
      ctx.strokeRect(x - 0.2, y - 0.14, 0.46, 0.08);
      break;
    case 'crampons':
      roundRect(ctx, x - 0.2, y - 0.2, 0.46, 0.22, 0.06);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = THEME.outline;
      for (const sx of [-0.12, 0.02, 0.16]) ctx.fillRect(x + sx, y - 0.28, 0.06, 0.08);
      break;
    default:
      roundRect(ctx, x - 0.2, y - 0.18, 0.46, 0.2, 0.06);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 0.2, y - 0.22, 0.46, 0.06);
  }
}

function drawHair(ctx: CanvasRenderingContext2D, hair: string, hx: number, hy: number, layer: 'back' | 'front'): void {
  const colour = '#3b2a1a';
  ctx.fillStyle = colour;
  if (layer === 'back') {
    if (hair === 'longue') {
      ctx.beginPath();
      ctx.moveTo(hx - 0.3, hy + 0.5);
      ctx.quadraticCurveTo(hx - 1.2, hy + 0.2, hx - 1.1, hy - 0.7);
      ctx.lineTo(hx - 0.2, hy - 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (hair === 'attachee') {
      ctx.beginPath();
      ctx.arc(hx - 0.7, hy + 0.1, 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    return;
  }
  if (hair === 'rasee') {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.arc(hx, hy, 0.5, Math.PI * 0.75, Math.PI * 1.9, true);
    ctx.stroke();
    ctx.strokeStyle = THEME.outline;
    ctx.lineWidth = 0.14;
    return;
  }
  // Short, long and tied all share a fringe on top of the head.
  ctx.beginPath();
  ctx.arc(hx, hy + 0.05, 0.6, Math.PI * 0.95, Math.PI * 1.75, true);
  ctx.lineTo(hx + 0.2, hy + 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
