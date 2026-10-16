import { BALANCE } from '../config/balance';
import type { KeyValueStore } from '../game/save';

/** The slice of the Telegram Mini App SDK the game uses. Every call is optional: the game runs in a plain browser too. */
export interface TelegramWebApp {
  initData: string;
  version: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string | undefined>;
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  ready(): void;
  expand(): void;
  isVersionAtLeast(version: string): boolean;
  disableVerticalSwipes?(): void;
  lockOrientation?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  switchInlineQuery?(query: string, chatTypes?: string[]): void;
  onEvent?(event: string, handler: () => void): void;
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  };
  CloudStorage?: {
    getItem(key: string, callback: (error: string | null, value?: string) => void): void;
    setItem(key: string, value: string, callback?: (error: string | null, stored?: boolean) => void): void;
  };
}

export function telegram(): TelegramWebApp | null {
  const w = window as unknown as { Telegram?: { WebApp?: TelegramWebApp } };
  const app = w.Telegram?.WebApp;
  // Outside Telegram the script still defines the object, with an empty initData and no platform.
  return app && typeof app.ready === 'function' && (app.initData || (app as { platform?: string }).platform !== 'unknown') ? app : null;
}

export interface Insets {
  top: number;
  bottom: number;
}

/** ready + expand, portrait, no closing swipe during play, theme colours. Returns the safe-area insets to respect. */
export function initTelegram(app: TelegramWebApp, background: string): Insets {
  app.ready();
  app.expand();
  try {
    app.lockOrientation?.();
    app.disableVerticalSwipes?.();
    app.setHeaderColor?.(background);
    app.setBackgroundColor?.(background);
  } catch {
    // Older clients throw on newer methods; nothing to do.
  }
  return insetsOf(app);
}

export function insetsOf(app: TelegramWebApp): Insets {
  const a = app.safeAreaInset;
  const c = app.contentSafeAreaInset;
  return { top: (a?.top ?? 0) + (c?.top ?? 0), bottom: (a?.bottom ?? 0) + (c?.bottom ?? 0) };
}

export type HapticKind = 'bounce' | 'impact' | 'wall' | 'buy' | 'record' | 'coin' | 'fatal';

export function haptic(app: TelegramWebApp | null, kind: HapticKind): void {
  const h = app?.HapticFeedback;
  if (!h) return;
  try {
    switch (kind) {
      case 'bounce':
        h.impactOccurred('light');
        break;
      case 'coin':
        h.impactOccurred('soft');
        break;
      case 'impact':
        h.impactOccurred('medium');
        break;
      case 'wall':
        h.impactOccurred('heavy');
        break;
      case 'buy':
      case 'record':
        h.notificationOccurred('success');
        break;
      case 'fatal':
        h.notificationOccurred('error');
        break;
    }
  } catch {
    // Unsupported on this client.
  }
}

/** Share through the inline query: the bot must have inline mode enabled in BotFather. */
export function shareViaTelegram(app: TelegramWebApp, text: string): boolean {
  if (!app.switchInlineQuery) return false;
  try {
    app.switchInlineQuery(text.slice(0, 256), ['users', 'groups', 'channels']);
    return true;
  } catch {
    return false;
  }
}

function cloudGet(app: TelegramWebApp, key: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!app.CloudStorage) return resolve(null);
    const timer = setTimeout(() => resolve(null), 3000);
    try {
      app.CloudStorage.getItem(key, (error, value) => {
        clearTimeout(timer);
        resolve(error || !value ? null : value);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/** Pick the save that has lived longer when the cloud and the device disagree. */
export function pickNewer(cloud: string | null, local: string | null): string | null {
  if (!cloud) return local;
  if (!local) return cloud;
  try {
    const c = JSON.parse(cloud) as { runs?: number; totalCoins?: number };
    const l = JSON.parse(local) as { runs?: number; totalCoins?: number };
    const score = (s: { runs?: number; totalCoins?: number }): number => (s.runs ?? 0) * 1000 + (s.totalCoins ?? 0);
    return score(l) > score(c) ? local : cloud;
  } catch {
    return cloud;
  }
}

/**
 * CloudStorage first, localStorage as the fallback and the mirror. Reads are served from memory
 * after the one startup fetch, writes go to both, the cloud one debounced.
 */
export async function createCloudStore(app: TelegramWebApp | null, local: KeyValueStore | null): Promise<KeyValueStore> {
  const cache = new Map<string, string>();
  const key = BALANCE.save.storageKey;
  const localValue = local?.getItem(key) ?? null;
  const cloudValue = app?.CloudStorage ? await cloudGet(app, key) : null;
  const chosen = pickNewer(cloudValue, localValue);
  if (chosen) cache.set(key, chosen);
  if (chosen && chosen !== localValue) local?.setItem(key, chosen);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const pending = new Map<string, string>();
  const flush = (): void => {
    timer = null;
    if (!app?.CloudStorage) return;
    for (const [k, v] of pending) {
      try {
        app.CloudStorage.setItem(k, v);
      } catch {
        // Quota or offline: the local mirror keeps the progress.
      }
    }
    pending.clear();
  };
  return {
    getItem: (k) => cache.get(k) ?? local?.getItem(k) ?? null,
    setItem: (k, v) => {
      cache.set(k, v);
      local?.setItem(k, v);
      if (!app?.CloudStorage) return;
      pending.set(k, v);
      if (timer === null) timer = setTimeout(flush, BALANCE.fx.cloudSaveDelayMs);
    },
  };
}
