import { flush, setAnalyticsSink } from './core/analytics';
import { attachPointer } from './core/input';
import { FixedStepper, startAnimationLoop } from './core/loop';
import { createEventSink } from './telegram/payments';
import { createCloudStore, initTelegram, shareViaTelegram, telegram } from './telegram/webapp';
import { THEME } from './theme/theme';
import { App } from './ui/app';
import { setShareHandler } from './ui/share';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas #game introuvable');

  // Inside Telegram: ready, expand, portrait, theme, CloudStorage first; outside, a plain page.
  const tg = telegram();
  const insets = tg ? initTelegram(tg, THEME.ui) : { top: 0, bottom: 0 };
  if (tg) setShareHandler((text) => shareViaTelegram(tg, text));
  // Anonymous events leave in batches; the last batch goes when the app is hidden.
  setAnalyticsSink(createEventSink(tg));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush();
  });
  const store = await createCloudStore(tg, storage());

  const app = new App(canvas, store, { telegram: tg, insets });
  attachPointer(canvas, app);
  window.addEventListener('resize', () => app.resize());
  tg?.onEvent?.('viewportChanged', () => app.resize());

  if (import.meta.env.DEV) {
    // Dev-only hook for screenshots and manual tests: never shipped in the production bundle.
    (window as unknown as { __dehors: unknown }).__dehors = app;
  }
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    // Offline after the first load.
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  }

  startAnimationLoop(
    new FixedStepper(
      (dt) => app.update(dt),
      (alpha) => app.render(alpha),
    ),
  );
}

void main();
