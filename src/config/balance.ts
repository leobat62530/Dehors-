/**
 * Every tunable number of the game lives here, and only here.
 * Rebalancing the whole game must never require touching another file.
 * Units: metres, seconds, m/s, m/s². Angles in degrees.
 */

export const BALANCE = {
  loop: {
    /** Physics frequency (Hz). The simulation always steps at this rate. */
    physicsHz: 120,
    /** Longest frame we accept before dropping time (avoids the spiral of death after a tab switch). */
    maxFrameSeconds: 0.25,
  },

  render: {
    /** Pixels per metre at zoom 1. */
    pixelsPerMetre: 12,
    /** Device pixel ratio cap. */
    maxDevicePixelRatio: 2,
    /** Player is framed at this fraction of the screen height, from the top. */
    playerScreenY: 0.66,
    /** Player is framed at this fraction of the screen width, from the left. */
    playerScreenX: 0.3,
    /** Camera smoothing: fraction of the gap closed per second (exponential). */
    cameraDamping: 6,
    /** Fraction of the space above the player's frame line the character may climb before the camera follows up. */
    cameraHeadroom: 0.55,
    /** Zoom = 1 / (1 + speed / zoomSpeedReference), clamped to minZoom. */
    zoomSpeedReference: 90,
    minZoom: 0.35,
    /** The character is never drawn smaller than this height on screen (px), whatever the zoom. */
    minCharacterPx: 30,
    /** Ground tick marks spacing (m), a placeholder until the parallax arrives. */
    groundTickSpacing: 10,
    /** Ghost trajectory: number of dots and physics steps between two dots. */
    ghostDots: 28,
    ghostStepsPerDot: 6,
  },

  kick: {
    /** Launch speed range for power 0..1 (m/s). */
    minSpeed: 28,
    maxSpeed: 95,
    /** Multiplier per "Force du coup" level. */
    speedPerLevel: 1.09,
    /** Launch angle bounds (degrees). */
    minAngle: 15,
    maxAngle: 75,
    /** Angle used before the player drags (degrees). */
    defaultAngle: 43,
    /** Drag length, as a fraction of the screen's shortest side, that gives power 1. */
    fullPowerDragFraction: 0.42,
    /** Minimum power to accept a kick (a tiny drag is treated as a cancel). */
    minPowerToKick: 0.06,
    /** Duration of the boot swing before take-off (s). */
    swingSeconds: 0.12,
    /** Radius around the boot that accepts a touch (m, at zoom 1). */
    bootGrabRadius: 4.5,
  },

  physics: {
    gravity: 22,
    /** Quadratic drag: a = -k · v · |v|. */
    dragK: 0.0012,
    /** Ground bounce: vertical restitution and horizontal friction kept per bounce. */
    restitution: 0.55,
    bounceFriction: 0.9,
    /** Below this vertical speed (m/s) the character stops bouncing and rolls. */
    rollThreshold: 4,
    /** Fraction of horizontal speed kept per second while rolling. */
    rollFrictionPerSecond: 0.94,
    /** Constant rolling resistance (m/s²), so a roll always ends in a few seconds. */
    rollResistance: 3,
  },

  end: {
    /** Run ends when total speed drops below this (m/s) while on the ground. */
    minSpeed: 1.5,
    /** Run ends after this long without any distance gain (s). */
    noProgressSeconds: 1.2,
    /** Smallest distance gain that counts as progress (m). */
    progressEpsilon: 0.01,
  },

  altitude: {
    /** Below this altitude (m) the physics is the plain troposphere physics. */
    tropopause: 12_000,
    /** Drag falls linearly from full at the tropopause to zero here (m). The pivot of the game. */
    dragZeroAltitude: 40_000,
    /** Gravity starts decreasing above the tropopause and reaches `gravityFloorFactor` × g at this altitude (m). */
    gravityFloorAltitude: 10_000_000,
    gravityFloorFactor: 0.04,
    /** Orbit band: extra horizontal "arcade weightlessness" factor applied to gravity. */
    orbitGravityFactor: 0.35,
    /** Moon band: gravity factor relative to the troposphere value. */
    moonGravityFactor: 0.16,
  },

  wind: {
    /** Headwind/tailwind acts through the relative air speed; this caps its effect near the ground (m/s). */
    maxEffect: 40,
  },

  soundBarrier: {
    /** Speed (m/s) at which the barrier breaks. A speed, never a place. */
    speed: 340,
    /** Velocity multiplier applied once when the barrier breaks. */
    boost: 1.6,
    /** Duration (s) of the effect: no drag, obstacle immunity, visual flash. */
    seconds: 2.5,
    /** Minimum seconds between two barrier effects. */
    cooldown: 4,
  },

  timeScale: {
    /** Time accelerator steps the player cycles through during flight. */
    steps: [1, 2, 5, 10],
    /** Index of the highest step available without unlock (phase 4 gates the rest). */
    freeMaxIndex: 3,
  },

  signs: {
    /** Seconds a border or layer sign takes to sweep across the screen. */
    sweepSeconds: 2.2,
  },

  /**
   * Ground track. The country depends on the distance x only, in this arcade order.
   * `from` is the start distance in metres; a stage lasts until the next one.
   * `wind` is the horizontal air speed (m/s, positive = tailwind).
   */
  stages: [
    { id: 'arras', from: 0, wind: 0 },
    { id: 'somme', from: 500, wind: -3 },
    { id: 'paris', from: 2_000, wind: 0 },
    { id: 'campagne', from: 8_000, wind: -2 },
    { id: 'lyon', from: 25_000, wind: -3 },
    { id: 'marseille', from: 70_000, wind: 2 },
    { id: 'pyrenees', from: 150_000, wind: -8 },
    { id: 'espagne', from: 300_000, wind: -4 },
    { id: 'mediterranee', from: 600_000, wind: 6 },
    { id: 'maroc', from: 900_000, wind: -5 },
    { id: 'algerie', from: 1_400_000, wind: -6 },
    { id: 'tunisie', from: 2_000_000, wind: -5 },
    { id: 'soudan', from: 2_800_000, wind: -10 },
    { id: 'somalie', from: 4_000_000, wind: -8 },
    { id: 'congo', from: 5_500_000, wind: -4 },
    { id: 'nigeria', from: 7_500_000, wind: -14 },
    { id: 'desert', from: 10_000_000, wind: -9 },
  ],

  /** Sky layers. The layer depends on the altitude y only. `from` in metres. */
  layers: [
    { id: 'troposphere', from: 0 },
    { id: 'stratosphere', from: 12_000 },
    { id: 'orbite', from: 200_000 },
    { id: 'lune', from: 10_000_000 },
    { id: 'espace', from: 100_000_000 },
  ],

  player: {
    /** Character body size (m), for drawing and future collisions. */
    width: 2.2,
    height: 1.6,
    /** Boot position relative to the character, at rest (m). */
    bootOffsetX: -2.6,
    bootOffsetY: 0.4,
  },

  save: {
    storageKey: 'dehors.save',
    schemaVersion: 1,
  },
} as const;

export type Balance = typeof BALANCE;

/** Launch speed (m/s) for a kick of the given power (0..1) at the given "Force du coup" level. */
export function launchSpeed(power: number, kickLevel: number): number {
  const p = Math.min(1, Math.max(0, power));
  const base = BALANCE.kick.minSpeed + (BALANCE.kick.maxSpeed - BALANCE.kick.minSpeed) * p;
  return base * Math.pow(BALANCE.kick.speedPerLevel, kickLevel);
}
