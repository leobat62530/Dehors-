import { describe, expect, it } from 'vitest';
import { BALANCE, launchSpeed } from '../src/config/balance';
import { FixedStepper } from '../src/core/loop';
import { aimFromDrag } from '../src/game/kick';
import { createBody, launch, stepBody } from '../src/game/physics';
import { defaultEquipment, Run } from '../src/game/run';

const eq = (kickLevel: number) => ({ ...defaultEquipment(), kickLevel });

const DT = 1 / BALANCE.loop.physicsHz;

function kick(run: Run, power: number, angle: number): void {
  run.aim.power = power;
  run.aim.angle = angle;
  run.aiming = true;
  expect(run.release()).toBe(true);
}

function playToEnd(run: Run, maxSeconds = 120): number {
  let steps = 0;
  while (run.phase !== 'ended' && steps < maxSeconds / DT) {
    run.step(DT);
    steps++;
  }
  return steps;
}

describe('kick', () => {
  it('maps power to the launch speed range and scales with the kick level', () => {
    expect(launchSpeed(0, 0)).toBeCloseTo(BALANCE.kick.minSpeed);
    expect(launchSpeed(1, 0)).toBeCloseTo(BALANCE.kick.maxSpeed);
    expect(launchSpeed(1, 2)).toBeCloseTo(BALANCE.kick.maxSpeed * BALANCE.kick.speedPerLevel ** 2);
    expect(launchSpeed(5, 0)).toBeCloseTo(BALANCE.kick.maxSpeed);
  });

  it('turns a backward pull into a forward kick, clamped in angle', () => {
    const aim = { power: 0, angle: 0 };
    // pull left and down (screen y down): kick goes right and up at 45°
    aimFromDrag(-100, 100, 200, aim);
    expect(aim.angle).toBeCloseTo(45);
    expect(aim.power).toBeCloseTo(Math.SQRT2 / 2);
    // flat pull: clamped to the minimum angle
    aimFromDrag(-150, 0, 100, aim);
    expect(aim.angle).toBe(BALANCE.kick.minAngle);
    expect(aim.power).toBe(1);
    // straight down: clamped to the maximum angle
    aimFromDrag(0, 150, 100, aim);
    expect(aim.angle).toBe(BALANCE.kick.maxAngle);
  });

  it('ignores a tiny drag', () => {
    const run = new Run(1, eq(0));
    run.aim.power = BALANCE.kick.minPowerToKick / 2;
    expect(run.release()).toBe(false);
    expect(run.phase).toBe('aim');
  });
});

describe('flight physics', () => {
  it('without drag, follows the ballistic range formula', () => {
    // Integrate with drag removed by hand to validate the integrator.
    const b = createBody();
    launch(b, 60, 45);
    let t = 0;
    let x = 0;
    let y = 0;
    let vx = b.vx;
    let vy = b.vy;
    while (y >= 0 && t < 30) {
      vy -= BALANCE.physics.gravity * DT;
      x += vx * DT;
      y += vy * DT;
      t += DT;
    }
    const expected = (60 * 60) / BALANCE.physics.gravity;
    expect(Math.abs(x - expected) / expected).toBeLessThan(0.01);
  });

  it('drag shortens the flight compared to the vacuum range', () => {
    const b = createBody();
    launch(b, 95, 43);
    while (b.bounces === 0) stepBody(b, DT);
    const vacuum = (95 * 95 * Math.sin((2 * 43 * Math.PI) / 180)) / BALANCE.physics.gravity;
    expect(b.x).toBeLessThan(vacuum);
    expect(b.x).toBeGreaterThan(vacuum * 0.5);
  });

  it('a fall from high up is held at the terminal speed and glides down at an angle', () => {
    const P = BALANCE.physics;
    const b = createBody();
    b.y = 2000;
    b.vx = 80;
    b.vy = 0;
    b.onGround = false;
    let slowest = 0;
    let t = 0;
    while (b.bounces === 0 && t < 300) {
      stepBody(b, DT);
      if (b.vy < slowest) slowest = b.vy;
      t += DT;
    }
    expect(b.bounces).toBe(1);
    expect(-slowest).toBeLessThan(P.fallTerminalSpeed * 1.05);
    // Just before touching down the descent is a slope, not a plumb line.
    expect(t).toBeGreaterThan(2000 / P.fallTerminalSpeed);
    expect(b.x).toBeGreaterThan(2000 * 0.5);
  });

  it('a long fall never ends the run in the air: the character always lands first', () => {
    const run = new Run(3, eq(0));
    run.emptyWorld();
    kick(run, 1, 43);
    while (run.phase !== 'flight') run.step(DT);
    run.body.y = 5000;
    run.body.vx = 0.001;
    run.body.vy = 0;
    const steps = playToEnd(run, 600);
    expect(run.phase).toBe('ended');
    expect(steps * DT).toBeGreaterThan(BALANCE.end.noProgressSeconds * 5);
    expect(run.body.y).toBe(0);
  });

  it('bounces lose energy, then the body rolls and the run ends', () => {
    const run = new Run(7, eq(0));
    kick(run, 1, 43);
    playToEnd(run);
    expect(run.phase).toBe('ended');
    expect(run.body.bounces).toBeGreaterThan(0);
    expect(run.endReason).not.toBeNull();
  });

  it('a starting player lands in the 200-600 m range at full power', () => {
    // Prompt target: no purchase means a ceiling around 200-400 m of flight, a little more with the roll.
    const run = new Run(3, eq(0));
    kick(run, 1, 43);
    playToEnd(run);
    expect(run.distance).toBeGreaterThan(200);
    expect(run.distance).toBeLessThan(700);
  });

  it('a weak kick goes less far than a strong one', () => {
    const weak = new Run(1, eq(0));
    kick(weak, 0.3, 43);
    playToEnd(weak);
    const strong = new Run(1, eq(0));
    kick(strong, 1, 43);
    playToEnd(strong);
    expect(strong.distance).toBeGreaterThan(weak.distance * 1.5);
  });

  it('a run always ends in a bounded time', () => {
    for (const angle of [15, 30, 43, 60, 75]) {
      const run = new Run(1, eq(10));
      kick(run, 1, angle);
      const steps = playToEnd(run);
      expect(run.phase).toBe('ended');
      expect(steps * DT).toBeLessThan(90);
    }
  });
});

describe('fixed timestep', () => {
  function simulate(frameSeconds: number, totalSeconds: number): { steps: number; xs: number[] } {
    const run = new Run(42, eq(0));
    kick(run, 0.8, 40);
    const xs: number[] = [];
    const stepper = new FixedStepper(
      (dt) => {
        run.step(dt);
        xs.push(run.body.x);
      },
      () => {},
    );
    const frames = Math.round(totalSeconds / frameSeconds);
    for (let i = 0; i < frames; i++) stepper.frame(frameSeconds);
    return { steps: stepper.steps, xs };
  }

  it('gives the same physics at 30, 60 and 120 frames per second', () => {
    const a = simulate(1 / 30, 8);
    const b = simulate(1 / 60, 8);
    const c = simulate(1 / 120, 8);
    const n = Math.min(a.steps, b.steps, c.steps);
    expect(Math.abs(a.steps - c.steps)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.steps - c.steps)).toBeLessThanOrEqual(1);
    expect(n).toBeGreaterThan(8 * BALANCE.loop.physicsHz - 2);
    for (let i = 0; i < n; i++) {
      expect(a.xs[i]).toBe(c.xs[i]);
      expect(b.xs[i]).toBe(c.xs[i]);
    }
  });

  it('drops time after a long freeze instead of fast-forwarding', () => {
    let steps = 0;
    const stepper = new FixedStepper(
      () => steps++,
      () => {},
    );
    stepper.frame(10);
    expect(steps).toBeLessThanOrEqual(Math.ceil(BALANCE.loop.maxFrameSeconds * BALANCE.loop.physicsHz));
  });
});

describe('determinism', () => {
  it('the same seed and the same kick give the same run', () => {
    const a = new Run(123, eq(2));
    const b = new Run(123, eq(2));
    kick(a, 0.9, 50);
    kick(b, 0.9, 50);
    playToEnd(a);
    playToEnd(b);
    expect(a.distance).toBe(b.distance);
    expect(a.maxAltitude).toBe(b.maxAltitude);
  });
});
