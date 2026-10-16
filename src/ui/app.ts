import { BALANCE, launchSpeed } from '../config/balance';
import type { PointerListener } from '../core/input';
import { newSeed } from '../core/rng';
import { aimFromDrag } from '../game/kick';
import { speedOf } from '../game/physics';
import { Run } from '../game/run';
import { type KeyValueStore, loadSave, type SaveData, writeSave } from '../game/save';
import { GhostTrajectory } from '../game/trajectory';
import { ASSETS, POSE, roundRect } from '../theme/assets';
import { font, THEME } from '../theme/theme';
import { formatAltitude, formatDistance, formatSpeedKmh } from './format';
import { t } from './i18n';

interface Button {
  x: number;
  y: number;
  w: number;
  h: number;
}

function inside(b: Button, x: number, y: number): boolean {
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

/** Game screen: aim, kick, flight, end screen. Owns the canvas and the current run. */
export class App implements PointerListener {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private sky: CanvasGradient | null = null;

  private readonly save: SaveData;
  private readonly run: Run;
  private readonly ghost = new GhostTrajectory();
  private kickLevel = 0;

  // camera (world metres) and zoom
  private camX = 0;
  private camY = 0;
  private zoom = 1;
  private shake = 0;

  // pointer
  private dragStartX = 0;
  private dragStartY = 0;
  private dragX = 0;
  private dragY = 0;

  private paused = false;
  private newRecord = false;
  private readonly replayButton: Button = { x: 0, y: 0, w: 0, h: 0 };
  private readonly pauseButton: Button = { x: 0, y: 0, w: 0, h: 0 };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly store: KeyValueStore | null,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
    this.save = loadSave(store);
    this.run = new Run(newSeed(), this.kickLevel, (impact) => {
      this.shake = Math.min(1, this.shake + impact / 60);
    });
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, BALANCE.render.maxDevicePixelRatio);
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    const g = this.ctx.createLinearGradient(0, 0, 0, this.height);
    g.addColorStop(0, THEME.skyTop);
    g.addColorStop(1, THEME.skyBottom);
    this.sky = g;
    const bw = Math.min(this.width * 0.7, 320);
    this.replayButton.w = bw;
    this.replayButton.h = 72;
    this.replayButton.x = (this.width - bw) / 2;
    this.replayButton.y = this.height * 0.68;
    this.pauseButton.x = 12;
    this.pauseButton.y = 12;
    this.pauseButton.w = 44;
    this.pauseButton.h = 44;
  }

  // ---- input -------------------------------------------------------------

  down(x: number, y: number): void {
    const run = this.run;
    if (run.phase === 'ended') {
      if (inside(this.replayButton, x, y)) this.restart();
      return;
    }
    if (run.phase === 'flight' && (this.paused || inside(this.pauseButton, x, y))) {
      this.paused = !this.paused;
      return;
    }
    if (run.phase === 'aim') {
      // The whole screen grabs the boot, so the game plays with one thumb anywhere.
      run.aiming = true;
      this.dragStartX = x;
      this.dragStartY = y;
      this.dragX = x;
      this.dragY = y;
      this.updateAim();
    }
  }

  move(x: number, y: number): void {
    if (!this.run.aiming) return;
    this.dragX = x;
    this.dragY = y;
    this.updateAim();
  }

  up(): void {
    if (!this.run.aiming) return;
    this.run.release();
  }

  private updateAim(): void {
    const full = Math.min(this.width, this.height) * BALANCE.kick.fullPowerDragFraction;
    aimFromDrag(this.dragX - this.dragStartX, this.dragY - this.dragStartY, full, this.run.aim);
    this.ghost.compute(launchSpeed(this.run.aim.power, this.kickLevel), this.run.aim.angle);
  }

  private restart(): void {
    this.newRecord = false;
    this.paused = false;
    this.run.reset(newSeed());
    this.camX = 0;
    this.camY = 0;
    this.zoom = 1;
  }

  // ---- simulation ----------------------------------------------------------

  update(dt: number): void {
    if (this.paused) return;
    const run = this.run;
    const wasEnded = run.phase === 'ended';
    run.step(dt);
    if (!wasEnded && run.phase === 'ended') this.finishRun();

    // camera follows with exponential damping, zooms out with speed
    const b = run.body;
    const k = 1 - Math.exp(-BALANCE.render.cameraDamping * dt);
    this.camX += (b.x - this.camX) * k;
    // Keep the ground in view as long as the character fits in the upper part of the screen.
    const scale = BALANCE.render.pixelsPerMetre * this.zoom;
    const headroom = (this.height * BALANCE.render.playerScreenY * BALANCE.render.cameraHeadroom) / scale;
    const targetY = Math.max(0, b.y - headroom);
    this.camY += (targetY - this.camY) * k;
    const targetZoom = Math.max(
      BALANCE.render.minZoom,
      1 / (1 + speedOf(b) / BALANCE.render.zoomSpeedReference),
    );
    this.zoom += (targetZoom - this.zoom) * k * 0.5;
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }

  private finishRun(): void {
    const run = this.run;
    this.save.runs++;
    if (run.distance > this.save.bestDistance) {
      this.newRecord = this.save.bestDistance > 0;
      this.save.bestDistance = run.distance;
    }
    if (run.maxAltitude > this.save.bestAltitude) this.save.bestAltitude = run.maxAltitude;
    writeSave(this.store, this.save);
  }

  // ---- rendering ----------------------------------------------------------

  render(alpha: number): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    ctx.fillStyle = this.sky ?? THEME.skyTop;
    ctx.fillRect(0, 0, W, H);

    const run = this.run;
    const b = run.body;
    const px = run.prevX + (b.x - run.prevX) * alpha;
    const py = run.prevY + (b.y - run.prevY) * alpha;
    const scale = BALANCE.render.pixelsPerMetre * this.zoom;
    const shakeX = this.shake > 0 ? Math.sin(run.time * 90) * this.shake * 6 : 0;
    const shakeY = this.shake > 0 ? Math.cos(run.time * 77) * this.shake * 6 : 0;
    const originX = W * BALANCE.render.playerScreenX - this.camX * scale + shakeX;
    const originY = H * BALANCE.render.playerScreenY + this.camY * scale + shakeY;

    this.drawGround(originX, originY, scale);
    if (run.phase === 'aim' && run.aiming) this.drawGhost(originX, originY, scale);
    this.drawCharacter(px, py, originX, originY, scale);
    this.drawBoot(originX, originY, scale);

    this.drawHud();
    if (run.phase === 'aim' && !run.aiming) this.drawHint();
    if (run.phase === 'ended') this.drawEndScreen();
    else if (this.paused) this.drawPause();
  }

  private drawGround(ox: number, oy: number, scale: number): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    if (oy < H) {
      ctx.fillStyle = THEME.ground;
      ctx.fillRect(0, oy, W, H - oy);
      ctx.fillStyle = THEME.groundDark;
      ctx.fillRect(0, oy, W, Math.max(3, 0.6 * scale));
      // distance ticks give a sense of speed until the parallax arrives
      const spacing = BALANCE.render.groundTickSpacing;
      const first = Math.floor(-ox / scale / spacing) * spacing;
      const last = (W - ox) / scale;
      ctx.fillStyle = THEME.groundLine;
      for (let x = first; x <= last; x += spacing) {
        const sx = ox + x * scale;
        const big = Math.round(x) % (spacing * 10) === 0;
        ctx.fillRect(sx - 1, oy, 2, big ? 16 : 7);
      }
    }
  }

  private drawGhost(ox: number, oy: number, scale: number): void {
    const ctx = this.ctx;
    const g = this.ghost;
    ctx.fillStyle = THEME.ghost;
    for (let i = 0; i < g.count; i++) {
      const r = 4 - (i / g.count) * 2.5;
      ctx.beginPath();
      ctx.arc(ox + (g.xs[i] ?? 0) * scale, oy - (g.ys[i] ?? 0) * scale, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawCharacter(x: number, y: number, ox: number, oy: number, scale: number): void {
    const ctx = this.ctx;
    const run = this.run;
    const P = BALANCE.player;
    ctx.save();
    ctx.translate(ox + x * scale, oy - (y + P.height / 2 + 0.5) * scale);
    ctx.scale(scale, -scale);
    let pose = POSE.fours;
    if (run.phase === 'flight') {
      const b = run.body;
      pose = b.rolling ? POSE.roll : POSE.flight;
      const angle = b.rolling ? -run.time * b.vx * 0.6 : Math.atan2(b.vy, Math.max(1, b.vx)) * 0.8;
      ctx.rotate(angle);
    }
    ASSETS.character.draw(ctx, pose);
    ctx.restore();
  }

  private drawBoot(ox: number, oy: number, scale: number): void {
    const run = this.run;
    if (run.phase !== 'aim' && run.phase !== 'swing') return;
    const ctx = this.ctx;
    const P = BALANCE.player;
    // Rest position, pulled back with the drag, then swung forward into the character.
    let bx = ox + P.bootOffsetX * scale;
    let by = oy - (P.bootOffsetY + 0.5) * scale;
    let pullX = 0;
    let pullY = 0;
    if (run.aiming || run.phase === 'swing') {
      const a = (run.aim.angle * Math.PI) / 180;
      const pull = run.aim.power * 4 * scale;
      pullX = -Math.cos(a) * pull;
      pullY = Math.sin(a) * pull;
    }
    if (run.phase === 'swing') {
      const k = Math.min(1, run.swingTime / BALANCE.kick.swingSeconds);
      pullX = pullX * (1 - k) + 1.2 * scale * k;
      pullY = pullY * (1 - k);
    }
    bx += pullX;
    by += pullY;
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(scale, -scale);
    ctx.rotate((run.aim.angle * Math.PI) / 180 - 0.3);
    ASSETS.boot.draw(ctx, 0);
    ctx.restore();
  }

  private drawHud(): void {
    const ctx = this.ctx;
    const run = this.run;
    const W = this.width;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';

    ctx.font = font('display', 44);
    ctx.lineWidth = 6;
    ctx.strokeStyle = THEME.outline;
    ctx.fillStyle = THEME.uiText;
    const dist = formatDistance(run.distance);
    ctx.strokeText(dist, W / 2, 18);
    ctx.fillText(dist, W / 2, 18);

    ctx.font = font('text', 15);
    ctx.lineWidth = 4;
    const sub = `${formatSpeedKmh(speedOf(run.body))} ${t('speedUnit')} · ${t('altitude')} ${formatAltitude(run.body.y)}`;
    ctx.strokeText(sub, W / 2, 68);
    ctx.fillText(sub, W / 2, 68);
    ctx.font = font('text', 12);
    ctx.fillStyle = THEME.uiTextSoft;
    ctx.strokeText(t('defaultName'), W / 2, 88);
    ctx.fillText(t('defaultName'), W / 2, 88);

    // coins (economy arrives in phase 4)
    ctx.textAlign = 'right';
    ctx.font = font('display', 20);
    ctx.fillStyle = THEME.accent;
    ctx.strokeText('0 ●', W - 14, 20);
    ctx.fillText('0 ●', W - 14, 20);

    if (run.phase === 'flight') {
      const p = this.pauseButton;
      ctx.fillStyle = THEME.shade;
      roundRect(ctx, p.x, p.y, p.w, p.h, 10);
      ctx.fill();
      ctx.fillStyle = THEME.uiText;
      ctx.fillRect(p.x + 14, p.y + 12, 6, 20);
      ctx.fillRect(p.x + 24, p.y + 12, 6, 20);
    }
  }

  private drawHint(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font('text', 16);
    ctx.lineWidth = 4;
    ctx.strokeStyle = THEME.outline;
    ctx.fillStyle = THEME.uiText;
    const y = this.height * 0.4;
    ctx.strokeText(t('aimHint'), this.width / 2, y);
    ctx.fillText(t('aimHint'), this.width / 2, y);
    if (this.save.bestDistance > 0) {
      const best = `${t('best')} : ${formatDistance(this.save.bestDistance)}`;
      ctx.strokeText(best, this.width / 2, y + 28);
      ctx.fillText(best, this.width / 2, y + 28);
    }
  }

  private drawPause(): void {
    const ctx = this.ctx;
    ctx.fillStyle = THEME.shade;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font('display', 36);
    ctx.fillStyle = THEME.uiText;
    ctx.fillText(t('pause'), this.width / 2, this.height * 0.45);
    ctx.font = font('text', 16);
    ctx.fillText(t('resume'), this.width / 2, this.height * 0.45 + 40);
  }

  private drawEndScreen(): void {
    const ctx = this.ctx;
    const run = this.run;
    const W = this.width;
    const H = this.height;
    ctx.fillStyle = THEME.shade;
    ctx.fillRect(0, 0, W, H);

    const panelW = Math.min(W - 32, 380);
    const panelX = (W - panelW) / 2;
    const panelY = H * 0.2;
    ctx.fillStyle = THEME.ui;
    roundRect(ctx, panelX, panelY, panelW, H * 0.44, 20);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = THEME.uiTextSoft;
    ctx.font = font('text', 16);
    ctx.fillText(t('endTitle'), W / 2, panelY + 20);
    ctx.fillStyle = THEME.accent;
    ctx.font = font('display', 52);
    ctx.fillText(formatDistance(run.distance), W / 2, panelY + 46);
    if (this.newRecord) {
      ctx.fillStyle = THEME.uiText;
      ctx.font = font('display', 18);
      ctx.fillText(t('endRecord'), W / 2, panelY + 108);
    }

    ctx.font = font('text', 16);
    ctx.fillStyle = THEME.uiText;
    const rows: [string, string][] = [
      [t('endAltitude'), formatAltitude(run.maxAltitude)],
      [t('endSpeed'), `${formatSpeedKmh(run.maxSpeed)} ${t('speedUnit')}`],
      [t('best'), formatDistance(this.save.bestDistance)],
    ];
    let y = panelY + 144;
    for (const [label, value] of rows) {
      ctx.textAlign = 'left';
      ctx.fillStyle = THEME.uiTextSoft;
      ctx.fillText(label, panelX + 24, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = THEME.uiText;
      ctx.fillText(value, panelX + panelW - 24, y);
      y += 30;
    }

    const btn = this.replayButton;
    ctx.fillStyle = THEME.accent;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 18);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = THEME.outline;
    ctx.stroke();
    ctx.fillStyle = THEME.ui;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font('display', 30);
    ctx.fillText(t('replay'), W / 2, btn.y + btn.h / 2);

    ctx.fillStyle = THEME.uiTextSoft;
    ctx.font = font('text', 11);
    ctx.fillText(`${t('seed')} ${run.seed}`, W / 2, btn.y + btn.h + 22);
  }
}
