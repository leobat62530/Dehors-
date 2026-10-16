import { attachPointer } from './core/input';
import { FixedStepper, startAnimationLoop } from './core/loop';
import { App } from './ui/app';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas #game introuvable');

const app = new App(canvas, storage());
attachPointer(canvas, app);
window.addEventListener('resize', () => app.resize());

startAnimationLoop(
  new FixedStepper(
    (dt) => app.update(dt),
    (alpha) => app.render(alpha),
  ),
);
