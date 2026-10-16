import { BALANCE, launchSpeed } from '../config/balance';
import type { PointerListener } from '../core/input';
import { newSeed } from '../core/rng';
import { aimFromDrag } from '../game/kick';
import { speedOf } from '../game/physics';
import { giftAmount, giftCooldown, levelFromXp, UPGRADE_IDS, upgradeMaxed, upgradePrice, xpForRun } from '../game/progress';
import { defaultEquipment, Run } from '../game/run';
import { type KeyValueStore, loadSave, type SaveData, writeSave } from '../game/save';
import { GhostTrajectory } from '../game/trajectory';
import { LAYERS, STAGES, stageAt } from '../game/world';
import { ASSETS, POSE, roundRect } from '../theme/assets';
import { LAYER_PALETTES, STAGE_PALETTES } from '../theme/palettes';
import { drawEntity } from '../theme/entitySprites';
import { drawBorderSign, drawLayerSign, drawScenery, drawStars } from '../theme/scenery';
import { font, THEME } from '../theme/theme';
import { formatAltitude, formatDistance, formatSpeedKmh } from './format';
import { fatalText, helmetName, layerName, stageName, t, upgradeEffect, upgradeName } from './i18n';

interface Button {
  x: number;
  y: number;
  w: number;
  h: number;
}

function btn(): Button {
  return { x: 0, y: 0, w: 0, h: 0 };
}

function inside(b: Button, x: number, y: number): boolean {
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

function formatCooldown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

type Screen = 'home' | 'game' | 'shop';
type ShopTab = 'upgrades' | 'helmets';

/** Game screen: home, aim, kick, flight, end screen and shop. Owns the canvas and the current run. */
export class App implements PointerListener {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;

  private readonly save: SaveData;
  private readonly run: Run;
  private readonly ghost = new GhostTrajectory();
  private readonly equipment = defaultEquipment();

  private screen: Screen = 'home';
  private shopTab: ShopTab = 'upgrades';
  /** Where the shop's back button returns to. */
  private shopReturn: Screen = 'home';
  private now = 0;

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
  private levelsGained = 0;
  private runXp = 0;

  // buttons
  private readonly replayButton = btn();
  private readonly endShopButton = btn();
  private readonly endHomeButton = btn();
  private readonly pauseButton = btn();
  private readonly speedButton = btn();
  private readonly playButton = btn();
  private readonly homeShopButton = btn();
  private readonly giftButton = btn();
  private readonly soonButtons: Button[] = [btn(), btn(), btn(), btn()];
  private readonly tabButtons: Button[] = [btn(), btn()];
  private readonly rowButtons: Button[] = UPGRADE_IDS.map(() => btn());
  private readonly backButton = btn();
  private giftFlash = 0;

  // signs and flashes (seconds remaining)
  private stageSignTime = 0;
  private stageSignIndex = 0;
  private layerSignTime = 0;
  private layerSignIndex = 0;
  private layerSignRising = true;
  private flash = 0;
  private lawyerTime = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly store: KeyValueStore | null,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
    this.save = loadSave(store);
    this.save.level = levelFromXp(this.save.xp).level;
    this.applyEquipment();
    this.run = new Run(newSeed(), this.equipment, 'depart', {
      onObstacle: (e) => {
        this.shake = Math.min(1, this.shake + 0.5);
        if (e.kind === 'radar') this.flash = 0.6;
      },
      onWall: (_e, broken) => {
        this.shake = 1;
        if (!broken) this.flash = 0.4;
      },
      onLawyer: () => {
        this.lawyerTime = 2.5;
      },
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
      onRocket: () => {
        this.flash = 0.35;
        this.shake = 0.5;
      },
    });
    this.resize();
  }

  /** The run reads its equipment from this object; it mirrors the save's upgrades. */
  private applyEquipment(): void {
    const u = this.save.upgrades;
    const eq = this.equipment;
    eq.kickLevel = u.force;
    eq.solesLevel = u.semelles;
    eq.suitLevel = u.combinaison;
    eq.magnetLevel = u.aimant;
    eq.rocketCharges = u.fusee;
    eq.rampLevel = u.tremplin;
    eq.lawyerCharges = u.avocat;
    eq.helmetCharges = this.save.helmet?.charges ?? 0;
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, BALANCE.render.maxDevicePixelRatio);
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    const W = this.width;
    const H = this.height;
    const bw = Math.min(W * 0.7, 320);
    const bx = (W - bw) / 2;

    // end screen
    Object.assign(this.replayButton, { x: bx, y: H * 0.7, w: bw, h: 64 });
    Object.assign(this.endShopButton, { x: bx, y: H * 0.7 + 76, w: bw / 2 - 6, h: 44 });
    Object.assign(this.endHomeButton, { x: bx + bw / 2 + 6, y: H * 0.7 + 76, w: bw / 2 - 6, h: 44 });

    // flight
    Object.assign(this.pauseButton, { x: 12, y: 12, w: 44, h: 44 });
    Object.assign(this.speedButton, { x: W - 12 - 64, y: H - 24 - 44, w: 64, h: 44 });

    // home
    Object.assign(this.playButton, { x: bx, y: H * 0.5, w: bw, h: 72 });
    Object.assign(this.homeShopButton, { x: bx, y: H * 0.5 + 86, w: bw / 2 - 6, h: 48 });
    Object.assign(this.giftButton, { x: bx + bw / 2 + 6, y: H * 0.5 + 86, w: bw / 2 - 6, h: 48 });
    const sw = (bw - 18) / 4;
    this.soonButtons.forEach((b, i) => Object.assign(b, { x: bx + i * (sw + 6), y: H * 0.5 + 148, w: sw, h: 56 }));

    // shop
    const panelW = Math.min(W - 24, 420);
    const panelX = (W - panelW) / 2;
    const tabY = 66;
    this.tabButtons.forEach((b, i) => Object.assign(b, { x: panelX + 12 + i * (panelW / 2 - 12), y: tabY, w: panelW / 2 - 18, h: 40 }));
    Object.assign(this.backButton, { x: bx, y: H - 72, w: bw, h: 48 });
    const top = tabY + 56;
    const rowH = Math.max(44, Math.min(58, (this.backButton.y - 16 - top) / this.rowButtons.length - 6));
    this.rowButtons.forEach((b, i) => Object.assign(b, { x: panelX + 12, y: top + i * (rowH + 6), w: panelW - 24, h: rowH }));
  }

  // ---- input -------------------------------------------------------------

  down(x: number, y: number): void {
    if (this.screen === 'home') {
      if (inside(this.playButton, x, y)) this.screen = 'game';
      else if (inside(this.homeShopButton, x, y)) this.openShop('home');
      else if (inside(this.giftButton, x, y)) this.claimGift();
      return;
    }
    if (this.screen === 'shop') {
      this.tabButtons.forEach((b, i) => {
        if (inside(b, x, y)) this.shopTab = i === 0 ? 'upgrades' : 'helmets';
      });
      this.rowButtons.forEach((b, i) => {
        if (!inside(b, x, y)) return;
        if (this.shopTab === 'upgrades') this.buyUpgrade(i);
        else this.buyHelmet(i);
      });
      if (inside(this.backButton, x, y)) this.screen = this.shopReturn;
      return;
    }
    const run = this.run;
    if (run.phase === 'ended') {
      if (inside(this.replayButton, x, y)) this.restart();
      else if (inside(this.endShopButton, x, y)) this.openShop('game');
      else if (inside(this.endHomeButton, x, y)) {
        this.restart();
        this.screen = 'home';
      }
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
    if (run.phase === 'flight') {
      // Any other tap in flight is an action tap: shake off a clinger, or fire the rocket.
      if (run.tap() && run.clingKind) this.shake = 0.6;
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
    if (this.screen !== 'game' || !this.run.aiming) return;
    this.dragX = x;
    this.dragY = y;
    this.updateAim();
  }

  up(): void {
    if (this.screen !== 'game' || !this.run.aiming) return;
    this.run.release();
  }

  private updateAim(): void {
    const full = Math.min(this.width, this.height) * BALANCE.kick.fullPowerDragFraction;
    aimFromDrag(this.dragX - this.dragStartX, this.dragY - this.dragStartY, full, this.run.aim);
    this.ghost.compute(launchSpeed(this.run.aim.power, this.equipment.kickLevel), this.run.aim.angle);
  }

  private openShop(from: Screen): void {
    this.shopReturn = from;
    this.screen = 'shop';
  }

  private buyUpgrade(index: number): void {
    const id = UPGRADE_IDS[index];
    if (!id) return;
    const level = this.save.upgrades[id];
    const def = BALANCE.upgrades[id];
    if (upgradeMaxed(id, level) || this.save.level < def.unlock) return;
    const price = upgradePrice(id, level);
    if (this.save.coins < price) return;
    this.save.coins -= price;
    this.save.upgrades[id] = level + 1;
    this.applyEquipment();
    this.syncAimedRun();
    writeSave(this.store, this.save);
  }

  private buyHelmet(index: number): void {
    const helmet = BALANCE.helmets[index];
    if (!helmet || this.save.level < helmet.level || this.save.coins < helmet.price) return;
    if (this.save.helmet && this.save.helmet.id === helmet.id) return;
    this.save.coins -= helmet.price;
    this.save.helmet = { id: helmet.id, charges: helmet.walls };
    this.applyEquipment();
    this.syncAimedRun();
    writeSave(this.store, this.save);
  }

  /** A run waiting for its kick picks up new equipment at once (ramp, charges). */
  private syncAimedRun(): void {
    if (this.run.phase === 'aim' && !this.run.aiming) this.run.reset(this.run.seed);
  }

  private claimGift(): void {
    if (giftCooldown(this.save.lastGift, this.now) > 0) return;
    const amount = giftAmount(this.save.level);
    this.save.coins += amount;
    this.save.totalCoins += amount;
    this.save.lastGift = this.now;
    this.giftFlash = 2;
    writeSave(this.store, this.save);
  }

  private restart(): void {
    this.newRecord = false;
    this.newAltitudeRecord = false;
    this.levelsGained = 0;
    this.runXp = 0;
    this.paused = false;
    this.lawyerTime = 0;
    this.stageSignTime = 0;
    this.layerSignTime = 0;
    this.flash = 0;
    this.applyEquipment();
    this.run.reset(newSeed());
    this.camX = this.run.body.x;
    this.camY = 0;
    this.zoom = 1;
  }

  // ---- simulation ----------------------------------------------------------

  update(dt: number): void {
    this.now = Date.now();
    if (this.giftFlash > 0) this.giftFlash = Math.max(0, this.giftFlash - dt);
    if (this.paused || this.screen !== 'game') {
      // Home and shop keep the scenery alive behind them, without advancing the run.
      this.run.time += dt;
      return;
    }
    const run = this.run;
    const wasEnded = run.phase === 'ended';
    // Time accelerator: more physics steps per frame, the step itself never changes.
    const stepsThisFrame = run.phase === 'flight' ? run.timeScale : 1;
    for (let i = 0; i < stepsThisFrame && run.phase !== 'ended'; i++) run.step(dt);
    if (!wasEnded && run.phase === 'ended') this.finishRun();
    if (this.stageSignTime > 0) this.stageSignTime = Math.max(0, this.stageSignTime - dt);
    if (this.layerSignTime > 0) this.layerSignTime = Math.max(0, this.layerSignTime - dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2);
    if (this.lawyerTime > 0) this.lawyerTime = Math.max(0, this.lawyerTime - dt);

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
    const save = this.save;
    save.runs++;
    if (run.distance > save.bestDistance) {
      this.newRecord = save.bestDistance > 0;
      save.bestDistance = run.distance;
    }
    if (run.maxAltitude > save.bestAltitude) {
      this.newAltitudeRecord = save.bestAltitude > 0;
      save.bestAltitude = run.maxAltitude;
    }
    const earned = run.coins + run.distanceCoins;
    save.coins += earned;
    save.totalCoins += earned;
    this.runXp = xpForRun(run.distance, earned);
    const before = save.level;
    save.xp += this.runXp;
    save.level = levelFromXp(save.xp).level;
    this.levelsGained = save.level - before;
    // The helmet keeps the charges it has left; consumed when none remain.
    if (save.helmet) {
      save.helmet = run.helmetCharges > 0 ? { id: save.helmet.id, charges: run.helmetCharges } : null;
    }
    this.applyEquipment();
    writeSave(this.store, save);
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
    if (this.screen === 'game' && run.phase === 'aim' && run.aiming) this.drawGhost(originX, originY, scale);
    this.drawEntities(originX, originY, scale);
    this.drawCharacter(px, py, originX, originY, scale);
    this.drawBoot(originX, originY, scale);

    if (this.screen === 'home') {
      this.drawHome();
      return;
    }
    if (this.screen === 'shop') {
      this.drawShop();
      return;
    }
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

  private drawEntities(ox: number, oy: number, scale: number): void {
    const ctx = this.ctx;
    const run = this.run;
    const W = this.width;
    const H = this.height;
    const margin = 60;
    // Small things stay readable when zoomed out, walls keep their true size.
    const minScale = BALANCE.render.minCharacterPx / 2.4;
    for (const e of run.pool.items) {
      if (!e.active) continue;
      const sx = ox + e.x * scale;
      const sy = oy - e.y * scale;
      const s = e.type === 'wall' ? scale : Math.max(scale, minScale);
      if (sx + (e.w * s) / 2 < -margin || sx - (e.w * s) / 2 > W + margin) continue;
      if (sy < -margin - e.h * s || sy > H + margin) continue;
      if (e.used && e.usedTime > 0.7) continue;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(s, -s);
      drawEntity(ctx, e, run.time, (STAGES[e.stageIndex] ?? STAGES[0]!).id);
      ctx.restore();
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
    const startX = this.run.body.x;
    ctx.fillStyle = THEME.ghost;
    for (let i = 0; i < g.count; i++) {
      const r = 4 - (i / g.count) * 2.5;
      ctx.beginPath();
      ctx.arc(ox + (startX + (g.xs[i] ?? 0)) * scale, oy - (g.ys[i] ?? 0) * scale, r, 0, Math.PI * 2);
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
    let bx = ox + (run.body.x + P.bootOffsetX) * scale;
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
    const name = `${t('defaultName')} · ${t('level')} ${this.save.level}`;
    ctx.strokeText(name, W / 2, 88);
    ctx.fillText(name, W / 2, 88);

    // coins
    ctx.textAlign = 'right';
    ctx.font = font('display', 20);
    ctx.fillStyle = THEME.accent;
    const coins = `${this.save.coins + (run.phase === 'ended' ? 0 : run.coins)} ●`;
    ctx.strokeText(coins, W - 14, 20);
    ctx.fillText(coins, W - 14, 20);
    if (run.phase === 'flight' && run.coins > 0) {
      ctx.font = font('text', 13);
      ctx.fillStyle = THEME.uiText;
      ctx.lineWidth = 3;
      ctx.strokeText(`+${run.coins}`, W - 14, 46);
      ctx.fillText(`+${run.coins}`, W - 14, 46);
    }
    if (run.phase === 'flight') {
      // Charges left: helmet walls and rockets.
      ctx.textAlign = 'left';
      ctx.font = font('text', 13);
      ctx.fillStyle = THEME.uiText;
      ctx.lineWidth = 3;
      let y = 26;
      if (run.helmetCharges > 0) {
        ctx.strokeText(`⛑ ${run.helmetCharges}`, 64, y);
        ctx.fillText(`⛑ ${run.helmetCharges}`, 64, y);
        y += 18;
      }
      if (run.rocketCharges > 0) {
        ctx.strokeText(`🚀 ${run.rocketCharges}`, 64, y);
        ctx.fillText(`🚀 ${run.rocketCharges}`, 64, y);
      }
    }
    if (run.phase === 'flight' && run.clingKind) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = font('display', 26);
      ctx.lineWidth = 5;
      ctx.fillStyle = THEME.danger;
      const pulse = 1 + Math.sin(run.time * 12) * 0.06;
      ctx.save();
      ctx.translate(W / 2, this.height * 0.42);
      ctx.scale(pulse, pulse);
      ctx.strokeText(`${t('shakeOff')} ${run.clingTaps}/${BALANCE.clinger.taps}`, 0, 0);
      ctx.fillText(`${t('shakeOff')} ${run.clingTaps}/${BALANCE.clinger.taps}`, 0, 0);
      ctx.restore();
      ctx.textBaseline = 'top';
    }
    if (this.lawyerTime > 0) {
      ctx.textAlign = 'center';
      ctx.font = font('display', 18);
      ctx.lineWidth = 4;
      ctx.fillStyle = THEME.accent;
      ctx.strokeText(t('lawyer'), W / 2, this.height * 0.36);
      ctx.fillText(t('lawyer'), W / 2, this.height * 0.36);
    }

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

  // ---- widgets ------------------------------------------------------------

  private button(b: Button, label: string, style: 'primary' | 'secondary' | 'disabled', size = 18): void {
    const ctx = this.ctx;
    ctx.fillStyle = style === 'primary' ? THEME.accent : style === 'secondary' ? THEME.ui : 'rgba(27,29,42,0.5)';
    roundRect(ctx, b.x, b.y, b.w, b.h, Math.min(18, b.h / 3));
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = style === 'primary' ? THEME.outline : style === 'secondary' ? THEME.accent : 'rgba(255,255,255,0.15)';
    ctx.stroke();
    ctx.fillStyle = style === 'primary' ? THEME.ui : style === 'secondary' ? THEME.uiText : THEME.uiTextSoft;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font('display', size);
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2);
  }

  /** Level and progress bar, `w` wide, top-left at (x, y). */
  private drawXpBar(x: number, y: number, w: number): void {
    const ctx = this.ctx;
    const p = levelFromXp(this.save.xp);
    const ratio = p.needed > 0 ? p.into / p.needed : 1;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = font('display', 14);
    ctx.fillStyle = THEME.uiText;
    ctx.fillText(`${t('level')} ${p.level}`, x, y);
    ctx.textAlign = 'right';
    ctx.font = font('text', 12);
    ctx.fillStyle = THEME.uiTextSoft;
    ctx.fillText(p.needed > 0 ? `${p.into} / ${p.needed} ${t('xp')}` : t('maxed'), x + w, y + 2);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, x, y + 20, w, 10, 5);
    ctx.fill();
    ctx.fillStyle = THEME.accent;
    roundRect(ctx, x, y + 20, Math.max(10, w * ratio), 10, 5);
    ctx.fill();
  }

  // ---- screens -------------------------------------------------------------

  private drawHome(): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    ctx.fillStyle = THEME.shade;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.font = font('display', Math.min(72, W * 0.18));
    ctx.lineWidth = 8;
    ctx.strokeStyle = THEME.outline;
    ctx.fillStyle = THEME.accent;
    ctx.strokeText(t('title'), W / 2, H * 0.09);
    ctx.fillText(t('title'), W / 2, H * 0.09);

    const panelW = Math.min(W - 32, 380);
    const panelX = (W - panelW) / 2;
    const panelY = H * 0.24;
    ctx.fillStyle = THEME.ui;
    roundRect(ctx, panelX, panelY, panelW, 160, 20);
    ctx.fill();
    ctx.font = font('text', 15);
    const rows: [string, string][] = [
      [t('bestDistance'), this.save.bestDistance > 0 ? formatDistance(this.save.bestDistance) : '—'],
      [t('bestAltitude'), this.save.bestAltitude > 0 ? formatAltitude(this.save.bestAltitude) : '—'],
      [t('coinsTotal'), `${this.save.coins} ●`],
    ];
    let y = panelY + 18;
    for (const [label, value] of rows) {
      ctx.textAlign = 'left';
      ctx.fillStyle = THEME.uiTextSoft;
      ctx.fillText(label, panelX + 20, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = label === t('coinsTotal') ? THEME.accent : THEME.uiText;
      ctx.fillText(value, panelX + panelW - 20, y);
      y += 26;
    }
    this.drawXpBar(panelX + 20, y + 6, panelW - 40);

    this.button(this.playButton, t('play'), 'primary', 30);
    this.button(this.homeShopButton, t('shop'), 'secondary', 17);
    const cooldown = giftCooldown(this.save.lastGift, this.now);
    if (cooldown > 0) {
      this.button(this.giftButton, `${t('giftIn')} ${formatCooldown(cooldown)}`, 'disabled', 12);
    } else {
      this.button(this.giftButton, `${t('gift')} +${giftAmount(this.save.level)} ●`, 'secondary', 14);
    }
    if (this.giftFlash > 0) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = font('display', 16);
      ctx.fillStyle = THEME.accent;
      ctx.globalAlpha = Math.min(1, this.giftFlash);
      ctx.fillText(`+${giftAmount(this.save.level)} ●`, this.giftButton.x + this.giftButton.w / 2, this.giftButton.y - 22);
      ctx.globalAlpha = 1;
    }
    const soon: string[] = [t('customize'), t('trophies'), t('profiles'), t('settings')];
    this.soonButtons.forEach((b, i) => {
      this.button(b, soon[i] ?? '', 'disabled', 11);
      ctx.font = font('text', 10);
      ctx.fillStyle = THEME.uiTextSoft;
      ctx.fillText(t('soon'), b.x + b.w / 2, b.y + b.h - 12);
    });
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
    const panelY = H * 0.14;
    ctx.fillStyle = THEME.ui;
    roundRect(ctx, panelX, panelY, panelW, 372, 20);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = font('text', 16);
    const cause =
      run.endReason === 'fatal' && run.fatalKind ? fatalText(run.fatalKind) : run.endReason === 'wall' ? t('endWall') : t('endTitle');
    ctx.fillStyle = run.endReason === 'fatal' || run.endReason === 'wall' ? THEME.danger : THEME.uiTextSoft;
    ctx.fillText(cause, W / 2, panelY + 18);
    ctx.fillStyle = THEME.accent;
    ctx.font = font('display', 50);
    ctx.fillText(formatDistance(run.distance), W / 2, panelY + 42);
    if (this.newRecord || this.newAltitudeRecord || this.levelsGained > 0) {
      ctx.fillStyle = THEME.uiText;
      ctx.font = font('display', 17);
      const line = this.levelsGained > 0 ? `${t('levelUp')} ${t('level')} ${this.save.level}` : this.newRecord ? t('endRecord') : t('endAltitudeRecord');
      ctx.fillText(line, W / 2, panelY + 102);
    }

    ctx.font = font('text', 15);
    const farthest = STAGES[run.maxStageIndex] ?? STAGES[0]!;
    const highest = LAYERS[run.maxLayerIndex] ?? LAYERS[0]!;
    const rows: [string, string][] = [
      [t('endStage'), stageName(farthest.id)],
      [t('endAltitude'), formatAltitude(run.maxAltitude)],
      [t('endLayer'), layerName(highest.id)],
      [t('endSpeed'), `${formatSpeedKmh(run.maxSpeed)} ${t('speedUnit')}`],
      [t('coinsRun'), `+${run.coins + run.distanceCoins} ●`],
      [t('xp'), `+${this.runXp}`],
      [t('best'), `${formatDistance(this.save.bestDistance)} · ${formatAltitude(this.save.bestAltitude)}`],
    ];
    let y = panelY + 130;
    for (const [label, value] of rows) {
      ctx.textAlign = 'left';
      ctx.fillStyle = THEME.uiTextSoft;
      ctx.fillText(label, panelX + 22, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = THEME.uiText;
      ctx.fillText(value, panelX + panelW - 22, y);
      y += 25;
    }
    this.drawXpBar(panelX + 22, y + 8, panelW - 44);

    this.button(this.replayButton, t('replay'), 'primary', 28);
    this.button(this.endShopButton, t('shop'), 'secondary', 16);
    this.button(this.endHomeButton, t('home'), 'secondary', 16);
    ctx.fillStyle = THEME.uiTextSoft;
    ctx.font = font('text', 11);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${t('seed')} ${run.seed}`, W / 2, this.endHomeButton.y + this.endHomeButton.h + 10);
  }

  /** Full shop: one tab for upgrades, one for helmets. Locked rows are greyed with their level. */
  private drawShop(): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    ctx.fillStyle = THEME.ui;
    ctx.fillRect(0, 0, W, H);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = font('display', 26);
    ctx.fillStyle = THEME.uiText;
    ctx.fillText(t('shop'), this.tabButtons[0]!.x, 18);
    ctx.textAlign = 'right';
    ctx.font = font('display', 20);
    ctx.fillStyle = THEME.accent;
    ctx.fillText(`${this.save.coins} ●`, this.tabButtons[1]!.x + this.tabButtons[1]!.w, 22);

    this.button(this.tabButtons[0]!, t('shopUpgrades'), this.shopTab === 'upgrades' ? 'primary' : 'disabled', 15);
    this.button(this.tabButtons[1]!, t('shopHelmets'), this.shopTab === 'helmets' ? 'primary' : 'disabled', 15);

    if (this.shopTab === 'upgrades') {
      UPGRADE_IDS.forEach((id, i) => {
        const b = this.rowButtons[i]!;
        const level = this.save.upgrades[id];
        const def = BALANCE.upgrades[id];
        const locked = this.save.level < def.unlock;
        const maxed = upgradeMaxed(id, level);
        const price = upgradePrice(id, level);
        const affordable = !locked && !maxed && this.save.coins >= price;
        const right = maxed ? t('maxed') : locked ? `${t('locked')} ${def.unlock}` : `${price} ●`;
        this.shopRow(b, `${upgradeName(id)} · ${level}/${def.levels}`, upgradeEffect(id), right, locked, affordable, maxed);
      });
    } else {
      BALANCE.helmets.forEach((helmet, i) => {
        const b = this.rowButtons[i]!;
        const owned = this.save.helmet?.id === helmet.id;
        const locked = this.save.level < helmet.level;
        const affordable = !locked && !owned && this.save.coins >= helmet.price;
        const right = owned ? `${t('owned')} ${this.save.helmet?.charges ?? 0}` : locked ? `${t('locked')} ${helmet.level}` : `${helmet.price} ●`;
        this.shopRow(b, helmetName(helmet.id), `${helmet.walls} ${t('walls')}`, right, locked, affordable, owned);
      });
    }
    this.button(this.backButton, t('back'), 'secondary', 18);
  }

  private shopRow(b: Button, title: string, detail: string, right: string, locked: boolean, affordable: boolean, done: boolean): void {
    const ctx = this.ctx;
    ctx.fillStyle = done ? 'rgba(255,197,49,0.25)' : locked ? 'rgba(255,255,255,0.05)' : affordable ? 'rgba(42,157,143,0.55)' : 'rgba(255,255,255,0.12)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = font('display', 14);
    ctx.fillStyle = locked ? THEME.uiTextSoft : THEME.uiText;
    ctx.fillText(title, b.x + 12, b.y + b.h * 0.33);
    ctx.font = font('text', 11);
    ctx.fillStyle = THEME.uiTextSoft;
    ctx.fillText(detail, b.x + 12, b.y + b.h * 0.72, b.w - 110);
    ctx.textAlign = 'right';
    ctx.font = font('display', 14);
    ctx.fillStyle = done ? THEME.accent : locked ? THEME.uiTextSoft : affordable ? THEME.uiText : THEME.danger;
    ctx.fillText(right, b.x + b.w - 12, b.y + b.h / 2);
  }
}
