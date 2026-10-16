import { BALANCE, launchSpeed } from '../config/balance';
import type { PointerListener } from '../core/input';
import { newSeed } from '../core/rng';
import { aimFromDrag } from '../game/kick';
import { speedOf } from '../game/physics';
import { Run } from '../game/run';
import { type KeyValueStore, loadSave, type SaveData, writeSave } from '../game/save';
import { GhostTrajectory } from '../game/trajectory';
import { LAYERS, STAGES, stageAt } from '../game/world';
import { ASSETS, POSE, roundRect } from '../theme/assets';
import { LAYER_PALETTES, STAGE_PALETTES } from '../theme/palettes';
import { drawBorderSign, drawLayerSign, drawScenery, drawStars } from '../theme/scenery';
import { font, THEME } from '../theme/theme';
import { formatAltitude, formatDistance, formatSpeedKmh } from './format';
import { layerName, stageName, t } from './i18n';

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
  private newAltitudeRecord = false;
  private readonly replayButton: Button = { x: 0, y: 0, w: 0, h: 0 };
  private readonly pauseButton: Button = { x: 0, y: 0, w: 0, h: 0 };
  private readonly speedButton: Button = { x: 0, y: 0, w: 0, h: 0 };

  // signs and flashes (seconds remaining)
  private stageSignTime = 0;
  private stageSignIndex = 0;
  private layerSignTime = 0;
  private layerSignIndex = 0;
  private layerSignRising = true;
  private flash = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly store: KeyValueStore | null,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
    this.save = loadSave(store);
    this.run = new Run(newSeed(), this.kickLevel, {
      onBounce: (impact) => {
        this.shake = Math.min(1, this.shake + impact / 60);
      },
      onStage: (i) => {
        this.stageSignIndex = i;
        this.stageSignTime = BALANCE.signs.sweepSeconds;
      },
      onLayer: (i, rising) => {
        this.layerSignIndex = i;
        this.layerSignRising = rising;
        this.layerSignTime = BALANCE.signs.sweepSeconds;
      },
      onSoundBarrier: () => {
        this.flash = 1;
        this.shake = 1;
      },
    });
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, BALANCE.render.maxDevicePixelRatio);
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    const bw = Math.min(this.width * 0.7, 320);
    this.replayButton.w = bw;
    this.replayButton.h = 72;
    this.replayButton.x = (this.width - bw) / 2;
    this.replayButton.y = this.height * 0.68;
    this.pauseButton.x = 12;
    this.pauseButton.y = 12;
    this.pauseButton.w = 44;
    this.pauseButton.h = 44;
    this.speedButton.w = 64;
    this.speedButton.h = 44;
    this.speedButton.x = this.width - 12 - this.speedButton.w;
    this.speedButton.y = this.height - 24 - this.speedButton.h;
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
    if (run.phase === 'flight' && inside(this.speedButton, x, y)) {
      run.cycleTimeScale();
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
    this.newAltitudeRecord = false;
    this.paused = false;
    this.stageSignTime = 0;
    this.layerSignTime = 0;
    this.flash = 0;
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
    // Time accelerator: more physics steps per frame, the step itself never changes.
    const stepsThisFrame = run.phase === 'flight' ? run.timeScale : 1;
    for (let i = 0; i < stepsThisFrame && run.phase !== 'ended'; i++) run.step(dt);
    if (!wasEnded && run.phase === 'ended') this.finishRun();
    if (this.stageSignTime > 0) this.stageSignTime = Math.max(0, this.stageSignTime - dt);
    if (this.layerSignTime > 0) this.layerSignTime = Math.max(0, this.layerSignTime - dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2);

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
    if (run.maxAltitude > this.save.bestAltitude) {
      this.newAltitudeRecord = this.save.bestAltitude > 0;
      this.save.bestAltitude = run.maxAltitude;
    }
    writeSave(this.store, this.save);
  }

  // ---- rendering ----------------------------------------------------------

  render(alpha: number): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const run = this.run;
    this.drawSky();
    const b = run.body;
    const px = run.prevX + (b.x - run.prevX) * alpha;
    const py = run.prevY + (b.y - run.prevY) * alpha;
    const scale = BALANCE.render.pixelsPerMetre * this.zoom;
    const shakeX = this.shake > 0 ? Math.sin(run.time * 90) * this.shake * 6 : 0;
    const shakeY = this.shake > 0 ? Math.cos(run.time * 77) * this.shake * 6 : 0;
    const originX = W * BALANCE.render.playerScreenX - this.camX * scale + shakeX;
    const originY = H * BALANCE.render.playerScreenY + this.camY * scale + shakeY;

    drawScenery(ctx, W, this.camX, this.camY, this.zoom, originY);
    this.drawGround(originX, originY, scale);
    if (run.phase === 'aim' && run.aiming) this.drawGhost(originX, originY, scale);
    this.drawCharacter(px, py, originX, originY, scale);
    this.drawBoot(originX, originY, scale);

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash.toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }
    this.drawSigns();
    this.drawHud();
    if (run.phase === 'aim' && !run.aiming) this.drawHint();
    if (run.phase === 'ended') this.drawEndScreen();
    else if (this.paused) this.drawPause();
  }

  /** Sky of the stage under x below the tropopause, sky of the layer above, blended near the boundary. */
  private drawSky(): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    const stage = STAGE_PALETTES[stageAt(this.camX).id];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, stage.skyTop);
    g.addColorStop(1, stage.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const y = this.camY;
    const tropo = BALANCE.altitude.tropopause;
    // Fade the layer sky in over the last fifth of the troposphere.
    const blend = Math.min(1, Math.max(0, (y - tropo * 0.8) / (tropo * 0.2)));
    if (blend > 0) {
      const layer = LAYER_PALETTES[(LAYERS[this.run.layerIndex] ?? LAYERS[0]!).id];
      const lg = ctx.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, layer.skyTop);
      lg.addColorStop(1, layer.skyBottom);
      ctx.globalAlpha = blend;
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      drawStars(ctx, W, H, layer.stars * blend, this.camX);
      // Planet curvature far below: a wide arc whose top sinks with the altitude.
      const curveTop = H * (0.75 + Math.min(0.5, Math.log10(1 + y / tropo) * 0.12));
      ctx.fillStyle = layer.horizon;
      ctx.beginPath();
      ctx.ellipse(W / 2, curveTop + W * 1.5, W * 1.6, W * 1.5, 0, Math.PI, 0);
      ctx.fill();
    }
  }

  private drawSigns(): void {
    const ctx = this.ctx;
    const W = this.width;
    const total = BALANCE.signs.sweepSeconds;
    if (this.stageSignTime > 0) {
      const stage = STAGES[this.stageSignIndex];
      if (stage) {
        drawBorderSign(ctx, W, this.height * 0.16, 1 - this.stageSignTime / total, stageName(stage.id), font('display', 24));
      }
    }
    if (this.layerSignTime > 0) {
      const layer = LAYERS[this.layerSignIndex];
      if (layer) {
        drawLayerSign(ctx, W, this.height * 0.16 + 84, 1 - this.layerSignTime / total, layerName(layer.id), this.layerSignRising, font('display', 20));
      }
    }
  }

  private drawGround(ox: number, oy: number, scale: number): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    if (oy < H) {
      const palette = STAGE_PALETTES[stageAt(this.camX).id];
      ctx.fillStyle = palette.ground;
      ctx.fillRect(0, oy, W, H - oy);
      ctx.fillStyle = palette.groundDark;
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
    // Readable at any zoom: the sprite scale never drops below the minimum on-screen height.
    const spriteScale = Math.max(scale, BALANCE.render.minCharacterPx / P.height);
    ctx.save();
    ctx.translate(ox + x * scale, oy - y * scale - (P.height / 2 + 0.5) * spriteScale);
    ctx.scale(spriteScale, -spriteScale);
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

    // "Above:" label once the layer sky has replaced the country sky.
    if (run.body.y >= BALANCE.altitude.tropopause) {
      const stage = STAGES[run.stageIndex];
      if (stage) {
        ctx.textAlign = 'center';
        ctx.font = font('text', 13);
        ctx.fillStyle = THEME.uiTextSoft;
        ctx.lineWidth = 3;
        const label = `${t('above')} : ${stageName(stage.id)}`;
        ctx.strokeText(label, W / 2, 106);
        ctx.fillText(label, W / 2, 106);
      }
    }

    if (run.phase === 'flight') {
      const p = this.pauseButton;
      ctx.fillStyle = THEME.shade;
      roundRect(ctx, p.x, p.y, p.w, p.h, 10);
      ctx.fill();
      ctx.fillStyle = THEME.uiText;
      ctx.fillRect(p.x + 14, p.y + 12, 6, 20);
      ctx.fillRect(p.x + 24, p.y + 12, 6, 20);

      // Time accelerator button.
      const sb = this.speedButton;
      ctx.fillStyle = run.timeScaleIndex > 0 ? THEME.accent : THEME.shade;
      roundRect(ctx, sb.x, sb.y, sb.w, sb.h, 12);
      ctx.fill();
      ctx.fillStyle = run.timeScaleIndex > 0 ? THEME.ui : THEME.uiText;
      ctx.font = font('display', 20);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`×${run.timeScale}`, sb.x + sb.w / 2, sb.y + sb.h / 2);

      this.drawWindsock();
    }
  }

  /** Windsock bottom-left: direction and strength of the stage wind, hidden above the drag pivot. */
  private drawWindsock(): void {
    const ctx = this.ctx;
    const run = this.run;
    if (run.body.y > BALANCE.altitude.dragZeroAltitude) return;
    const wind = (STAGES[run.stageIndex] ?? STAGES[0]!).wind;
    const x = 22;
    const y = this.height - 30;
    ctx.fillStyle = THEME.ui;
    ctx.fillRect(x - 2, y - 40, 4, 40);
    const len = Math.min(44, 10 + Math.abs(wind) * 3);
    const dir = wind >= 0 ? 1 : -1;
    ctx.fillStyle = wind === 0 ? THEME.uiTextSoft : wind > 0 ? '#7ddc7a' : THEME.danger;
    ctx.beginPath();
    ctx.moveTo(x, y - 40);
    ctx.lineTo(x + dir * len, y - 34);
    ctx.lineTo(x + dir * len, y - 22);
    ctx.lineTo(x, y - 18);
    ctx.closePath();
    ctx.fill();
    ctx.font = font('text', 11);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = THEME.uiText;
    ctx.lineWidth = 3;
    ctx.strokeStyle = THEME.outline;
    const label = `${wind > 0 ? '+' : ''}${Math.round(wind * 3.6)} km/h`;
    ctx.strokeText(label, x - 8, y + 8);
    ctx.fillText(label, x - 8, y + 8);
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
    roundRect(ctx, panelX, panelY, panelW, H * 0.46, 20);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = THEME.uiTextSoft;
    ctx.font = font('text', 16);
    ctx.fillText(t('endTitle'), W / 2, panelY + 20);
    ctx.fillStyle = THEME.accent;
    ctx.font = font('display', 52);
    ctx.fillText(formatDistance(run.distance), W / 2, panelY + 46);
    if (this.newRecord || this.newAltitudeRecord) {
      ctx.fillStyle = THEME.uiText;
      ctx.font = font('display', 18);
      ctx.fillText(this.newRecord ? t('endRecord') : t('endAltitudeRecord'), W / 2, panelY + 108);
    }

    ctx.font = font('text', 16);
    ctx.fillStyle = THEME.uiText;
    const farthest = STAGES[run.maxStageIndex] ?? STAGES[0]!;
    const highest = LAYERS[run.maxLayerIndex] ?? LAYERS[0]!;
    const rows: [string, string][] = [
      [t('endStage'), stageName(farthest.id)],
      [t('endAltitude'), formatAltitude(run.maxAltitude)],
      [t('endLayer'), layerName(highest.id)],
      [t('endSpeed'), `${formatSpeedKmh(run.maxSpeed)} ${t('speedUnit')}`],
      [t('best'), `${formatDistance(this.save.bestDistance)} · ${formatAltitude(this.save.bestAltitude)}`],
    ];
    let y = panelY + 140;
    for (const [label, value] of rows) {
      ctx.textAlign = 'left';
      ctx.fillStyle = THEME.uiTextSoft;
      ctx.fillText(label, panelX + 24, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = THEME.uiText;
      ctx.fillText(value, panelX + panelW - 24, y);
      y += 28;
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
