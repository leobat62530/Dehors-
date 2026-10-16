import { BALANCE } from '../config/balance';

/**
 * The tuning lab: a panel of sliders over the game that writes straight into BALANCE, so a
 * change is felt on the very next frame. Overrides persist in localStorage and can be copied
 * as JSON to be pasted back into `balance.ts`. Hidden until unlocked (seven taps on the title).
 */
export interface LabParam {
  /** Dotted path in BALANCE, e.g. `physics.gravity`. */
  path: string;
  label: string;
  min: number;
  max: number;
  step: number;
}

export interface LabGroup {
  title: string;
  params: LabParam[];
}

const P = (path: string, label: string, min: number, max: number, step: number): LabParam => ({ path, label, min, max, step });

export const LAB_GROUPS: readonly LabGroup[] = [
  {
    title: 'Coup de pied',
    params: [
      P('kick.minSpeed', 'Vitesse mini (m/s)', 5, 80, 1),
      P('kick.maxSpeed', 'Vitesse maxi (m/s)', 30, 250, 1),
      P('kick.speedPerLevel', 'Gain par niveau de force', 1, 1.5, 0.01),
      P('kick.minAngle', 'Angle mini (°)', 0, 60, 1),
      P('kick.maxAngle', 'Angle maxi (°)', 30, 89, 1),
    ],
  },
  {
    title: 'Physique',
    params: [
      P('physics.gravity', 'Gravité (m/s²)', 3, 50, 0.5),
      P('physics.dragK', 'Frottement de l’air', 0, 0.004, 0.0001),
      P('physics.restitution', 'Rebond (part de la vitesse gardée)', 0, 0.95, 0.01),
      P('physics.bounceFriction', 'Vitesse gardée à chaque rebond', 0.3, 1, 0.01),
      P('physics.rollThreshold', 'Vitesse d’impact qui déclenche la glissade', 0, 20, 0.5),
      P('physics.rollFrictionPerSecond', 'Vitesse gardée par seconde de glissade', 0.5, 1, 0.01),
      P('physics.rollResistance', 'Freinage constant en glissade (m/s²)', 0, 20, 0.5),
      P('physics.fallTerminalSpeed', 'Vitesse de chute maxi dans l’air (m/s)', 10, 300, 1),
      P('physics.glideRatio', 'Plané en chute (part poussée vers l’avant)', 0, 0.6, 0.01),
      P('end.minSpeed', 'Vitesse en dessous de laquelle la course s’arrête', 0, 10, 0.1),
    ],
  },
  {
    title: 'Bonus et malus',
    params: [
      P('spawn.densityScale.bouncers', 'Densité des rebondisseurs (×)', 0, 5, 0.1),
      P('spawn.densityScale.boosters', 'Densité des bonus (×)', 0, 5, 0.1),
      P('spawn.densityScale.obstacles', 'Densité des malus (×)', 0, 5, 0.1),
      P('spawn.minGap', 'Distance mini entre bonus et malus (m)', 0, 60, 1),
      P('economy.clustersPer100m', 'Grappes de pièces par 100 m', 0, 6, 0.1),
      P('spawn.airSpreadBase', 'Bande autour de la trajectoire (m)', 2, 200, 1),
      P('spawn.airSpreadFactor', 'Bande : part de l’altitude', 0, 0.6, 0.01),
      P('spawn.trampolinePerChunk', 'Trampolines par 100 m', 0, 1, 0.02),
      P('spawn.sizes.scale', 'Taille de tout ce qui vole (×)', 0.4, 3, 0.05),
      P('bouncers.pigeon.gain', 'Pigeon : poussée (m/s)', 0, 80, 1),
      P('bouncers.ballon.gain', 'Ballon : poussée (m/s)', 0, 80, 1),
      P('bouncers.mouette.gain', 'Mouette : poussée (m/s)', 0, 80, 1),
      P('bouncers.drone.gain', 'Drone : poussée (m/s)', 0, 80, 1),
      P('bouncers.montgolfiere.gain', 'Montgolfière : poussée (m/s)', 0, 120, 1),
      P('bouncers.trampoline.gain', 'Trampoline : poussée (m/s)', 0, 120, 1),
    ],
  },
  {
    title: 'Caméra et rendu',
    params: [
      P('render.pixelsPerMetre', 'Pixels par mètre (zoom 1)', 4, 40, 0.5),
      P('render.zoomSpeedReference', 'Vitesse à laquelle le zoom est divisé par 2', 20, 500, 5),
      P('render.minZoom', 'Zoom minimum', 0.1, 1, 0.01),
      P('render.minCharacterPx', 'Taille mini du perso à l’écran (px)', 12, 120, 1),
      P('render.playerScreenY', 'Hauteur du perso à l’écran (part)', 0.3, 0.9, 0.01),
      P('render.cameraDamping', 'Réactivité de la caméra', 1, 20, 0.5),
    ],
  },
  {
    title: 'Murs et casque',
    params: [
      P('walls.speedKept', 'Vitesse gardée en cassant un mur', 0.2, 1, 0.01),
      P('walls.thickness', 'Épaisseur des murs (m)', 1, 10, 0.5),
    ],
  },
  {
    title: 'Fusée et flammes',
    params: [
      P('upgradeEffects.rocketThrust', 'Poussée de la fusée (m/s²)', 5, 150, 1),
      P('upgradeEffects.rocketFuelPerCharge', 'Carburant par charge (s)', 0.2, 6, 0.1),
      P('upgradeEffects.rocketMinAngle', 'Angle mini de la poussée (°)', 0, 60, 1),
      P('fx.flameSpeed', 'Flammes à partir de (m/s)', 20, 400, 5),
      P('fx.flameHotSpeed', 'Flammes bleues à partir de (m/s)', 50, 800, 5),
    ],
  },
];

const STORAGE_KEY = 'dehors.lab';

type Mutable = Record<string, unknown>;

function resolve(path: string): { obj: Mutable; key: string } | null {
  const parts = path.split('.');
  let obj: unknown = BALANCE;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof obj !== 'object' || obj === null) return null;
    obj = (obj as Mutable)[parts[i] as string];
  }
  if (typeof obj !== 'object' || obj === null) return null;
  return { obj: obj as Mutable, key: parts[parts.length - 1] as string };
}

export function readParam(path: string): number {
  const r = resolve(path);
  const v = r ? r.obj[r.key] : undefined;
  return typeof v === 'number' ? v : NaN;
}

export function writeParam(path: string, value: number): void {
  const r = resolve(path);
  if (r && typeof r.obj[r.key] === 'number') r.obj[r.key] = value;
}

/** The shipped values, captured before any override is applied. */
const DEFAULTS: Record<string, number> = {};
for (const g of LAB_GROUPS) for (const p of g.params) DEFAULTS[p.path] = readParam(p.path);

export function labDefault(path: string): number {
  return DEFAULTS[path] ?? NaN;
}

/** Overrides that differ from the shipped values. */
export function labOverrides(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of LAB_GROUPS) {
    for (const p of g.params) {
      const v = readParam(p.path);
      if (Math.abs(v - (DEFAULTS[p.path] ?? v)) > 1e-9) out[p.path] = v;
    }
  }
  return out;
}

export function saveLab(): void {
  try {
    const o = labOverrides();
    if (Object.keys(o).length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
  } catch {
    /* storage unavailable */
  }
}

/** Applies saved overrides; returns how many were applied. */
export function loadLab(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const o = JSON.parse(raw) as Record<string, unknown>;
    let n = 0;
    for (const path in o) {
      const v = o[path];
      if (typeof v === 'number' && Number.isFinite(v) && path in DEFAULTS) {
        writeParam(path, v);
        n++;
      }
    }
    return n;
  } catch {
    return 0;
  }
}

export function resetLab(): void {
  for (const path in DEFAULTS) writeParam(path, DEFAULTS[path] as number);
  saveLab();
}

export interface LabPanel {
  open(): void;
  close(): void;
  readonly visible: boolean;
}

export interface LabCallbacks {
  /** A value changed. */
  onChange(): void;
  /** The "Rejouer" button: restart the run with the current values. */
  onReplay(): void;
}

const CSS =
  'position:absolute;inset:0;overflow:auto;z-index:10;display:none;background:rgba(14,16,28,0.94);color:#fff;' +
  'font:500 14px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:12px 14px 40px;box-sizing:border-box;-webkit-overflow-scrolling:touch;';

function fmt(v: number, step: number): string {
  const d = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  return v.toFixed(d);
}

export function createLab(host: HTMLElement, cb: LabCallbacks): LabPanel {
  const root = document.createElement('div');
  root.style.cssText = CSS;
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;';
  const title = document.createElement('div');
  title.textContent = 'Labo de réglages';
  title.style.cssText = 'font:900 22px "Arial Black",Impact,sans-serif;color:#ffc531;';
  const closeBtn = mkButton('Fermer', '#ffc531', '#1b1d2a');
  header.appendChild(title);
  header.appendChild(closeBtn);
  root.appendChild(header);

  const hint = document.createElement('div');
  hint.textContent = 'Chaque curseur agit tout de suite, même en plein vol. Les réglages restent sur ce téléphone jusqu’à « Tout remettre ».';
  hint.style.cssText = 'opacity:0.75;font-size:12px;margin-bottom:12px;line-height:1.35;';
  root.appendChild(hint);

  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;';
  const replayBtn = mkButton('Rejouer avec ces réglages', '#ffc531', '#1b1d2a');
  const copyBtn = mkButton('Copier les réglages', '#2a9d8f', '#fff');
  const resetBtn = mkButton('Tout remettre', '#3b3f4a', '#fff');
  bar.appendChild(replayBtn);
  bar.appendChild(copyBtn);
  bar.appendChild(resetBtn);
  root.appendChild(bar);

  const exportBox = document.createElement('textarea');
  exportBox.readOnly = true;
  exportBox.style.cssText = 'display:none;width:100%;height:110px;box-sizing:border-box;margin-bottom:12px;background:#0f1018;color:#9fd0ff;border:1px solid #3b3f4a;border-radius:8px;font:12px monospace;padding:8px;';
  root.appendChild(exportBox);

  const sliders: { p: LabParam; input: HTMLInputElement; value: HTMLSpanElement }[] = [];

  for (const g of LAB_GROUPS) {
    const h = document.createElement('div');
    h.textContent = g.title;
    h.style.cssText = 'font:900 15px "Arial Black",Impact,sans-serif;margin:14px 0 6px;color:#9fd0ff;';
    root.appendChild(h);
    for (const p of g.params) {
      const row = document.createElement('div');
      row.style.cssText = 'margin:0 0 10px;';
      const top = document.createElement('div');
      top.style.cssText = 'display:flex;justify-content:space-between;font-size:13px;margin-bottom:2px;';
      const label = document.createElement('span');
      label.textContent = p.label;
      const value = document.createElement('span');
      value.style.cssText = 'color:#ffc531;font-weight:700;font-variant-numeric:tabular-nums;';
      top.appendChild(label);
      top.appendChild(value);
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(p.min);
      input.max = String(p.max);
      input.step = String(p.step);
      input.style.cssText = 'width:100%;accent-color:#ffc531;';
      input.addEventListener('input', () => {
        const v = Number(input.value);
        writeParam(p.path, v);
        value.textContent = fmt(v, p.step) + (Math.abs(v - labDefault(p.path)) > 1e-9 ? ` (défaut ${fmt(labDefault(p.path), p.step)})` : '');
        saveLab();
        cb.onChange();
      });
      row.appendChild(top);
      row.appendChild(input);
      root.appendChild(row);
      sliders.push({ p, input, value });
    }
  }

  const refresh = (): void => {
    for (const s of sliders) {
      const v = readParam(s.p.path);
      s.input.value = String(v);
      s.value.textContent = fmt(v, s.p.step) + (Math.abs(v - labDefault(s.p.path)) > 1e-9 ? ` (défaut ${fmt(labDefault(s.p.path), s.p.step)})` : '');
    }
  };

  const panel: LabPanel = {
    open() {
      refresh();
      exportBox.style.display = 'none';
      root.style.display = 'block';
      root.scrollTop = 0;
    },
    close() {
      root.style.display = 'none';
    },
    get visible() {
      return root.style.display !== 'none';
    },
  };

  closeBtn.addEventListener('click', () => panel.close());
  replayBtn.addEventListener('click', () => {
    panel.close();
    cb.onReplay();
  });
  resetBtn.addEventListener('click', () => {
    resetLab();
    refresh();
    cb.onChange();
  });
  copyBtn.addEventListener('click', () => {
    const text = JSON.stringify(labOverrides(), null, 2);
    exportBox.value = Object.keys(labOverrides()).length ? text : '{}  (aucun changement par rapport aux valeurs du jeu)';
    exportBox.style.display = 'block';
    try {
      void navigator.clipboard?.writeText(text);
    } catch {
      /* clipboard unavailable: the text box stays visible to copy by hand */
    }
    exportBox.focus();
    exportBox.select();
  });

  host.appendChild(root);
  return panel;
}

function mkButton(label: string, bg: string, fg: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.cssText = `background:${bg};color:${fg};border:0;border-radius:10px;padding:9px 12px;font:800 13px system-ui,sans-serif;cursor:pointer;`;
  return b;
}
