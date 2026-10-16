import { roundRect } from '../theme/assets';

/** Icons drawn in code for the menus: no image assets, one colour, centred at (x, y) in a box of `s` px. */
export type IconId = 'shirt' | 'trophy' | 'person' | 'gear' | 'wheel' | 'flag' | 'ticket' | 'cart' | 'gift' | 'play' | 'coin';

export function drawIcon(ctx: CanvasRenderingContext2D, id: IconId, x: number, y: number, s: number, colour: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 24, s / 24);
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (id) {
    case 'shirt':
      ctx.beginPath();
      ctx.moveTo(-4, -10);
      ctx.lineTo(4, -10);
      ctx.lineTo(11, -6);
      ctx.lineTo(8, 0);
      ctx.lineTo(5, -2);
      ctx.lineTo(5, 10);
      ctx.lineTo(-5, 10);
      ctx.lineTo(-5, -2);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-11, -6);
      ctx.closePath();
      ctx.fill();
      break;
    case 'trophy':
      ctx.beginPath();
      ctx.moveTo(-7, -10);
      ctx.lineTo(7, -10);
      ctx.lineTo(6, 0);
      ctx.quadraticCurveTo(0, 6, -6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-2, 2, 4, 5);
      ctx.fillRect(-6, 7, 12, 3);
      ctx.beginPath();
      ctx.arc(-9, -6, 3, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(9, -6, 3, Math.PI * 1.5, Math.PI * 0.5);
      ctx.stroke();
      break;
    case 'person':
      ctx.beginPath();
      ctx.arc(0, -5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-10, 11);
      ctx.quadraticCurveTo(-10, 1, 0, 1);
      ctx.quadraticCurveTo(10, 1, 10, 11);
      ctx.closePath();
      ctx.fill();
      break;
    case 'gear':
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 4);
        ctx.fillRect(-2.2, -11, 4.4, 6);
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      break;
    case 'wheel':
      ctx.beginPath();
      ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 9.5, Math.sin(a) * 9.5);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-3, -13);
      ctx.lineTo(3, -13);
      ctx.lineTo(0, -8);
      ctx.closePath();
      ctx.fill();
      break;
    case 'flag':
      ctx.fillRect(-9, -11, 2.4, 22);
      ctx.beginPath();
      ctx.moveTo(-6.6, -10);
      ctx.lineTo(10, -10);
      ctx.lineTo(6, -4);
      ctx.lineTo(10, 2);
      ctx.lineTo(-6.6, 2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'ticket':
      ctx.beginPath();
      ctx.moveTo(-11, -7);
      ctx.lineTo(11, -7);
      ctx.lineTo(11, -2);
      ctx.arc(11, 0, 2.5, Math.PI * 1.5, Math.PI * 0.5, true);
      ctx.lineTo(11, 7);
      ctx.lineTo(-11, 7);
      ctx.lineTo(-11, 2);
      ctx.arc(-11, 0, 2.5, Math.PI * 0.5, Math.PI * 1.5, true);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(-1, -5, 2, 10);
      ctx.globalCompositeOperation = 'source-over';
      break;
    case 'cart':
      ctx.beginPath();
      ctx.moveTo(-11, -9);
      ctx.lineTo(-7, -9);
      ctx.lineTo(-4, 4);
      ctx.lineTo(8, 4);
      ctx.lineTo(11, -5);
      ctx.lineTo(-6, -5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-2, 9, 2.2, 0, Math.PI * 2);
      ctx.arc(7, 9, 2.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'gift':
      roundRect(ctx, -10, -3, 20, 13, 2);
      ctx.fill();
      ctx.fillRect(-11, -8, 22, 5);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(-1.2, -8, 2.4, 18);
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.arc(-4, -10, 3, 0, Math.PI * 2);
      ctx.arc(4, -10, 3, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'play':
      ctx.beginPath();
      ctx.moveTo(-7, -10);
      ctx.lineTo(10, 0);
      ctx.lineTo(-7, 10);
      ctx.closePath();
      ctx.fill();
      break;
    case 'coin':
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}
