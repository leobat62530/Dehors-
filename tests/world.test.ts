import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { dragFactorAt, gravityFactorAt } from '../src/game/atmosphere';
import { createBody, launch, stepBody } from '../src/game/physics';
import { Run } from '../src/game/run';
import {
  distanceToNextBorder,
  LAYERS,
  layerAt,
  layerIndexAt,
  STAGES,
  stageAt,
  stageIndexAt,
} from '../src/game/world';

const DT = 1 / BALANCE.loop.physicsHz;

describe('ground track', () => {
  it('is exactly the ordered list from the spec', () => {
    expect(STAGES.map((s) => s.id)).toEqual([
      'arras',
      'somme',
      'paris',
      'campagne',
      'lyon',
      'marseille',
      'pyrenees',
      'espagne',
      'mediterranee',
      'maroc',
      'algerie',
      'tunisie',
      'soudan',
      'somalie',
      'congo',
      'nigeria',
      'desert',
    ]);
    for (let i = 1; i < STAGES.length; i++) {
      expect((STAGES[i] as { from: number }).from).toBeGreaterThan((STAGES[i - 1] as { from: number }).from);
    }
  });

  it('picks the country from the distance only', () => {
    expect(stageAt(0).id).toBe('arras');
    expect(stageAt(499).id).toBe('arras');
    expect(stageAt(500).id).toBe('somme');
    expect(stageAt(2_000).id).toBe('paris');
    expect(stageAt(7_999).id).toBe('paris');
    expect(stageAt(150_000).id).toBe('pyrenees');
    expect(stageAt(9_999_999).id).toBe('nigeria');
    expect(stageAt(10_000_000).id).toBe('desert');
    expect(stageAt(1e12).id).toBe('desert');
    expect(stageIndexAt(-5)).toBe(0);
  });

  it('the final desert never ends', () => {
    expect(distanceToNextBorder(10_000_000)).toBe(Number.POSITIVE_INFINITY);
    expect(distanceToNextBorder(100)).toBe(400);
  });
});

describe('sky layers', () => {
  it('picks the layer from the altitude only', () => {
    expect(LAYERS.map((l) => l.id)).toEqual(['troposphere', 'stratosphere', 'orbite', 'lune', 'espace']);
    expect(layerAt(0).id).toBe('troposphere');
    expect(layerAt(11_999).id).toBe('troposphere');
    expect(layerAt(12_000).id).toBe('stratosphere');
    expect(layerAt(200_000).id).toBe('orbite');
    expect(layerAt(10_000_000).id).toBe('lune');
    expect(layerAt(100_000_000).id).toBe('espace');
    expect(layerIndexAt(-1)).toBe(0);
  });

  it('a very long flat shot never returns orbit', () => {
    // Launch at the minimum angle with an absurd speed: far along the track, still in the troposphere.
    const run = new Run(1, 40);
    run.aim.power = 1;
    run.aim.angle = BALANCE.kick.minAngle;
    run.aiming = true;
    run.release();
    for (let i = 0; i < 600 / DT && run.phase !== 'ended'; i++) run.step(DT);
    expect(run.distance).toBeGreaterThan(10_000);
    expect(run.maxLayerIndex).toBeLessThan(layerIndexAt(200_000));
    expect(layerAt(run.maxAltitude).id).not.toBe('orbite');
  });

  it('a very high shot reaches the upper layers without "unlocking" them by distance', () => {
    // A chain of bouncers (phase 3) is what gets a player this high; here the body starts near the tropopause.
    const b = createBody();
    b.y = 11_500;
    launch(b, 1_500, 75);
    let maxY = 0;
    let steps = 0;
    while (b.bounces === 0 && steps < 3_000_000) {
      stepBody(b, DT);
      if (b.y > maxY) maxY = b.y;
      steps++;
    }
    expect(layerIndexAt(maxY)).toBeGreaterThanOrEqual(layerIndexAt(12_000));
    expect(stageIndexAt(b.x)).toBeLessThan(STAGES.length - 1);
  });
});

describe('altitude physics', () => {
  it('drag is full below the tropopause and zero above the pivot altitude', () => {
    expect(dragFactorAt(0)).toBe(1);
    expect(dragFactorAt(BALANCE.altitude.tropopause)).toBe(1);
    expect(dragFactorAt(BALANCE.altitude.dragZeroAltitude)).toBe(0);
    expect(dragFactorAt(1e9)).toBe(0);
    const mid = (BALANCE.altitude.tropopause + BALANCE.altitude.dragZeroAltitude) / 2;
    expect(dragFactorAt(mid)).toBeCloseTo(0.5);
  });

  it('gravity only decreases with altitude', () => {
    let last = gravityFactorAt(0);
    expect(last).toBe(1);
    for (const y of [12_000, 50_000, 200_000, 1e6, 1e7, 1e8, 1e9]) {
      const g = gravityFactorAt(y);
      expect(g).toBeLessThanOrEqual(last);
      expect(g).toBeGreaterThanOrEqual(BALANCE.altitude.gravityFloorFactor);
      last = g;
    }
  });

  it('high-altitude physics does not depend on the country', () => {
    const a = createBody();
    const b = createBody();
    a.x = 100;
    b.x = 5_000_000; // Congo, strong headwind in the troposphere
    a.y = b.y = 60_000; // above the drag pivot: wind has nothing to act on
    launch(a, 500, 30);
    launch(b, 500, 30);
    for (let i = 0; i < 1000; i++) {
      stepBody(a, DT);
      stepBody(b, DT);
    }
    expect(a.vx).toBeCloseTo(b.vx, 9);
    expect(a.vy).toBeCloseTo(b.vy, 9);
  });
});

describe('wind', () => {
  it('a headwind shortens the flight, a tailwind lengthens it', () => {
    const fly = (x0: number): number => {
      const b = createBody();
      b.x = x0;
      launch(b, 80, 40);
      while (b.bounces === 0) stepBody(b, DT);
      return b.x - x0;
    };
    const calm = fly(0); // Arras, no wind
    const head = fly(150_000); // Pyrenees, headwind
    const tail = fly(600_000); // Mediterranean, tailwind
    expect(head).toBeLessThan(calm);
    expect(tail).toBeGreaterThan(calm);
  });
});

describe('sound barrier', () => {
  it('fires on speed, boosts once and removes drag for its duration', () => {
    let fired = 0;
    const run = new Run(5, 0, { onSoundBarrier: () => fired++ });
    run.aim.power = 1;
    run.aim.angle = 40;
    run.aiming = true;
    run.release();
    // Push the body over the barrier by hand once in flight.
    while (run.phase !== 'flight') run.step(DT);
    run.body.vx = 400;
    run.body.vy = 50;
    run.step(DT);
    expect(fired).toBe(1);
    expect(run.barrierTime).toBeGreaterThan(0);
    expect(run.body.vx).toBeGreaterThan(400 * 1.5);
    const vAfterBoost = run.body.vx;
    run.step(DT);
    // With drag off, only gravity acts: horizontal speed is unchanged.
    expect(run.body.vx).toBeCloseTo(vAfterBoost, 6);
  });

  it('never fires below the barrier speed', () => {
    let fired = 0;
    const run = new Run(5, 0, { onSoundBarrier: () => fired++ });
    run.aim.power = 1;
    run.aim.angle = 43;
    run.aiming = true;
    run.release();
    for (let i = 0; i < 120 / DT && run.phase !== 'ended'; i++) run.step(DT);
    expect(run.maxSpeed).toBeLessThan(BALANCE.soundBarrier.speed);
    expect(fired).toBe(0);
  });
});

describe('time accelerator', () => {
  it('cycles through the configured steps and back to ×1', () => {
    const run = new Run(1, 0);
    const seen: number[] = [run.timeScale];
    for (let i = 0; i < BALANCE.timeScale.steps.length; i++) {
      run.cycleTimeScale();
      seen.push(run.timeScale);
    }
    expect(seen).toEqual([...BALANCE.timeScale.steps, 1]);
  });
});

describe('stage and layer events', () => {
  it('reports each border crossed, in order', () => {
    const stages: number[] = [];
    const run = new Run(9, 6, { onStage: (i) => stages.push(i) });
    run.aim.power = 1;
    run.aim.angle = 35;
    run.aiming = true;
    run.release();
    for (let i = 0; i < 120 / DT && run.phase !== 'ended'; i++) run.step(DT);
    expect(run.distance).toBeGreaterThan(500);
    expect(stages[0]).toBe(1);
    expect(run.maxStageIndex).toBe(stageIndexAt(run.distance));
  });
});
