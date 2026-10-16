import { BALANCE, launchSpeed } from '../config/balance';
import { COUNTRIES, countryName, flagOf } from '../config/countries';
import { GAME_URL } from '../config/links';
import { track } from '../core/analytics';
import { Sounds } from '../core/audio';
import type { PointerListener } from '../core/input';
import { newSeed, Rng } from '../core/rng';
import { aimFromDrag } from '../game/kick';
import { speedOf } from '../game/physics';
import {
  buyCoinPack,
  buyGadget,
  buyTimeScale,
  coinMultiplier,
  coinPackAmount,
  consumeGadgets,
  gadgetBonuses,
  giftHours,
  grantStarsProduct,
  maxTimeScaleIndex,
  nextTimeScaleUnlock,
  passActive,
  starsLeftToday,
  starsPrice,
  type StarsProductId,
  startBoostWindow,
  starterAvailable,
} from '../game/premium';
import { giftAmount, giftCooldown, levelFromXp, UPGRADE_IDS, upgradeMaxed, upgradePrice, xpForRun } from '../game/progress';
import {
  type Bonus,
  claimChallenge,
  dailyChallenges,
  nearMiss,
  progressChallenges,
  recordRun,
  returnBonus,
  type Reward,
  runBonus,
  spinWheel,
  syncChallenges,
  touchStreak,
  wheelAvailable,
  wheelReward,
} from '../game/retention';
import { defaultEquipment, Run } from '../game/run';
import { cleanName, defaultSave, type GadgetId, type KeyValueStore, loadSave, type SaveData, writeSave } from '../game/save';
import { GhostTrajectory } from '../game/trajectory';
import { awardTrophies, TROPHIES, type TrophyDef, trophyProgress } from '../game/trophies';
import { LAYERS, type LayerId, STAGES, type StageId, stageAt } from '../game/world';
import { ASSETS, roundRect } from '../theme/assets';
import { CHARACTER_POSE, drawCharacter } from '../theme/character';
import { drawEntity } from '../theme/entitySprites';
import { LAYER_PALETTES, STAGE_PALETTES } from '../theme/palettes';
import { drawBorderSign, drawClouds, drawGround, drawLayerSign, drawScenery, drawStars, drawSun } from '../theme/scenery';
import { font, THEME } from '../theme/theme';
import { FABRIC_COLOURS, GENDERS, HAIRSTYLES, OUTFIT_IDS, OUTFITS } from '../theme/wardrobe';
import { formatAltitude, formatDistance, formatSpeedKmh } from './format';
import { drawIcon, type IconId } from './icons';
import {
  fatalText,
  helmetName,
  layerName,
  setLang,
  stageName,
  t,
  type TextKey,
  tg,
  trophyKindText,
  trophyName,
  upgradeEffect,
  upgradeName,
} from './i18n';
import { claimPurchases, paymentsAvailable, requestPurchase } from '../telegram/payments';
import { haptic, type HapticKind, type Insets, type TelegramWebApp } from '../telegram/webapp';
import { drawBanner, drawShockWave, Particles, Trail } from './fx';
import { createOverlay, type Overlay } from './overlay';
import { shareText } from './share';

export interface AppOptions {
  telegram: TelegramWebApp | null;
  insets: Insets;
}

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

type Screen = 'home' | 'game' | 'shop' | 'customize' | 'trophies' | 'profiles' | 'settings' | 'premium' | 'challenges' | 'wheel';
type ShopTab = 'upgrades' | 'helmets';

/** "+40 ●" / "+1 🎟", or both. */
function rewardText(r: Reward): string {
  const parts: string[] = [];
  if (r.coins > 0) parts.push(`+${r.coins} ●`);
  if (r.billets > 0) parts.push(`+${r.billets} 🎟`);
  return parts.join(' ');
}

function fill(text: string, values: Record<string, string | number>): string {
  let out = text;
  for (const k in values) out = out.replace(`{${k}}`, String(values[k]));
  return out;
}

/** One element of a scrolling list screen: its box in content coordinates, how to draw it, what a tap does. */
interface Item {
  b: Button;
  draw: (b: Button) => void;
  tap?: () => void;
}

const SCROLL_SCREENS: readonly Screen[] = ['customize', 'trophies', 'profiles', 'settings', 'premium', 'challenges'];

/** Game screen: home, aim, kick, flight, end screen, shop and the menus. Owns the canvas and the current run. */
export class App implements PointerListener {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;

  private save: SaveData;
  private readonly run: Run;
  private readonly ghost = new GhostTrajectory();
  private readonly equipment = defaultEquipment();
  private readonly overlay: Overlay | null;
  private readonly sounds = new Sounds();
  private readonly trail = new Trail();
  private readonly particles = new Particles();
  private readonly tg: TelegramWebApp | null;
  private readonly insets: Insets;

  // effects (seconds remaining, world positions)
  private shockTime = 0;
  private shockX = 0;
  private shockY = 0;
  private bannerTime = 0;
  private bannerKind: 'distance' | 'altitude' = 'distance';
  private slowMoTime = 0;
  private slowMoCounter = 0;
  private trailCounter = 0;
  private distanceRecordHit = false;
  private altitudeRecordHit = false;

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
  private readonly gradients = new Map<string, CanvasGradient>();

  // pointer
  private dragStartX = 0;
  private dragStartY = 0;
  private dragX = 0;
  private dragY = 0;

  // scrolling list screens
  private items: Item[] = [];
  private contentHeight = 0;
  private scrollY = 0;
  private pressY = 0;
  private pressScroll = 0;
  private pressed = false;
  private dragging = false;
  private relayout = true;
  private resetStep = 0;

  private paused = false;
  private newRecord = false;
  private newAltitudeRecord = false;
  private levelsGained = 0;
  private runXp = 0;
  private newTrophies: TrophyDef[] = [];
  private sharedTime = 0;

  // economy and retention
  private sessionStart = 0;
  private sessionPaid = false;
  private nextDailyCheck = 0;
  /** Short message on the home screen (streak, welcome back) and its seconds left. */
  private homeNotice = '';
  private homeNoticeTime = 0;
  /** Short message on the premium screen (payment result, cap) and its seconds left. */
  private premiumNotice = '';
  private premiumNoticeTime = 0;
  /** Stars product waiting for its confirmation tap, and whether an invoice is open. */
  private confirmId: StarsProductId | null = null;
  private buying = false;
  private endBonus: Bonus | null = null;
  private endChallenges = 0;
  private endNearMiss: { metres: number; stageId: string } | null = null;
  private boostGain = 0;
  private starterJustOffered = false;
  // wheel
  private wheelSpinning = false;
  private wheelTime = 0;
  private wheelFrom = 0;
  private wheelTo = 0;
  private wheelAngle = 0;
  private wheelResult = -1;
  private wheelPrize: Reward | null = null;
  private wheelTick = 0;
  private readonly confetti = new Particles(96);
  private readonly spinButton = btn();
  private readonly dailyButtons: Button[] = [btn(), btn(), btn()];

  // buttons
  private readonly replayButton = btn();
  private readonly shareButton = btn();
  private readonly endShopButton = btn();
  private readonly endHomeButton = btn();
  private readonly pauseButton = btn();
  private readonly speedButton = btn();
  private readonly playButton = btn();
  private readonly homeShopButton = btn();
  private readonly giftButton = btn();
  private readonly menuButtons: Button[] = [btn(), btn(), btn(), btn()];
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
    options: AppOptions = { telegram: null, insets: { top: 0, bottom: 0 } },
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
    this.tg = options.telegram;
    this.insets = options.insets;
    this.save = loadSave(store);
    this.save.level = levelFromXp(this.save.xp).level;
    setLang(this.save.settings.lang);
    this.sounds.enabled = this.save.settings.sound;
    this.startSession();
    this.applyEquipment();
    this.run = new Run(newSeed(), this.equipment, 'depart', {
      onObstacle: (e) => {
        this.shake = Math.min(1, this.shake + 0.5);
        if (e.kind === 'radar') this.flash = 0.6;
        this.sounds.play('obstacle');
        this.buzz('impact');
      },
      onWall: (_e, broken) => {
        this.shake = 1;
        if (!broken) this.flash = 0.4;
        this.sounds.play(broken ? 'wall' : 'crash');
        this.buzz('wall');
      },
      onLawyer: () => {
        this.lawyerTime = 2.5;
        this.sounds.play('buy');
      },
      onBounce: (impact) => {
        this.shake = Math.min(1, this.shake + impact / 60);
        this.sounds.play('bounce', impact / 40);
        this.buzz('bounce');
      },
      onCoin: (e) => {
        this.particles.burst(e.x, e.y + 0.5, BALANCE.fx.particlesPerCoin, e.seed * 10);
        this.sounds.play('coin');
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
        this.shockTime = BALANCE.fx.shockSeconds;
        this.shockX = this.run.body.x;
        this.shockY = this.run.body.y;
        this.sounds.play('barrier');
        this.buzz('wall');
      },
      onRocket: () => {
        this.flash = 0.35;
        this.shake = 0.5;
        this.sounds.play('rocket');
        this.buzz('impact');
      },
    });
    const host = canvas.parentElement;
    this.overlay = host ? createOverlay(host, BALANCE.customisation.nameMaxLength, COUNTRIES, t('nationalityNone')) : null;
    if (this.overlay) {
      this.overlay.input.addEventListener('input', () => {
        this.save.profile.name = cleanName(this.overlay!.input.value);
        this.persist();
      });
      this.overlay.input.addEventListener('change', () => {
        this.overlay!.input.value = this.save.profile.name;
      });
      this.overlay.select.addEventListener('change', () => {
        this.save.profile.nationality = this.overlay!.select.value;
        this.persist();
      });
    }
    this.resize();
  }

  /** The run reads its equipment from this object; it mirrors the save's upgrades plus the gadgets held. */
  private applyEquipment(): void {
    const u = this.save.upgrades;
    const g = gadgetBonuses(this.save);
    const eq = this.equipment;
    eq.kickLevel = u.force;
    eq.solesLevel = u.semelles + g.soles;
    eq.suitLevel = u.combinaison;
    eq.magnetLevel = u.aimant + g.magnet;
    eq.rocketCharges = u.fusee + g.rockets;
    eq.rampLevel = u.tremplin;
    eq.lawyerCharges = u.avocat + g.lawyer;
    eq.helmetCharges = this.save.helmet?.charges ?? 0;
  }

  /** Session start: welcome-back gift, login streak, today's challenges, one anonymous event. */
  private startSession(): void {
    const now = Date.now();
    this.now = now;
    this.sessionStart = now;
    this.sessionPaid = false;
    const back = returnBonus(this.save, now);
    syncChallenges(this.save, now);
    const streak = touchStreak(this.save, now);
    if (back) this.notice(`${t('bonus_return')} ${rewardText(back.reward)}`, 8);
    else if (streak) this.notice(fill(t('streakLine'), { day: streak.day, reward: rewardText(streak.reward) }), 8);
    awardTrophies(this.save);
    this.nextDailyCheck = now + 60_000;
    track('session_start', { level: this.save.level, runs: this.save.runs, streak: this.save.daily.streakDay, pass: passActive(this.save, now) });
    this.persist();
    void this.claimPending().then((n) => {
      if (n > 0) this.notice(t('paymentDone'), 6);
    });
  }

  /** Credit the purchases the server holds for this player (paid while the game was closed, or just now). */
  private async claimPending(): Promise<number> {
    const products = await claimPurchases(this.tg);
    for (const id of products) grantStarsProduct(this.save, id, Date.now());
    if (products.length > 0) {
      this.applyEquipment();
      this.relayout = true;
      this.persist();
    }
    return products.length;
  }

  private notice(text: string, seconds: number): void {
    this.homeNotice = text;
    this.homeNoticeTime = seconds;
  }

  private premiumMessage(text: string): void {
    this.premiumNotice = text;
    this.premiumNoticeTime = 3;
  }

  private persist(): void {
    writeSave(this.store, this.save);
  }

  private buzz(kind: HapticKind): void {
    if (this.save.settings.haptics) haptic(this.tg, kind);
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
    const T = this.insets.top;
    const B = this.insets.bottom;

    // end screen
    Object.assign(this.replayButton, { x: bx, y: H * 0.7, w: bw, h: 64 });
    const third = (bw - 12) / 3;
    Object.assign(this.shareButton, { x: bx, y: H * 0.7 + 76, w: third, h: 44 });
    Object.assign(this.endShopButton, { x: bx + third + 6, y: H * 0.7 + 76, w: third, h: 44 });
    Object.assign(this.endHomeButton, { x: bx + 2 * (third + 6), y: H * 0.7 + 76, w: third, h: 44 });

    // flight
    Object.assign(this.pauseButton, { x: 12, y: 12 + T, w: 44, h: 44 });
    Object.assign(this.speedButton, { x: W - 12 - 64, y: H - 24 - 44 - B, w: 64, h: 44 });

    // home
    Object.assign(this.playButton, { x: bx, y: H * 0.5, w: bw, h: 72 });
    Object.assign(this.homeShopButton, { x: bx, y: H * 0.5 + 86, w: bw / 2 - 6, h: 54 });
    Object.assign(this.giftButton, { x: bx + bw / 2 + 6, y: H * 0.5 + 86, w: bw / 2 - 6, h: 54 });
    const sw = (bw - 18) / 4;
    this.menuButtons.forEach((b, i) => Object.assign(b, { x: bx + i * (sw + 6), y: H * 0.5 + 148, w: sw, h: 62 }));
    const dw = (bw - 12) / 3;
    this.dailyButtons.forEach((b, i) => Object.assign(b, { x: bx + i * (dw + 6), y: H * 0.5 + 222, w: dw, h: 58 }));

    // wheel
    Object.assign(this.spinButton, { x: bx, y: H - 136 - B, w: bw, h: 56 });

    // shop and list screens
    const panelW = Math.min(W - 24, 420);
    const panelX = (W - panelW) / 2;
    const tabY = 66 + T;
    this.tabButtons.forEach((b, i) => Object.assign(b, { x: panelX + 12 + i * (panelW / 2 - 12), y: tabY, w: panelW / 2 - 18, h: 40 }));
    Object.assign(this.backButton, { x: bx, y: H - 72 - B, w: bw, h: 48 });
    const top = tabY + 56;
    const rowH = Math.max(44, Math.min(58, (this.backButton.y - 16 - top) / this.rowButtons.length - 6));
    this.rowButtons.forEach((b, i) => Object.assign(b, { x: panelX + 12, y: top + i * (rowH + 6), w: panelW - 24, h: rowH }));
    this.relayout = true;
  }

  // ---- input -------------------------------------------------------------

  down(x: number, y: number): void {
    this.sounds.unlock();
    if (this.screen !== 'game' || this.run.phase === 'ended') this.sounds.play('tap');
    if (SCROLL_SCREENS.includes(this.screen)) {
      this.pressed = true;
      this.dragging = false;
      this.pressY = y;
      this.pressScroll = this.scrollY;
      return;
    }
    if (this.screen === 'home') {
      if (inside(this.playButton, x, y)) this.screen = 'game';
      else if (inside(this.homeShopButton, x, y)) this.openShop('home');
      else if (inside(this.giftButton, x, y)) this.claimGift();
      else if (inside(this.dailyButtons[0]!, x, y)) this.openWheel();
      else if (inside(this.dailyButtons[1]!, x, y)) this.openList('challenges');
      else if (inside(this.dailyButtons[2]!, x, y)) this.openList('premium');
      else {
        const targets: Screen[] = ['customize', 'trophies', 'profiles', 'settings'];
        this.menuButtons.forEach((b, i) => {
          if (inside(b, x, y)) this.openList(targets[i]!);
        });
      }
      return;
    }
    if (this.screen === 'wheel') {
      if (inside(this.spinButton, x, y)) this.spin();
      else if (inside(this.backButton, x, y) && !this.wheelSpinning) this.screen = 'home';
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
      else if (inside(this.shareButton, x, y)) void this.share();
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
      run.cycleTimeScale(maxTimeScaleIndex(this.save, this.now));
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
    if (this.pressed) {
      const dy = y - this.pressY;
      if (Math.abs(dy) > 8) this.dragging = true;
      if (this.dragging) this.scrollY = this.clampScroll(this.pressScroll - dy);
      return;
    }
    if (this.screen !== 'game' || !this.run.aiming) return;
    this.dragX = x;
    this.dragY = y;
    this.updateAim();
  }

  up(x: number, y: number): void {
    if (this.pressed) {
      this.pressed = false;
      if (this.dragging) return;
      if (inside(this.backButton, x, y)) {
        this.closeList();
        return;
      }
      const cy = y - this.contentTop() + this.scrollY;
      if (y < this.contentTop() || y > this.backButton.y - 8) return;
      for (const item of this.items) {
        if (item.tap && inside(item.b, x, cy)) {
          item.tap();
          this.relayout = true;
          break;
        }
      }
      return;
    }
    if (this.screen !== 'game' || !this.run.aiming) return;
    if (this.run.release()) {
      this.sounds.play('kick');
      // Gadgets armed for this run are spent at the kick.
      if (consumeGadgets(this.save).length > 0) this.persist();
    }
  }

  private updateAim(): void {
    const full = Math.min(this.width, this.height) * BALANCE.kick.fullPowerDragFraction;
    aimFromDrag(this.dragX - this.dragStartX, this.dragY - this.dragStartY, full, this.run.aim);
    this.ghost.compute(launchSpeed(this.run.aim.power, this.equipment.kickLevel), this.run.aim.angle);
  }

  private openShop(from: Screen): void {
    this.shopReturn = from;
    this.screen = 'shop';
    track('shop_open', { coins: this.save.coins, level: this.save.level });
  }

  private openList(screen: Screen): void {
    this.screen = screen;
    this.scrollY = 0;
    this.resetStep = 0;
    this.confirmId = null;
    this.relayout = true;
    if (screen === 'premium') track('premium_open', { billets: this.save.premium.billets, level: this.save.level });
    if (this.overlay) {
      this.overlay.input.value = this.save.profile.name;
      this.overlay.select.value = this.save.profile.nationality;
    }
  }

  private closeList(): void {
    this.overlay?.place(false, this.backButton, this.backButton);
    this.screen = 'home';
    this.resetStep = 0;
  }

  private contentTop(): number {
    return 62 + this.insets.top;
  }

  private clampScroll(v: number): number {
    const viewport = this.backButton.y - 12 - this.contentTop();
    return Math.max(0, Math.min(Math.max(0, this.contentHeight - viewport), v));
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
    awardTrophies(this.save);
    this.sounds.play('buy');
    this.buzz('buy');
    this.persist();
  }

  private buyHelmet(index: number): void {
    const helmet = BALANCE.helmets[index];
    if (!helmet || this.save.level < helmet.level || this.save.coins < helmet.price) return;
    if (this.save.helmet && this.save.helmet.id === helmet.id) return;
    this.save.coins -= helmet.price;
    this.save.helmet = { id: helmet.id, charges: helmet.walls };
    this.applyEquipment();
    this.syncAimedRun();
    this.sounds.play('buy');
    this.buzz('buy');
    this.persist();
  }

  /** A run waiting for its kick picks up new equipment at once (ramp, charges). */
  private syncAimedRun(): void {
    if (this.run.phase === 'aim' && !this.run.aiming) this.run.reset(this.run.seed);
  }

  private claimGift(): void {
    if (giftCooldown(this.save.lastGift, this.now, giftHours(this.save, this.now)) > 0) return;
    const amount = giftAmount(this.save.level);
    this.save.coins += amount;
    this.save.totalCoins += amount;
    this.save.lastGift = this.now;
    this.giftFlash = 2;
    awardTrophies(this.save);
    this.sounds.play('buy');
    this.buzz('buy');
    this.persist();
  }

  private async share(): Promise<void> {
    const run = this.run;
    const line = t('shareLine')
      .replace('{name}', this.save.profile.name)
      .replace('{distance}', formatDistance(run.distance))
      .replace('{altitude}', formatAltitude(run.maxAltitude));
    if (await shareText(`${line} ${GAME_URL}`)) this.sharedTime = 2;
  }

  private resetProgress(keepProfile: boolean): void {
    const fresh = defaultSave();
    if (keepProfile) fresh.profile = this.save.profile;
    fresh.settings = this.save.settings;
    this.save = fresh;
    this.applyEquipment();
    this.persist();
    this.run.reset(newSeed());
    this.resetStep = 0;
  }

  private restart(): void {
    this.newRecord = false;
    this.newAltitudeRecord = false;
    this.levelsGained = 0;
    this.runXp = 0;
    this.newTrophies = [];
    this.sharedTime = 0;
    this.endBonus = null;
    this.endChallenges = 0;
    this.endNearMiss = null;
    this.boostGain = 0;
    this.starterJustOffered = false;
    this.paused = false;
    this.lawyerTime = 0;
    this.stageSignTime = 0;
    this.layerSignTime = 0;
    this.flash = 0;
    this.shockTime = 0;
    this.bannerTime = 0;
    this.slowMoTime = 0;
    this.distanceRecordHit = false;
    this.altitudeRecordHit = false;
    this.trail.clear();
    this.particles.clear();
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
    if (this.sharedTime > 0) this.sharedTime = Math.max(0, this.sharedTime - dt);
    if (this.homeNoticeTime > 0) this.homeNoticeTime = Math.max(0, this.homeNoticeTime - dt);
    if (this.premiumNoticeTime > 0) this.premiumNoticeTime = Math.max(0, this.premiumNoticeTime - dt);
    if (this.now >= this.nextDailyCheck) {
      // Past midnight with the game open: the streak and the challenges roll over.
      this.nextDailyCheck = this.now + 60_000;
      const streak = touchStreak(this.save, this.now);
      syncChallenges(this.save, this.now);
      if (streak) {
        this.notice(fill(t('streakLine'), { day: streak.day, reward: rewardText(streak.reward) }), 8);
        this.relayout = true;
        this.persist();
      }
    }
    if (this.screen === 'wheel') this.updateWheel(dt);
    if (this.paused || this.screen !== 'game') {
      // Home and menus keep the scenery alive behind them, without advancing the run.
      this.run.time += dt;
      return;
    }
    const run = this.run;
    const wasEnded = run.phase === 'ended';
    // Time accelerator: more physics steps per frame, the step itself never changes.
    // Slow motion on a record: only one update in 1/factor advances the physics.
    let stepsThisFrame = run.phase === 'flight' ? run.timeScale : 1;
    if (this.slowMoTime > 0) {
      this.slowMoTime = Math.max(0, this.slowMoTime - dt);
      this.slowMoCounter++;
      stepsThisFrame = this.slowMoCounter % Math.round(1 / BALANCE.fx.slowMoFactor) === 0 ? 1 : 0;
    }
    for (let i = 0; i < stepsThisFrame && run.phase !== 'ended'; i++) run.step(dt);
    if (!wasEnded && run.phase === 'ended') this.finishRun();
    this.particles.update(dt);
    if (this.shockTime > 0) this.shockTime = Math.max(0, this.shockTime - dt);
    if (this.bannerTime > 0) this.bannerTime = Math.max(0, this.bannerTime - dt);
    if (run.phase === 'flight') {
      // One trail point every few physics steps, so the tail covers about a second of flight.
      if (speedOf(run.body) > BALANCE.fx.trailMinSpeed) {
        if (++this.trailCounter % BALANCE.fx.trailEverySteps === 0) this.trail.push(run.body.x, run.body.y);
      } else this.trail.clear();
      // Records fall in flight: short slow motion and a banner, distinct for distance and altitude.
      if (!this.distanceRecordHit && this.save.bestDistance > 0 && run.distance > this.save.bestDistance) {
        this.distanceRecordHit = true;
        this.recordMoment('distance');
      }
      if (!this.altitudeRecordHit && this.save.bestAltitude > 0 && run.maxAltitude > this.save.bestAltitude) {
        this.altitudeRecordHit = true;
        this.recordMoment('altitude');
      }
    }
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

  private recordMoment(kind: 'distance' | 'altitude'): void {
    this.bannerKind = kind;
    this.bannerTime = BALANCE.fx.bannerSeconds;
    this.slowMoTime = BALANCE.fx.slowMoSeconds;
    this.slowMoCounter = 0;
    this.sounds.play('record');
    this.buzz('record');
  }

  private finishRun(): void {
    const run = this.run;
    const save = this.save;
    const now = this.now;
    const bestBefore = save.bestDistance;
    save.runs++;
    if (run.endReason === 'fatal') this.buzz('fatal');
    if (run.distance > save.bestDistance) {
      this.newRecord = save.bestDistance > 0;
      save.bestDistance = run.distance;
    }
    if (run.maxAltitude > save.bestAltitude) {
      this.newAltitudeRecord = save.bestAltitude > 0;
      save.bestAltitude = run.maxAltitude;
    }
    const earned = (run.coins + run.distanceCoins) * coinMultiplier(save, now);
    save.coins += earned;
    save.totalCoins += earned;
    // Purchase felt: the gain against the average of the runs before it, for a few runs.
    if (save.retention.boostRuns > 0) {
      save.retention.boostRuns--;
      this.boostGain = Math.max(0, run.distance - save.retention.boostBaseline);
    }
    recordRun(save, run.distance);
    const offeredBefore = save.premium.starterOfferedAt;
    this.endBonus = runBonus(save, now, run.distance, bestBefore, this.sessionStart, this.sessionPaid);
    if (this.endBonus?.kind === 'session') this.sessionPaid = true;
    this.starterJustOffered = offeredBefore === 0 && save.premium.starterOfferedAt !== 0;
    this.endChallenges = progressChallenges(save, now, {
      distance: run.distance,
      maxAltitude: run.maxAltitude,
      coinsPicked: run.coinsPicked,
      bestChain: run.bestBouncerChain,
      wallsBroken: run.wallsBroken,
    }).length;
    this.endNearMiss = nearMiss(run.distance);
    const stage = STAGES[run.maxStageIndex] ?? STAGES[0]!;
    track('run_end', {
      distance: Math.round(run.distance),
      altitude: Math.round(run.maxAltitude),
      stage: stage.id,
      reason: run.endReason ?? 'stopped',
      seconds: Math.round(run.time),
      timeScale: run.timeScale,
      bonus: this.endBonus?.kind ?? '',
    });
    this.runXp = xpForRun(run.distance, earned);
    const before = save.level;
    save.xp += this.runXp;
    save.level = levelFromXp(save.xp).level;
    this.levelsGained = save.level - before;
    save.stats.wallsBroken += run.wallsBroken;
    save.stats.controlsAvoided += run.lawyerUsed;
    save.stats.barriers += run.barrierCount;
    save.stats.bestChain = Math.max(save.stats.bestChain, run.bestBouncerChain);
    // The helmet keeps the charges it has left; consumed when none remain.
    if (save.helmet) {
      save.helmet = run.helmetCharges > 0 ? { id: save.helmet.id, charges: run.helmetCharges } : null;
    }
    this.newTrophies = awardTrophies(save);
    if (this.newTrophies.length > 0) this.sounds.play('trophy');
    this.applyEquipment();
    this.persist();
  }

  // ---- rendering ----------------------------------------------------------

  render(alpha: number): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const run = this.run;
    const b = run.body;
    const px = run.prevX + (b.x - run.prevX) * alpha;
    const py = run.prevY + (b.y - run.prevY) * alpha;
    const scale = BALANCE.render.pixelsPerMetre * this.zoom;
    const shakeX = this.shake > 0 ? Math.sin(run.time * 90) * this.shake * 6 : 0;
    const shakeY = this.shake > 0 ? Math.cos(run.time * 77) * this.shake * 6 : 0;
    const originX = W * BALANCE.render.playerScreenX - this.camX * scale + shakeX;
    const originY = H * BALANCE.render.playerScreenY + this.camY * scale + shakeY;

    this.drawSky(originY);
    drawScenery(ctx, W, this.camX, this.camY, this.zoom, originY);
    drawGround(ctx, W, H, originX, originY, scale, this.camX);
    if (this.screen === 'game' && run.phase === 'aim' && run.aiming) this.drawGhost(originX, originY, scale);
    this.drawEntities(originX, originY, scale);
    this.particles.draw(ctx, originX, originY, scale);
    if (this.screen === 'game' && run.phase === 'flight') {
      this.trail.draw(ctx, originX, originY, scale, Math.min(1, speedOf(b) / 150));
    }
    this.drawPlayer(px, py, originX, originY, scale);
    this.drawBoot(originX, originY, scale);
    if (this.shockTime > 0) {
      drawShockWave(ctx, originX + this.shockX * scale, originY - this.shockY * scale, 1 - this.shockTime / BALANCE.fx.shockSeconds, W);
    }

    if (this.screen === 'home') {
      this.drawHome();
      return;
    }
    if (this.screen === 'shop') {
      this.drawShop();
      return;
    }
    if (this.screen === 'wheel') {
      this.drawWheel();
      return;
    }
    if (SCROLL_SCREENS.includes(this.screen)) {
      this.drawList();
      return;
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash.toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }
    this.drawSigns();
    this.drawHud();
    if (this.bannerTime > 0) {
      const text = this.bannerKind === 'distance' ? tg('endRecord', this.save.profile.gender) : t('endAltitudeRecord');
      drawBanner(ctx, W, H * 0.3, 1 - this.bannerTime / BALANCE.fx.bannerSeconds, text, this.bannerKind, font('display', 24));
    }
    if (run.phase === 'aim' && !run.aiming) this.drawHint();
    if (run.phase === 'ended') this.drawEndScreen();
    else if (this.paused) this.drawPause();
  }

  /** Sky of the stage under x below the tropopause, sky of the layer above, blended near the boundary. */
  private drawSky(originY: number): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    const stageId = stageAt(this.camX).id;
    ctx.fillStyle = this.skyGradient(stageId, H);
    ctx.fillRect(0, 0, W, H);

    const y = this.camY;
    const tropo = BALANCE.altitude.tropopause;
    // Fade the layer sky in over the last fifth of the troposphere.
    const blend = Math.min(1, Math.max(0, (y - tropo * 0.8) / (tropo * 0.2)));
    if (blend < 1) {
      drawSun(ctx, W, H, this.camX, stageId);
      drawClouds(ctx, W, Math.min(H, originY), this.camX, this.zoom, stageId);
    }
    if (blend > 0) {
      const layerId = (LAYERS[this.run.layerIndex] ?? LAYERS[0]!).id;
      const layer = LAYER_PALETTES[layerId];
      ctx.globalAlpha = blend;
      ctx.fillStyle = this.skyGradient(layerId, H);
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

  /** Vertical sky gradient of a stage or layer, built once per canvas height so the loop allocates nothing. */
  private skyGradient(id: StageId | LayerId, H: number): CanvasGradient {
    const key = `${id}:${H}`;
    let g = this.gradients.get(key);
    if (!g) {
      const p = id in STAGE_PALETTES ? STAGE_PALETTES[id as StageId] : LAYER_PALETTES[id as LayerId];
      g = this.ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, p.skyTop);
      g.addColorStop(1, p.skyBottom);
      if (this.gradients.size > 64) this.gradients.clear();
      this.gradients.set(key, g);
    }
    return g;
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

  private drawPlayer(x: number, y: number, ox: number, oy: number, scale: number): void {
    const ctx = this.ctx;
    const run = this.run;
    const P = BALANCE.player;
    // Readable at any zoom: the sprite scale never drops below the minimum on-screen height.
    const spriteScale = Math.max(scale, BALANCE.render.minCharacterPx / P.height);
    ctx.save();
    ctx.translate(ox + x * scale, oy - y * scale - (P.height / 2 + 0.5) * spriteScale);
    ctx.scale(spriteScale, -spriteScale);
    let pose: number = CHARACTER_POSE.fours;
    if (run.phase === 'flight') {
      const b = run.body;
      pose = b.rolling ? CHARACTER_POSE.roll : CHARACTER_POSE.flight;
      const angle = b.rolling ? -run.time * b.vx * 0.6 : Math.atan2(b.vy, Math.max(1, b.vx)) * 0.8;
      ctx.rotate(angle);
    }
    drawCharacter(ctx, this.save.profile, pose, run.time);
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

  private playerLabel(): string {
    const flag = flagOf(this.save.profile.nationality);
    return `${flag ? `${flag} ` : ''}${this.save.profile.name}`;
  }

  private drawHud(): void {
    const ctx = this.ctx;
    const run = this.run;
    const W = this.width;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';

    ctx.save();
    ctx.translate(0, this.insets.top);
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
    const name = `${this.playerLabel()} · ${t('level')} ${this.save.level}`;
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
    ctx.restore();

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
    const y = this.height - 30 - this.insets.bottom;
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

  private button(b: Button, label: string, style: 'primary' | 'secondary' | 'disabled', size = 18, icon?: IconId): void {
    const ctx = this.ctx;
    const r = Math.min(18, b.h / 3);
    const lift = style === 'disabled' ? 2 : 5;
    // A solid drop under the face gives the flat cartoon buttons some thickness.
    ctx.fillStyle = style === 'primary' ? '#b8860b' : style === 'secondary' ? '#0f1018' : 'rgba(27,29,42,0.4)';
    roundRect(ctx, b.x, b.y + lift, b.w, b.h, r);
    ctx.fill();
    ctx.fillStyle = style === 'primary' ? THEME.accent : style === 'secondary' ? THEME.ui : 'rgba(27,29,42,0.5)';
    roundRect(ctx, b.x, b.y, b.w, b.h - 2, r);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = style === 'primary' ? THEME.outline : style === 'secondary' ? THEME.accent : 'rgba(255,255,255,0.15)';
    ctx.stroke();
    ctx.fillStyle = style === 'primary' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)';
    roundRect(ctx, b.x + 8, b.y + 4, b.w - 16, Math.max(3, b.h * 0.14), 3);
    ctx.fill();
    const colour = style === 'primary' ? THEME.ui : style === 'secondary' ? THEME.uiText : THEME.uiTextSoft;
    ctx.fillStyle = colour;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font('display', size);
    if (icon) {
      // Icon above the label.
      drawIcon(ctx, icon, b.x + b.w / 2, b.y + b.h * 0.34, Math.min(26, b.h * 0.36), colour);
      ctx.fillStyle = colour;
      ctx.font = font('display', Math.min(size, b.h * 0.24));
      ctx.fillText(label, b.x + b.w / 2, b.y + b.h * 0.78, b.w - 10);
    } else {
      ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 - 1, b.w - 12);
    }
  }

  /** Small selectable pill. */
  private chip(b: Button, label: string, selected: boolean, size = 13): void {
    const ctx = this.ctx;
    ctx.fillStyle = selected ? THEME.accent : 'rgba(255,255,255,0.1)';
    roundRect(ctx, b.x, b.y, b.w, b.h, b.h / 2);
    ctx.fill();
    ctx.fillStyle = selected ? THEME.ui : THEME.uiText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font('display', size);
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2, b.w - 8);
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

  private sectionLabel(b: Button, text: string): void {
    const ctx = this.ctx;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = font('display', 14);
    ctx.fillStyle = THEME.uiTextSoft;
    ctx.fillText(text, b.x, b.y + b.h / 2);
  }

  // ---- screens -------------------------------------------------------------

  private drawHome(): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    // The scenery stays visible: only a light veil so the text reads.
    ctx.fillStyle = 'rgba(10,14,40,0.18)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.font = font('display', Math.min(72, W * 0.18));
    ctx.lineWidth = 8;
    ctx.strokeStyle = THEME.outline;
    ctx.fillStyle = THEME.accent;
    ctx.strokeText(t('title'), W / 2, H * 0.08);
    ctx.fillText(t('title'), W / 2, H * 0.08);

    const panelW = Math.min(W - 32, 380);
    const panelX = (W - panelW) / 2;
    const panelY = H * 0.22;
    ctx.fillStyle = 'rgba(27,29,42,0.88)';
    roundRect(ctx, panelX, panelY, panelW, 186, 20);
    ctx.fill();
    ctx.font = font('display', 16);
    ctx.fillStyle = THEME.uiText;
    ctx.textAlign = 'left';
    ctx.fillText(this.playerLabel(), panelX + 20, panelY + 16);
    ctx.font = font('text', 15);
    const rows: [string, string][] = [
      [t('bestDistance'), this.save.bestDistance > 0 ? formatDistance(this.save.bestDistance) : '—'],
      [t('bestAltitude'), this.save.bestAltitude > 0 ? formatAltitude(this.save.bestAltitude) : '—'],
      [t('coinsTotal'), `${this.save.coins} ●   ${this.save.premium.billets} 🎟`],
    ];
    let y = panelY + 44;
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
    if (passActive(this.save, this.now)) {
      ctx.textAlign = 'right';
      ctx.font = font('display', 12);
      ctx.fillStyle = THEME.accent;
      ctx.fillText(t('pass'), panelX + panelW - 20, panelY + 16);
    }
    if (this.homeNoticeTime > 0 && this.homeNotice) {
      ctx.globalAlpha = Math.min(1, this.homeNoticeTime);
      ctx.fillStyle = THEME.accent;
      roundRect(ctx, panelX, panelY - 34, panelW, 28, 14);
      ctx.fill();
      ctx.fillStyle = THEME.ui;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = font('display', 13);
      ctx.fillText(this.homeNotice, W / 2, panelY - 20, panelW - 16);
      ctx.globalAlpha = 1;
      ctx.textBaseline = 'top';
    }

    // The character stands between the panel and the play button, as big as the gap allows.
    const gap = this.playButton.y - (panelY + 186);
    this.drawHero(W / 2, this.playButton.y - 6, Math.max(14, Math.min(40, (gap - 10) / 3.1)));
    this.button(this.playButton, t('play'), 'primary', 30);
    this.button(this.homeShopButton, t('shop'), 'secondary', 16, 'cart');
    const cooldown = giftCooldown(this.save.lastGift, this.now, giftHours(this.save, this.now));
    if (cooldown > 0) {
      this.button(this.giftButton, `${t('giftIn')} ${formatCooldown(cooldown)}`, 'disabled', 12);
    } else {
      this.button(this.giftButton, `${t('gift')} +${giftAmount(this.save.level)} ●`, 'secondary', 12, 'gift');
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
    const labels: string[] = [t('customize'), t('trophies'), t('profiles'), t('settings')];
    const icons: IconId[] = ['shirt', 'trophy', 'person', 'gear'];
    this.menuButtons.forEach((b, i) => this.button(b, labels[i] ?? '', 'secondary', 10, icons[i]));

    // Daily loops: wheel, challenges, premium. A dot marks what is waiting.
    const wheelReady = wheelAvailable(this.save, this.now);
    const claimable = this.claimableChallenges();
    this.button(this.dailyButtons[0]!, t('wheel'), wheelReady ? 'primary' : 'secondary', 11, 'wheel');
    this.button(this.dailyButtons[1]!, claimable > 0 ? `${t('challenges')} (${claimable})` : t('challenges'), claimable > 0 ? 'primary' : 'secondary', 11, 'flag');
    this.button(this.dailyButtons[2]!, t('billets'), starterAvailable(this.save, this.now) ? 'primary' : 'secondary', 11, 'ticket');
  }

  /** The player's character standing proud, feet at (x, y), `s` px per metre. */
  private drawHero(x: number, y: number, s: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, -s);
    ctx.translate(0, 1.3);
    drawCharacter(ctx, this.save.profile, CHARACTER_POSE.stand, this.now / 1000);
    ctx.restore();
  }

  private claimableChallenges(): number {
    const list = dailyChallenges(this.save.daily.challengeDay, this.save);
    let n = 0;
    list.forEach((c, i) => {
      if (!this.save.daily.challengeClaimed[i] && (this.save.daily.challengeProgress[i] ?? 0) >= c.target) n++;
    });
    return n;
  }

  private drawEndScreen(): void {
    const ctx = this.ctx;
    const run = this.run;
    const W = this.width;
    const H = this.height;
    ctx.fillStyle = THEME.shade;
    ctx.fillRect(0, 0, W, H);

    // Lines that make the run's extras visible: bonus, gain since a purchase, near miss, challenge.
    const extras: [string, string][] = [];
    if (this.endBonus) extras.push([`${t(`bonus_${this.endBonus.kind}` as TextKey)} ${rewardText(this.endBonus.reward)}`, THEME.accent]);
    if (this.boostGain > 0) extras.push([fill(t('boostGain'), { metres: formatDistance(this.boostGain) }), '#7ddc7a']);
    if (this.endNearMiss) extras.push([fill(t('nearMiss'), { metres: formatDistance(this.endNearMiss.metres), stage: stageName(this.endNearMiss.stageId) }), THEME.uiText]);
    if (this.endChallenges > 0) extras.push([t('challengeDone'), '#7ddc7a']);
    if (this.starterJustOffered) extras.push([t('starterOffer'), THEME.accent]);
    const shown = extras.slice(0, 2);

    const panelW = Math.min(W - 32, 380);
    const panelX = (W - panelW) / 2;
    const panelY = H * 0.13;
    ctx.fillStyle = THEME.ui;
    roundRect(ctx, panelX, panelY, panelW, 396 + shown.length * 20, 20);
    ctx.fill();

    const gender = this.save.profile.gender;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = font('text', 16);
    const cause =
      run.endReason === 'fatal' && run.fatalKind ? fatalText(run.fatalKind, gender) : run.endReason === 'wall' ? t('endWall') : t('endTitle');
    ctx.fillStyle = run.endReason === 'fatal' || run.endReason === 'wall' ? THEME.danger : THEME.uiTextSoft;
    ctx.fillText(cause, W / 2, panelY + 18, panelW - 24);
    ctx.fillStyle = THEME.accent;
    ctx.font = font('display', 50);
    ctx.fillText(formatDistance(run.distance), W / 2, panelY + 42);
    const trophy = this.newTrophies[0];
    if (this.newRecord || this.newAltitudeRecord || this.levelsGained > 0 || trophy) {
      ctx.fillStyle = THEME.uiText;
      ctx.font = font('display', 16);
      const line = trophy
        ? `${t('trophyUnlocked')} ${trophyName(trophy.id)} +${trophy.reward} ●${this.newTrophies.length > 1 ? ` (+${this.newTrophies.length - 1})` : ''}`
        : this.levelsGained > 0
          ? `${t('levelUp')} ${t('level')} ${this.save.level}`
          : this.newRecord
            ? tg('endRecord', gender)
            : t('endAltitudeRecord');
      ctx.fillText(line, W / 2, panelY + 102, panelW - 24);
    }
    shown.forEach(([text, colour], i) => {
      ctx.fillStyle = colour;
      ctx.font = font('display', 13);
      ctx.fillText(text, W / 2, panelY + 124 + i * 20, panelW - 24);
    });

    ctx.font = font('text', 15);
    const farthest = STAGES[run.maxStageIndex] ?? STAGES[0]!;
    const highest = LAYERS[run.maxLayerIndex] ?? LAYERS[0]!;
    const multiplier = coinMultiplier(this.save, this.now);
    const rows: [string, string][] = [
      [t('endStage'), stageName(farthest.id)],
      [t('endAltitude'), formatAltitude(run.maxAltitude)],
      [t('endLayer'), layerName(highest.id)],
      [t('endSpeed'), `${formatSpeedKmh(run.maxSpeed)} ${t('speedUnit')}`],
      [t('coinsRun'), `+${(run.coins + run.distanceCoins) * multiplier} ●${multiplier > 1 ? ` (×${multiplier})` : ''}`],
      [t('xp'), `+${this.runXp}`],
      [t('best'), `${formatDistance(this.save.bestDistance)} · ${formatAltitude(this.save.bestAltitude)}`],
    ];
    let y = panelY + 130 + shown.length * 20;
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = font('text', 12);
    ctx.fillStyle = THEME.uiTextSoft;
    ctx.fillText(this.playerLabel(), W / 2, y + 48);

    this.button(this.replayButton, t('replay'), 'primary', 28);
    this.button(this.shareButton, this.sharedTime > 0 ? t('shared') : t('share'), 'secondary', 13);
    this.button(this.endShopButton, t('shop'), 'secondary', 13);
    this.button(this.endHomeButton, t('home'), 'secondary', 13);
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

  // ---- scrolling list screens ------------------------------------------------

  private listTitle(): string {
    const keys: Partial<Record<Screen, TextKey>> = {
      customize: 'customize',
      trophies: 'trophies',
      profiles: 'profiles',
      settings: 'settings',
      premium: 'premiumTitle',
      challenges: 'challengesTitle',
    };
    return t(keys[this.screen] ?? 'settings');
  }

  private drawList(): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    if (this.relayout) {
      this.items = this.layoutList();
      this.contentHeight = this.items.reduce((m, it) => Math.max(m, it.b.y + it.b.h), 0) + 16;
      this.scrollY = this.clampScroll(this.scrollY);
      this.relayout = false;
    }
    ctx.fillStyle = THEME.ui;
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = font('display', 26);
    ctx.fillStyle = THEME.uiText;
    const panelW = Math.min(W - 24, 420);
    const panelX = (W - panelW) / 2;
    ctx.fillText(this.listTitle(), panelX + 12, 18 + this.insets.top);
    if (this.screen === 'trophies') {
      ctx.textAlign = 'right';
      ctx.font = font('display', 16);
      ctx.fillStyle = THEME.accent;
      ctx.fillText(`${this.save.trophies.length}/${TROPHIES.length} ${t('trophiesCount')}`, panelX + panelW - 12, 26 + this.insets.top);
    }
    if (this.screen === 'premium' || this.screen === 'challenges') {
      ctx.textAlign = 'right';
      ctx.font = font('display', 16);
      ctx.fillStyle = THEME.accent;
      ctx.fillText(`${this.save.coins} ●  ${this.save.premium.billets} 🎟`, panelX + panelW - 12, 26 + this.insets.top);
    }

    const top = this.contentTop();
    const bottom = this.backButton.y - 12;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, W, bottom - top);
    ctx.clip();
    ctx.translate(0, top - this.scrollY);
    for (const item of this.items) {
      const sy = item.b.y - this.scrollY + top;
      if (sy + item.b.h < top - 4 || sy > bottom + 4) continue;
      item.draw(item.b);
    }
    ctx.restore();
    this.button(this.backButton, t('back'), 'secondary', 18);

    // Native controls follow their rows; hidden off the other screens and outside the viewport.
    if (this.overlay) {
      const show = this.screen === 'customize';
      const row = (b: Button): Button => ({ x: b.x, y: b.y + top - this.scrollY, w: b.w, h: b.h });
      const input = row(this.nameBox);
      const select = row(this.countryBox);
      const visible = (r: Button): boolean => r.y >= top - 2 && r.y + r.h <= bottom + 2;
      this.overlay.place(show, input, select);
      if (show) {
        this.overlay.input.style.display = visible(input) ? 'block' : 'none';
        this.overlay.select.style.display = visible(select) ? 'block' : 'none';
      }
    }
  }

  private nameBox: Button = btn();
  private countryBox: Button = btn();

  private layoutList(): Item[] {
    switch (this.screen) {
      case 'customize':
        return this.layoutCustomize();
      case 'trophies':
        return this.layoutTrophies();
      case 'profiles':
        return this.layoutProfiles();
      case 'settings':
        return this.layoutSettings();
      case 'premium':
        return this.layoutPremium();
      case 'challenges':
        return this.layoutChallenges();
      default:
        return [];
    }
  }

  private layoutCustomize(): Item[] {
    const W = this.width;
    const panelW = Math.min(W - 24, 420);
    const x0 = (W - panelW) / 2 + 12;
    const cw = panelW - 24;
    const items: Item[] = [];
    const p = this.save.profile;
    let y = 0;

    // Live preview: on all fours, boot ready.
    items.push({
      b: { x: x0, y, w: cw, h: 170 },
      draw: (b) => {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        roundRect(ctx, b.x, b.y, b.w, b.h, 16);
        ctx.fill();
        const s = 40;
        ctx.save();
        ctx.translate(b.x + b.w / 2 + 30, b.y + b.h - 40);
        ctx.scale(s, -s);
        ctx.translate(0, BALANCE.player.height / 2 + 0.5);
        drawCharacter(ctx, p, CHARACTER_POSE.fours);
        ctx.translate(BALANCE.player.bootOffsetX - 0.7, BALANCE.player.bootOffsetY - 0.5);
        ctx.rotate(0.45);
        ASSETS.boot.draw(ctx, 0);
        ctx.restore();
        ctx.fillStyle = THEME.uiText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = font('display', 15);
        ctx.fillText(this.playerLabel(), b.x + b.w / 2, b.y + 10);
        const country = countryName(p.nationality);
        if (country) {
          ctx.font = font('text', 12);
          ctx.fillStyle = THEME.uiTextSoft;
          ctx.fillText(country, b.x + b.w / 2, b.y + 30);
        }
      },
    });
    y += 182;

    // Name: native field.
    items.push({ b: { x: x0, y, w: cw, h: 24 }, draw: (b) => this.sectionLabel(b, t('name')) });
    this.nameBox = { x: x0, y: y + 26, w: cw, h: 42 };
    y += 76;

    // Gender.
    items.push({ b: { x: x0, y, w: cw, h: 24 }, draw: (b) => this.sectionLabel(b, t('gender')) });
    const gw = (cw - 12) / 3;
    GENDERS.forEach((g, i) => {
      items.push({
        b: { x: x0 + i * (gw + 6), y: y + 26, w: gw, h: 36 },
        draw: (b) => this.chip(b, t(`gender_${g}` as TextKey), p.gender === g),
        tap: () => {
          p.gender = g;
          this.persist();
        },
      });
    });
    y += 70;

    // Hair.
    items.push({ b: { x: x0, y, w: cw, h: 24 }, draw: (b) => this.sectionLabel(b, t('hair')) });
    const hw = (cw - 18) / 4;
    HAIRSTYLES.forEach((h, i) => {
      items.push({
        b: { x: x0 + i * (hw + 6), y: y + 26, w: hw, h: 36 },
        draw: (b) => this.chip(b, t(`hair_${h}` as TextKey), p.hair === h),
        tap: () => {
          p.hair = h;
          this.persist();
        },
      });
    });
    y += 70;

    // Nationality: native select, display only.
    items.push({ b: { x: x0, y, w: cw, h: 24 }, draw: (b) => this.sectionLabel(b, t('nationality')) });
    this.countryBox = { x: x0, y: y + 26, w: cw, h: 42 };
    y += 76;

    // Outfit.
    items.push({ b: { x: x0, y, w: cw, h: 24 }, draw: (b) => this.sectionLabel(b, t('outfit')) });
    const ow = (cw - 18) / 4;
    OUTFIT_IDS.forEach((o, i) => {
      const col = i % 4;
      const rowI = Math.floor(i / 4);
      items.push({
        b: { x: x0 + col * (ow + 6), y: y + 26 + rowI * 42, w: ow, h: 36 },
        draw: (b) => this.chip(b, t(`outfit_${o}` as TextKey), p.outfit === o),
        tap: () => {
          p.outfit = o;
          this.persist();
        },
      });
    });
    y += 26 + 2 * 42 + 6;
    const choice = (OUTFITS[p.outfit] as { shoeChoice?: readonly ('basses' | 'bulle')[] }).shoeChoice;
    if (choice) {
      const sw = (cw - 6) / 2;
      choice.forEach((shoe, i) => {
        items.push({
          b: { x: x0 + i * (sw + 6), y, w: sw, h: 32 },
          draw: (b) => this.chip(b, t(`shoes_${shoe}` as TextKey), (p.shoes ?? choice[0]) === shoe, 12),
          tap: () => {
            p.shoes = shoe;
            this.persist();
          },
        });
      });
      y += 40;
    }

    // Colours: three closed palettes.
    const groups: [TextKey, number][] = [
      ['colourTop', 0],
      ['colourLegs', 1],
      ['colourShoes', 2],
    ];
    for (const [label, slot] of groups) {
      items.push({ b: { x: x0, y, w: cw, h: 24 }, draw: (b) => this.sectionLabel(b, t(label)) });
      const sz = Math.min(30, (cw - 11 * 4) / 12);
      FABRIC_COLOURS.forEach((c, i) => {
        items.push({
          b: { x: x0 + i * (sz + 4), y: y + 26, w: sz, h: sz },
          draw: (b) => {
            const ctx = this.ctx;
            ctx.fillStyle = c;
            roundRect(ctx, b.x, b.y, b.w, b.h, 6);
            ctx.fill();
            if (p.colours[slot] === i) {
              ctx.lineWidth = 3;
              ctx.strokeStyle = THEME.accent;
              ctx.stroke();
            }
          },
          tap: () => {
            p.colours[slot] = i;
            this.persist();
          },
        });
      });
      y += 26 + sz + 12;
    }
    return items;
  }

  private layoutTrophies(): Item[] {
    const W = this.width;
    const panelW = Math.min(W - 24, 420);
    const x0 = (W - panelW) / 2 + 12;
    const cw = panelW - 24;
    const items: Item[] = [];
    let y = 0;
    for (const def of TROPHIES) {
      const unlocked = this.save.trophies.includes(def.id);
      items.push({
        b: { x: x0, y, w: cw, h: 62 },
        draw: (b) => {
          const ctx = this.ctx;
          ctx.fillStyle = unlocked ? 'rgba(255,197,49,0.22)' : 'rgba(255,255,255,0.08)';
          roundRect(ctx, b.x, b.y, b.w, b.h, 12);
          ctx.fill();
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          ctx.font = font('display', 14);
          ctx.fillStyle = unlocked ? THEME.accent : THEME.uiText;
          ctx.fillText(`${unlocked ? '🏆 ' : ''}${trophyName(def.id)}`, b.x + 12, b.y + 16);
          const target = this.trophyTargetText(def);
          ctx.font = font('text', 11);
          ctx.fillStyle = THEME.uiTextSoft;
          ctx.fillText(`${trophyKindText(def.kind)} ${target}`, b.x + 12, b.y + 34, b.w - 110);
          ctx.textAlign = 'right';
          ctx.font = font('display', 13);
          ctx.fillStyle = unlocked ? THEME.accent : THEME.uiTextSoft;
          ctx.fillText(`+${def.reward} ●`, b.x + b.w - 12, b.y + 16);
          const p = trophyProgress(def, this.save);
          const ratio = unlocked ? 1 : Math.min(1, p.target > 0 ? p.value / p.target : 0);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          roundRect(ctx, b.x + 12, b.y + 48, b.w - 24, 6, 3);
          ctx.fill();
          ctx.fillStyle = unlocked ? THEME.accent : '#2a9d8f';
          roundRect(ctx, b.x + 12, b.y + 48, Math.max(6, (b.w - 24) * ratio), 6, 3);
          ctx.fill();
        },
      });
      y += 68;
    }
    return items;
  }

  private trophyTargetText(def: TrophyDef): string {
    switch (def.kind) {
      case 'stage':
        return stageName(def.stage);
      case 'layer':
        return layerName(def.layer);
      case 'shop':
        return '';
      default:
        return `${def.value}`;
    }
  }

  private layoutProfiles(): Item[] {
    const W = this.width;
    const panelW = Math.min(W - 24, 420);
    const x0 = (W - panelW) / 2 + 12;
    const cw = panelW - 24;
    const items: Item[] = [];
    const cards: [string, string, boolean][] = [
      [t('profileDepart'), t('profileDepartLine'), true],
      [t('profileEntrepreneur'), t('profileEntrepreneurLine'), false],
      [t('profileDictator'), t('soonLine'), false],
      [t('profileBoomer'), t('soonLine'), false],
      [t('profilePoliticien'), t('soonLine'), false],
      [t('profileFille'), t('profileFilleLine'), false],
    ];
    let y = 0;
    cards.forEach(([name, line, playable], i) => {
      const h = i === 1 ? 118 : 86;
      items.push({
        b: { x: x0, y, w: cw, h },
        draw: (b) => {
          const ctx = this.ctx;
          ctx.fillStyle = playable ? 'rgba(42,157,143,0.35)' : 'rgba(255,255,255,0.06)';
          roundRect(ctx, b.x, b.y, b.w, b.h, 14);
          ctx.fill();
          // Silhouette: the shared body, greyed when the profile is locked.
          ctx.save();
          ctx.translate(b.x + 44, b.y + b.h / 2 + 10);
          ctx.scale(14, -14);
          if (!playable) ctx.globalAlpha = 0.25;
          const look = i === 1 ? { ...this.save.profile, outfit: 'costume' as const } : this.save.profile;
          drawCharacter(ctx, look, CHARACTER_POSE.fours);
          ctx.restore();
          ctx.textBaseline = 'top';
          ctx.textAlign = 'left';
          ctx.font = font('display', 15);
          ctx.fillStyle = playable ? THEME.uiText : THEME.uiTextSoft;
          ctx.fillText(name, b.x + 96, b.y + 12, b.w - 176);
          ctx.font = font('text', 11);
          ctx.fillStyle = THEME.uiTextSoft;
          this.wrapText(line, b.x + 96, b.y + 34, b.w - 108, 15);
          ctx.textAlign = 'right';
          ctx.font = font('display', 12);
          ctx.fillStyle = playable ? THEME.accent : THEME.uiTextSoft;
          ctx.fillText(playable ? t('playable') : t('soon'), b.x + b.w - 12, b.y + 12);
        },
      });
      y += h + 8;
    });
    return items;
  }

  private layoutSettings(): Item[] {
    const W = this.width;
    const panelW = Math.min(W - 24, 420);
    const x0 = (W - panelW) / 2 + 12;
    const cw = panelW - 24;
    const items: Item[] = [];
    const s = this.save.settings;
    let y = 0;
    const toggle = (label: string, value: string, tap: () => void): void => {
      items.push({
        b: { x: x0, y, w: cw, h: 52 },
        draw: (b) => {
          const ctx = this.ctx;
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          roundRect(ctx, b.x, b.y, b.w, b.h, 12);
          ctx.fill();
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          ctx.font = font('display', 15);
          ctx.fillStyle = THEME.uiText;
          ctx.fillText(label, b.x + 14, b.y + b.h / 2);
          this.chip({ x: b.x + b.w - 110, y: b.y + 10, w: 98, h: 32 }, value, true);
        },
        tap,
      });
      y += 60;
    };
    toggle(t('sound'), s.sound ? t('on') : t('off'), () => {
      s.sound = !s.sound;
      this.sounds.enabled = s.sound;
      this.persist();
    });
    toggle(t('haptics'), s.haptics ? t('on') : t('off'), () => {
      s.haptics = !s.haptics;
      this.persist();
    });
    toggle(t('language'), t(`lang_${s.lang}` as TextKey), () => {
      s.lang = s.lang === 'fr' ? 'en' : 'fr';
      setLang(s.lang);
      this.persist();
    });

    y += 12;
    if (this.resetStep === 0) {
      items.push({
        b: { x: x0, y, w: cw, h: 48 },
        draw: (b) => this.button(b, t('reset'), 'secondary', 15),
        tap: () => {
          this.resetStep = 1;
        },
      });
    } else {
      const question = this.resetStep === 1 ? t('resetConfirm1') : t('resetConfirm2');
      items.push({
        b: { x: x0, y, w: cw, h: 60 },
        draw: (b) => {
          this.ctx.textBaseline = 'top';
          this.ctx.textAlign = 'left';
          this.ctx.font = font('text', 13);
          this.ctx.fillStyle = THEME.danger;
          this.wrapText(question, b.x + 4, b.y + 4, b.w - 8, 18);
        },
      });
      y += 66;
      const half = (cw - 6) / 2;
      if (this.resetStep === 1) {
        items.push({
          b: { x: x0, y, w: half, h: 44 },
          draw: (b) => this.button(b, t('resetYes'), 'primary', 14),
          tap: () => {
            this.resetStep = 2;
          },
        });
        items.push({
          b: { x: x0 + half + 6, y, w: half, h: 44 },
          draw: (b) => this.button(b, t('cancel'), 'secondary', 14),
          tap: () => {
            this.resetStep = 0;
          },
        });
      } else {
        items.push({
          b: { x: x0, y, w: half, h: 44 },
          draw: (b) => this.button(b, t('resetYes'), 'primary', 14),
          tap: () => this.resetProgress(false),
        });
        items.push({
          b: { x: x0 + half + 6, y, w: half, h: 44 },
          draw: (b) => this.button(b, t('resetKeep'), 'secondary', 12),
          tap: () => this.resetProgress(true),
        });
      }
    }
    return items;
  }

  // ---- premium shop -------------------------------------------------------------

  /** One row of the premium list: title, detail, price on the right. */
  private premiumRow(b: Button, title: string, detail: string, right: string, style: 'ready' | 'off' | 'done' | 'confirm'): void {
    const ctx = this.ctx;
    ctx.fillStyle =
      style === 'done' ? 'rgba(255,197,49,0.25)' : style === 'off' ? 'rgba(255,255,255,0.06)' : style === 'confirm' ? 'rgba(230,57,70,0.35)' : 'rgba(42,157,143,0.45)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = font('display', 14);
    ctx.fillStyle = style === 'off' ? THEME.uiTextSoft : THEME.uiText;
    ctx.fillText(title, b.x + 12, b.y + b.h * 0.33, b.w - 120);
    ctx.font = font('text', 11);
    ctx.fillStyle = THEME.uiTextSoft;
    ctx.fillText(detail, b.x + 12, b.y + b.h * 0.72, b.w - 120);
    ctx.textAlign = 'right';
    ctx.font = font('display', 14);
    ctx.fillStyle = style === 'done' ? THEME.accent : style === 'off' ? THEME.uiTextSoft : THEME.uiText;
    ctx.fillText(right, b.x + b.w - 12, b.y + b.h / 2);
  }

  private layoutPremium(): Item[] {
    const W = this.width;
    const panelW = Math.min(W - 24, 420);
    const x0 = (W - panelW) / 2 + 12;
    const cw = panelW - 24;
    const items: Item[] = [];
    const save = this.save;
    const now = this.now;
    const P = BALANCE.premium;
    let y = 0;

    // Notice line (payment result, cap) or the rule that protects the game.
    items.push({
      b: { x: x0, y, w: cw, h: 22 },
      draw: (b) => {
        const ctx = this.ctx;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.font = font('text', 12);
        const notice = this.premiumNoticeTime > 0 ? this.premiumNotice : paymentsAvailable(this.tg) ? t('noRandomPaid') : t('paymentSoon');
        ctx.fillStyle = this.premiumNoticeTime > 0 ? THEME.accent : THEME.uiTextSoft;
        ctx.fillText(notice, b.x + 2, b.y + b.h / 2, b.w - 4);
      },
    });
    y += 30;

    /** A Stars product row: first tap arms it, the second confirms. */
    const starsRow = (id: StarsProductId, title: string, detail: string, done: boolean, doneText: string): void => {
      const price = starsPrice(id);
      const confirming = this.confirmId === id;
      items.push({
        b: { x: x0, y, w: cw, h: 58 },
        draw: (b) => this.premiumRow(b, title, confirming ? t('noRandomPaid') : detail, done ? doneText : confirming ? fill(t('confirm'), { price }) : `${price} ★`, done ? 'done' : confirming ? 'confirm' : 'ready'),
        tap: () => {
          if (done) return;
          if (confirming) void this.purchase(id);
          else {
            this.confirmId = id;
            track('purchase_view', { product: id, stars: price });
          }
        },
      });
      y += 64;
    };

    // Pass.
    items.push({ b: { x: x0, y, w: cw, h: 24 }, draw: (b) => this.sectionLabel(b, t('pass')) });
    y += 26;
    const active = passActive(save, now);
    const until = new Date(save.premium.passUntil);
    starsRow(P.pass.id, `${t('pass')} · ${t('passDays')}`, t('passLine'), active, `${t('passActive')} ${until.getDate()}/${until.getMonth() + 1}`);

    // Starter pack, only while it is offered.
    if (starterAvailable(save, now)) {
      items.push({ b: { x: x0, y, w: cw, h: 24 }, draw: (b) => this.sectionLabel(b, t('starter')) });
      y += 26;
      const left = Math.max(0, save.premium.starterOfferedAt + P.starter.hours * 3_600_000 - now) / 1000;
      starsRow(
        P.starter.id,
        `${t('starter')} · ${fill(t('starterLeft'), { time: formatCooldown(left) })}`,
        fill(t('starterLine'), { billets: P.starter.billets, coins: P.starter.coinsBase + P.starter.coinsPerLevel * save.level }),
        false,
        '',
      );
    }

    // Billets in Stars.
    items.push({ b: { x: x0, y, w: cw, h: 24 }, draw: (b) => this.sectionLabel(b, t('billetPacks')) });
    y += 26;
    for (const pack of P.billetPacks) {
      starsRow(pack.id, fill(t('billetPack'), { billets: pack.billets }), pack.bonus > 0 ? fill(t('billetBonus'), { bonus: pack.bonus }) : '', false, '');
    }

    // Coins in billets.
    items.push({ b: { x: x0, y, w: cw, h: 24 }, draw: (b) => this.sectionLabel(b, t('coinPacks')) });
    y += 26;
    for (const pack of P.coinPacks) {
      const coins = coinPackAmount(pack, save.level);
      const ok = save.premium.billets >= pack.billets;
      items.push({
        b: { x: x0, y, w: cw, h: 52 },
        draw: (b) => this.premiumRow(b, fill(t('coinPack'), { coins }), '', `${pack.billets} 🎟`, ok ? 'ready' : 'off'),
        tap: () => {
          if (!buyCoinPack(save, pack)) {
            this.premiumMessage(t('notEnoughBillets'));
            return;
          }
          this.afterPurchase('coins', pack.id);
        },
      });
      y += 58;
    }

    // Time accelerator.
    items.push({ b: { x: x0, y, w: cw, h: 24 }, draw: (b) => this.sectionLabel(b, t('accelerator')) });
    y += 26;
    const next = nextTimeScaleUnlock(save, now);
    items.push({
      b: { x: x0, y, w: cw, h: 52 },
      draw: (b) => {
        if (!next) {
          this.premiumRow(b, `×${BALANCE.timeScale.steps[maxTimeScaleIndex(save, now)]}`, t('acceleratorAll'), t('maxed'), 'done');
          return;
        }
        const step = BALANCE.timeScale.steps[next.index] ?? 1;
        const ok = next.billets > 0 && save.premium.billets >= next.billets;
        this.premiumRow(b, fill(t('acceleratorNext'), { step, level: next.level }), next.billets > 0 ? fill(t('acceleratorBuy'), { billets: next.billets }) : '', next.billets > 0 ? `${next.billets} 🎟` : `${t('locked')} ${next.level}`, ok ? 'ready' : 'off');
      },
      tap: () => {
        if (!next || next.billets <= 0) return;
        if (!buyTimeScale(save, now)) {
          this.premiumMessage(t('notEnoughBillets'));
          return;
        }
        this.afterPurchase('timeScale', `x${BALANCE.timeScale.steps[next.index]}`);
      },
    });
    y += 58;

    // Gadgets: one row each, two prices.
    items.push({ b: { x: x0, y, w: cw, h: 24 }, draw: (b) => this.sectionLabel(b, t('gadgets')) });
    y += 26;
    for (const g of P.gadgets) {
      const held = save.premium.gadgets[g.id];
      const rowY = y;
      items.push({
        b: { x: x0, y: rowY, w: cw, h: 64 },
        draw: (b) => {
          const ctx = this.ctx;
          ctx.fillStyle = held > 0 ? 'rgba(255,197,49,0.18)' : 'rgba(255,255,255,0.08)';
          roundRect(ctx, b.x, b.y, b.w, b.h, 12);
          ctx.fill();
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          ctx.font = font('display', 14);
          ctx.fillStyle = THEME.uiText;
          ctx.fillText(`${t(`gadget_${g.id}` as TextKey)}${held > 0 ? ` · ${held} ${t('held')}` : ''}`, b.x + 12, b.y + 16, b.w - 24);
          ctx.font = font('text', 11);
          ctx.fillStyle = THEME.uiTextSoft;
          ctx.fillText(t(`gfx_${g.id}` as TextKey), b.x + 12, b.y + 34, b.w - 24);
        },
      });
      const chipW = 84;
      const chip = (dx: number, label: string, ok: boolean, currency: 'coins' | 'billets'): void => {
        items.push({
          b: { x: x0 + cw - dx, y: rowY + 44, w: chipW, h: 18 },
          draw: (b) => this.chip({ x: b.x, y: b.y - 2, w: b.w, h: 22 }, label, ok, 11),
          tap: () => {
            const id = g.id as GadgetId;
            if (!buyGadget(save, id, currency)) {
              this.premiumMessage(currency === 'coins' ? t('notEnoughCoins') : t('notEnoughBillets'));
              return;
            }
            this.afterPurchase('gadget', id);
          },
        });
      };
      chip(chipW * 2 + 8, `${g.coins} ●`, save.coins >= g.coins && held < P.gadgetMax, 'coins');
      chip(chipW, `${g.billets} 🎟`, save.premium.billets >= g.billets && held < P.gadgetMax, 'billets');
      y += 70;
    }
    return items;
  }

  /** Bookkeeping shared by every purchase: equipment, boost window, trophies, feedback. */
  private afterPurchase(kind: string, id: string): void {
    if (kind !== 'coins') startBoostWindow(this.save);
    this.applyEquipment();
    this.syncAimedRun();
    awardTrophies(this.save);
    this.sounds.play('buy');
    this.buzz('buy');
    this.confirmId = null;
    this.relayout = true;
    track('purchase', { kind, product: id, level: this.save.level });
    this.persist();
  }

  /** Stars purchase: cap check, invoice through the server, grant on "paid". */
  private async purchase(id: StarsProductId): Promise<void> {
    if (this.buying) return;
    const price = starsPrice(id);
    if (price > starsLeftToday(this.save, this.now)) {
      this.premiumMessage(fill(t('dailyCap'), { cap: BALANCE.premium.dailyStarsCap }));
      this.confirmId = null;
      this.relayout = true;
      return;
    }
    if (!paymentsAvailable(this.tg)) {
      this.premiumMessage(t('paymentSoon'));
      this.confirmId = null;
      this.relayout = true;
      track('purchase_unavailable', { product: id, stars: price });
      return;
    }
    this.buying = true;
    const result = await requestPurchase(this.tg, id);
    this.buying = false;
    if (result === 'paid') {
      // The server is the ledger: credit what it confirms, which includes this payment.
      const granted = await this.claimPending();
      if (granted === 0) {
        // The webhook can lag a moment behind the "paid" status: credit this one anyway.
        grantStarsProduct(this.save, id, Date.now());
      }
      this.premiumMessage(t('paymentDone'));
      this.afterPurchase('stars', id);
      return;
    }
    this.premiumMessage(result === 'cancelled' ? t('paymentCancelled') : t('paymentFailed'));
    this.confirmId = null;
    this.relayout = true;
    track('purchase_abandoned', { product: id, result });
  }

  // ---- challenges and streak ----------------------------------------------------------

  private challengeText(kind: string, target: number): string {
    const value = kind === 'distance' ? formatDistance(target) : kind === 'altitude' ? formatAltitude(target) : String(target);
    return fill(t(`ch_${kind}` as TextKey), { target: value });
  }

  private layoutChallenges(): Item[] {
    const W = this.width;
    const panelW = Math.min(W - 24, 420);
    const x0 = (W - panelW) / 2 + 12;
    const cw = panelW - 24;
    const items: Item[] = [];
    const save = this.save;
    let y = 0;

    // Streak: seven chips, today's lit.
    items.push({ b: { x: x0, y, w: cw, h: 24 }, draw: (b) => this.sectionLabel(b, `${t('streak')} · ${fill(t('streakDay'), { day: save.daily.streakDay })}`) });
    y += 28;
    const days = BALANCE.streak.coinsBase.length;
    const sw = (cw - (days - 1) * 4) / days;
    for (let i = 0; i < days; i++) {
      items.push({
        b: { x: x0 + i * (sw + 4), y, w: sw, h: 44 },
        draw: (b) => {
          const ctx = this.ctx;
          const lit = i < save.daily.streakDay;
          ctx.fillStyle = lit ? THEME.accent : 'rgba(255,255,255,0.1)';
          roundRect(ctx, b.x, b.y, b.w, b.h, 8);
          ctx.fill();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = font('display', 11);
          ctx.fillStyle = lit ? THEME.ui : THEME.uiText;
          ctx.fillText(`J${i + 1}`, b.x + b.w / 2, b.y + 12);
          ctx.font = font('text', 9);
          const r = { coins: BALANCE.streak.coinsBase[i] ?? 0, billets: BALANCE.streak.billets[i] ?? 0 };
          ctx.fillText(r.billets > 0 ? `${r.billets} 🎟` : `${r.coins} ●`, b.x + b.w / 2, b.y + 30, b.w - 2);
        },
      });
    }
    y += 60;

    // Today's challenges.
    items.push({ b: { x: x0, y, w: cw, h: 24 }, draw: (b) => this.sectionLabel(b, t('challengesTitle')) });
    y += 28;
    const list = dailyChallenges(save.daily.challengeDay, save);
    list.forEach((c, i) => {
      const progress = save.daily.challengeProgress[i] ?? 0;
      const done = progress >= c.target;
      const claimed = save.daily.challengeClaimed[i] === true;
      items.push({
        b: { x: x0, y, w: cw, h: 66 },
        draw: (b) => {
          const ctx = this.ctx;
          ctx.fillStyle = claimed ? 'rgba(255,197,49,0.18)' : done ? 'rgba(42,157,143,0.45)' : 'rgba(255,255,255,0.08)';
          roundRect(ctx, b.x, b.y, b.w, b.h, 12);
          ctx.fill();
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          ctx.font = font('display', 13);
          ctx.fillStyle = THEME.uiText;
          ctx.fillText(this.challengeText(c.kind, c.target), b.x + 12, b.y + 16, b.w - 120);
          ctx.textAlign = 'right';
          ctx.fillStyle = THEME.accent;
          ctx.fillText(claimed ? t('claimed') : done ? t('claim') : rewardText(c.reward), b.x + b.w - 12, b.y + 16);
          const ratio = Math.min(1, c.target > 0 ? progress / c.target : 0);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          roundRect(ctx, b.x + 12, b.y + 36, b.w - 24, 8, 4);
          ctx.fill();
          ctx.fillStyle = done ? THEME.accent : '#2a9d8f';
          roundRect(ctx, b.x + 12, b.y + 36, Math.max(8, (b.w - 24) * ratio), 8, 4);
          ctx.fill();
          ctx.textAlign = 'left';
          ctx.font = font('text', 10);
          ctx.fillStyle = THEME.uiTextSoft;
          const fmt = (v: number): string => (c.kind === 'distance' ? formatDistance(v) : c.kind === 'altitude' ? formatAltitude(v) : String(v));
          ctx.fillText(`${fmt(Math.min(progress, c.target))} / ${fmt(c.target)}`, b.x + 12, b.y + 54, b.w - 24);
        },
        tap: () => {
          const reward = claimChallenge(save, i);
          if (!reward) return;
          awardTrophies(save);
          this.sounds.play('trophy');
          this.buzz('buy');
          track('challenge_claim', { kind: c.kind, coins: reward.coins, billets: reward.billets });
          this.persist();
        },
      });
      y += 72;
    });
    return items;
  }

  // ---- daily wheel -----------------------------------------------------------------------

  private openWheel(): void {
    this.screen = 'wheel';
    this.wheelSpinning = false;
    this.wheelResult = -1;
    this.wheelPrize = null;
    this.confetti.clear();
    track('wheel_open', { available: wheelAvailable(this.save, this.now) });
  }

  private spin(): void {
    if (this.wheelSpinning) return;
    const result = spinWheel(this.save, this.now, new Rng(newSeed()));
    if (!result) return;
    const n = BALANCE.wheel.segments.length;
    const seg = (Math.PI * 2) / n;
    // The pointer sits at the top; the wheel turns until the chosen segment's centre is under it.
    const target = -(result.index + 0.5) * seg;
    const current = this.wheelAngle % (Math.PI * 2);
    this.wheelFrom = current;
    this.wheelTo = current + BALANCE.wheel.turns * Math.PI * 2 + ((target - current) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    this.wheelTime = 0;
    this.wheelSpinning = true;
    this.wheelResult = result.index;
    this.wheelPrize = result.reward;
    this.wheelTick = 0;
    track('wheel_spin', { segment: result.index, coins: result.reward.coins, billets: result.reward.billets });
    this.persist();
  }

  private updateWheel(dt: number): void {
    this.confetti.update(dt);
    if (!this.wheelSpinning) return;
    const T = BALANCE.wheel.spinSeconds;
    this.wheelTime = Math.min(T, this.wheelTime + dt);
    const k = this.wheelTime / T;
    const eased = 1 - Math.pow(1 - k, 3);
    this.wheelAngle = this.wheelFrom + (this.wheelTo - this.wheelFrom) * eased;
    // A tick each time a segment edge passes the pointer.
    const n = BALANCE.wheel.segments.length;
    const tick = Math.floor((this.wheelAngle / (Math.PI * 2)) * n);
    if (tick !== this.wheelTick) {
      this.wheelTick = tick;
      this.sounds.play('tap');
    }
    if (this.wheelTime >= T) {
      this.wheelSpinning = false;
      const jackpot = this.wheelResult >= BALANCE.wheel.jackpotFrom;
      this.sounds.play(jackpot ? 'record' : 'trophy');
      this.buzz(jackpot ? 'record' : 'buy');
      awardTrophies(this.save);
      this.persist();
      const cx = this.width / 2;
      const cy = this.wheelCentreY();
      const bursts = jackpot ? 6 : 2;
      for (let i = 0; i < bursts; i++) this.confetti.burst((cx + (i - bursts / 2) * 30) / 10, -cy / 10, 12, i * 3);
    }
  }

  private wheelCentreY(): number {
    return this.insets.top + 90 + Math.min(this.width * 0.42, (this.spinButton.y - this.insets.top - 120) / 2);
  }

  private drawWheel(): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    ctx.fillStyle = THEME.ui;
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = font('display', 26);
    ctx.fillStyle = THEME.uiText;
    const panelW = Math.min(W - 24, 420);
    const panelX = (W - panelW) / 2;
    ctx.fillText(t('wheelTitle'), panelX + 12, 18 + this.insets.top);
    ctx.textAlign = 'right';
    ctx.font = font('display', 16);
    ctx.fillStyle = THEME.accent;
    ctx.fillText(`${this.save.coins} ●  ${this.save.premium.billets} 🎟`, panelX + panelW - 12, 26 + this.insets.top);

    const segments = BALANCE.wheel.segments;
    const n = segments.length;
    const seg = (Math.PI * 2) / n;
    const cx = W / 2;
    const cy = this.wheelCentreY();
    const r = Math.min(W * 0.42, (this.spinButton.y - this.insets.top - 120) / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.wheelAngle - Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const s = segments[i]!;
      const jackpot = i >= BALANCE.wheel.jackpotFrom;
      ctx.fillStyle = jackpot ? THEME.accent : s.billets > 0 ? '#2a9d8f' : i % 2 === 0 ? '#2b2f45' : '#3a3f5c';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, i * seg, (i + 1) * seg);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = THEME.ui;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.save();
      ctx.rotate((i + 0.5) * seg);
      ctx.translate(r * 0.62, 0);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = font('display', jackpot ? 13 : 12);
      ctx.fillStyle = jackpot ? THEME.ui : THEME.uiText;
      const reward = wheelReward(s, this.save.level);
      ctx.fillText(reward.billets > 0 ? `${reward.billets} 🎟` : `${reward.coins} ●`, 0, 0);
      ctx.restore();
    }
    ctx.restore();
    // hub and pointer
    ctx.fillStyle = THEME.ui;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = THEME.accent;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - r - 14);
    ctx.lineTo(cx + 14, cy - r - 14);
    ctx.lineTo(cx, cy - r + 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = THEME.outline;
    ctx.lineWidth = 3;
    ctx.stroke();

    this.confetti.draw(ctx, 0, 0, 10);

    // Result.
    if (!this.wheelSpinning && this.wheelPrize) {
      const jackpot = this.wheelResult >= BALANCE.wheel.jackpotFrom;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = font('display', jackpot ? 30 : 22);
      ctx.fillStyle = THEME.accent;
      ctx.fillText(jackpot ? t('jackpot') : t('youWin'), cx, cy + r + 44);
      ctx.font = font('display', 22);
      ctx.fillStyle = THEME.uiText;
      ctx.fillText(rewardText(this.wheelPrize), cx, cy + r + 76);
    }
    const ready = wheelAvailable(this.save, this.now) && !this.wheelSpinning;
    this.button(this.spinButton, this.wheelSpinning ? t('spinning') : ready ? t('spin') : t('spinTomorrow'), ready ? 'primary' : 'disabled', 22);
    this.button(this.backButton, t('back'), this.wheelSpinning ? 'disabled' : 'secondary', 18);
  }

  private wrapText(text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    const ctx = this.ctx;
    const words = text.split(' ');
    let line = '';
    let ly = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, ly);
        line = word;
        ly += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, ly);
  }
}
