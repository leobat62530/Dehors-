/**
 * Balance simulator: plays headless runs with the values of balance.ts and prints the results.
 * Usage: npm run sim
 * It will grow with the economy (virtual free / small / big spenders over days of play).
 */
import { BALANCE } from '../src/config/balance';
import { defaultEquipment, Run } from '../src/game/run';

const eq = (kickLevel: number) => ({ ...defaultEquipment(), kickLevel });

const DT = 1 / BALANCE.loop.physicsHz;

function play(kickLevel: number, power: number, angle: number): Run {
  const run = new Run(1, eq(kickLevel));
  run.aim.power = power;
  run.aim.angle = angle;
  run.release();
  for (let i = 0; i < 300 / DT && run.phase !== 'ended'; i++) run.step(DT);
  return run;
}

const rows: string[] = [];
rows.push('niveau force | puissance | angle | distance | altitude max | durée');
for (const level of [0, 3, 6, 10]) {
  for (const power of [0.5, 1]) {
    // best angle for this kick, scanned by degree
    let best: { run: Run; angle: number } | null = null;
    for (let a = BALANCE.kick.minAngle; a <= BALANCE.kick.maxAngle; a++) {
      const run = play(level, power, a);
      if (!best || run.distance > best.run.distance) best = { run, angle: a };
    }
    if (!best) continue;
    const r = best.run;
    rows.push(
      `${String(level).padStart(12)} | ${power.toFixed(1).padStart(9)} | ${String(best.angle).padStart(5)} | ` +
        `${r.distance.toFixed(0).padStart(6)} m | ${r.maxAltitude.toFixed(0).padStart(10)} m | ${r.time.toFixed(1)} s`,
    );
  }
}
console.log(rows.join('\n'));
