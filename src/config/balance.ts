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
    maxSpeed: 105,
    /** Multiplier per "Force du coup" level. */
    speedPerLevel: 1.1,
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
    dragK: 0.0009,
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
    /**
     * Each step after ×1 opens at a level, or earlier with premium currency (0 = never sold).
     * The pass opens every step up to `passIndex`.
     */
    unlocks: [
      { index: 1, level: 3, billets: 0 },
      { index: 2, level: 12, billets: 40 },
      { index: 3, level: 20, billets: 90 },
    ],
    passIndex: 2,
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
    { id: 'somme', from: 400, wind: -3 },
    { id: 'paris', from: 900, wind: 0 },
    { id: 'campagne', from: 2_500, wind: -2 },
    { id: 'lyon', from: 6_000, wind: -3 },
    { id: 'marseille', from: 15_000, wind: 2 },
    { id: 'pyrenees', from: 30_000, wind: -8 },
    { id: 'espagne', from: 45_000, wind: -4 },
    { id: 'mediterranee', from: 70_000, wind: 6 },
    { id: 'maroc', from: 125_000, wind: -5 },
    { id: 'algerie', from: 135_000, wind: -6 },
    { id: 'tunisie', from: 150_000, wind: -5 },
    { id: 'soudan', from: 170_000, wind: -10 },
    { id: 'somalie', from: 180_000, wind: -8 },
    { id: 'congo', from: 200_000, wind: -4 },
    { id: 'nigeria', from: 230_000, wind: -14 },
    { id: 'desert', from: 245_000, wind: -9 },
  ],

  /** Sky layers. The layer depends on the altitude y only. `from` in metres. */
  layers: [
    { id: 'troposphere', from: 0 },
    { id: 'stratosphere', from: 12_000 },
    { id: 'orbite', from: 200_000 },
    { id: 'lune', from: 10_000_000 },
    { id: 'espace', from: 100_000_000 },
  ],

  /** Character kits. Only `depart` is playable; the others carry data but never spawn. */
  profiles: {
    depart: {
      playable: true,
      boosters: ['liasse', 'sacoche', 'scooter', 'video'],
      obstacles: ['militante', 'association', 'helico', 'radar', 'gendarme'],
      fatal: 'gendarme',
      signature: 'scooter',
    },
    entrepreneur: {
      playable: false,
      boosters: ['liasse', 'sacoche', 'niche', 'jet'],
      obstacles: ['impot', 'baril', 'radar', 'urssaf'],
      fatal: 'urssaf',
      signature: 'niche',
    },
  },

  /** Boosters that appear by country, for any character. */
  placeBoosters: {
    pyrenees: ['clopes'],
    marseille: ['pastis'],
    maroc: ['the'],
    tunisie: ['the', 'mirage'],
    soudan: ['mirage', 'gourde'],
    somalie: ['gourde'],
    desert: ['mirage', 'gourde'],
  },

  /** Bouncers: vertical gain (m/s) and whether they pop after one use. */
  bouncers: {
    pigeon: { gain: 18, once: false, w: 1.6, h: 1.2 },
    ballon: { gain: 22, once: true, w: 2.2, h: 2.6 },
    mouette: { gain: 26, once: false, w: 2.4, h: 1.2 },
    drone: { gain: 30, once: true, w: 2.4, h: 1.2 },
    montgolfiere: { gain: 40, once: false, w: 6, h: 8 },
    trampoline: { gain: 45, once: false, w: 5, h: 1 },
    chameau: { gain: 36, once: false, w: 4, h: 3 },
    thermique: { gain: 28, once: false, w: 6, h: 10 },
    poisson: { gain: 24, once: false, w: 2, h: 1 },
    satellite: { gain: 60, once: false, w: 6, h: 4 },
  },

  /** Booster effects. `speed` multiplies the velocity once, `seconds` is the no-drag window, `coins` the payout. */
  boosterEffects: {
    liasse: { coins: 12, speed: 1, seconds: 0, wobble: 0 },
    sacoche: { coins: 60, speed: 1, seconds: 0, wobble: 0 },
    scooter: { coins: 0, speed: 1.4, seconds: 2, wobble: 0 },
    video: { coins: 0, speed: 1.8, seconds: 3, wobble: 0 },
    clopes: { coins: 0, speed: 1.5, seconds: 1, wobble: 0 },
    pastis: { coins: 0, speed: 2, seconds: 2, wobble: 1 },
    niche: { coins: 0, speed: 1, seconds: 3, wobble: 0 },
    jet: { coins: 0, speed: 2.5, seconds: 4, wobble: 0 },
    the: { coins: 0, speed: 1.5, seconds: 2, wobble: 0.4 },
    mirage: { coins: 0, speed: 1, seconds: 0, wobble: 0 },
    gourde: { coins: 0, speed: 1, seconds: 1.5, wobble: 0 },
  },

  /** Obstacle effects. `slowPerSecond` for clingers (3 taps to shake off), `slow` once, `coinLoss` share, `push` downwards m/s. */
  obstacleEffects: {
    militante: { cling: 0.08, slow: 0, coinLoss: 0, push: 0, dragSeconds: 0, fatal: false },
    association: { cling: 0.06, slow: 0, coinLoss: 0, push: 0, dragSeconds: 0, fatal: false },
    helico: { cling: 0, slow: 0, coinLoss: 0, push: 35, dragSeconds: 0, fatal: false },
    radar: { cling: 0, slow: 0, coinLoss: 0.3, push: 0, dragSeconds: 0, fatal: false },
    gendarme: { cling: 0, slow: 0, coinLoss: 0, push: 0, dragSeconds: 0, fatal: true },
    impot: { cling: 0, slow: 0.4, coinLoss: 0, push: 0, dragSeconds: 0, fatal: false },
    baril: { cling: 0, slow: 0.25, coinLoss: 0, push: 0, dragSeconds: 2, fatal: false },
    urssaf: { cling: 0, slow: 0, coinLoss: 0, push: 0, dragSeconds: 0, fatal: true },
  },
  /** Taps needed to shake off a clinging obstacle, and the window (s) in which they must land. */
  clinger: { taps: 3, tapWindowSeconds: 1.2 },

  /**
   * Spawn tables per stage. Densities are entities per 100 m of track. `bouncers` lists the
   * kinds and their weights, `hardObstacles` the extra density of hard obstacles added along
   * the track (radar, fatal). `wallEvery` is the distance between walls (m), `wallHeight` in m.
   */
  spawn: {
    chunk: 100,
    /** Spawn ahead of the character by this much (m). */
    lookahead: 900,
    /** Vertical band for aerial spawns: fraction of the current altitude plus this base (m). */
    airBandBase: 12,
    airBandFactor: 0.9,
    airBandMax: 11_000,
    stages: {
      arras: { bouncers: 1.4, boosters: 0.5, obstacles: 0.12, kinds: { pigeon: 6, ballon: 2 }, wallEvery: 230, wallHeight: 22 },
      somme: { bouncers: 1.1, boosters: 0.5, obstacles: 0.18, kinds: { ballon: 5, pigeon: 2, montgolfiere: 1 }, wallEvery: 380, wallHeight: 28 },
      paris: { bouncers: 1.6, boosters: 0.6, obstacles: 0.3, kinds: { pigeon: 7, drone: 3, ballon: 1 }, wallEvery: 650, wallHeight: 40 },
      campagne: { bouncers: 0.8, boosters: 0.45, obstacles: 0.22, kinds: { montgolfiere: 4, ballon: 3, pigeon: 1 }, wallEvery: 1_600, wallHeight: 45 },
      lyon: { bouncers: 1.0, boosters: 0.5, obstacles: 0.3, kinds: { drone: 5, pigeon: 3, ballon: 1 }, wallEvery: 3_000, wallHeight: 55 },
      marseille: { bouncers: 1.2, boosters: 0.6, obstacles: 0.3, kinds: { mouette: 7, ballon: 2, drone: 1 }, wallEvery: 5_000, wallHeight: 60 },
      pyrenees: { bouncers: 0.7, boosters: 0.55, obstacles: 0.32, kinds: { ballon: 4, montgolfiere: 2 }, wallEvery: 9_000, wallHeight: 80 },
      espagne: { bouncers: 0.8, boosters: 0.5, obstacles: 0.34, kinds: { ballon: 4, mouette: 2, thermique: 2 }, wallEvery: 16_000, wallHeight: 90 },
      mediterranee: { bouncers: 0.9, boosters: 0.5, obstacles: 0.3, kinds: { poisson: 6, mouette: 4 }, wallEvery: 22_000, wallHeight: 70 },
      maroc: { bouncers: 0.7, boosters: 0.55, obstacles: 0.36, kinds: { thermique: 4, ballon: 2, chameau: 1, mouette: 1 }, wallEvery: 30_000, wallHeight: 110 },
      algerie: { bouncers: 0.7, boosters: 0.5, obstacles: 0.4, kinds: { drone: 4, mouette: 3, thermique: 2 }, wallEvery: 36_000, wallHeight: 120 },
      tunisie: { bouncers: 0.6, boosters: 0.5, obstacles: 0.4, kinds: { thermique: 5, ballon: 2, chameau: 1 }, wallEvery: 42_000, wallHeight: 130 },
      soudan: { bouncers: 0.45, boosters: 0.45, obstacles: 0.44, kinds: { thermique: 6, ballon: 1 }, wallEvery: 60_000, wallHeight: 150 },
      somalie: { bouncers: 0.45, boosters: 0.4, obstacles: 0.46, kinds: { mouette: 6, thermique: 2 }, wallEvery: 70_000, wallHeight: 160 },
      congo: { bouncers: 0.5, boosters: 0.45, obstacles: 0.48, kinds: { thermique: 5, ballon: 2, drone: 1 }, wallEvery: 80_000, wallHeight: 180 },
      nigeria: { bouncers: 0.35, boosters: 0.6, obstacles: 0.52, kinds: { drone: 4, mouette: 2, thermique: 2 }, wallEvery: 60_000, wallHeight: 220 },
      desert: { bouncers: 0.2, boosters: 0.3, obstacles: 0.1, kinds: { thermique: 6, chameau: 1 }, wallEvery: 400_000, wallHeight: 260 },
    },
    /** Above the tropopause the layer table replaces the aerial spawns of the country. */
    layers: {
      troposphere: { bouncers: 0, kinds: {} },
      stratosphere: { bouncers: 0.08, kinds: { ballon: 1 } },
      orbite: { bouncers: 0.25, kinds: { satellite: 1 } },
      lune: { bouncers: 0.1, kinds: { satellite: 1 } },
      espace: { bouncers: 0.05, kinds: { satellite: 1 } },
    },
    /** Ground trampolines: chance per chunk, troposphere only. */
    trampolinePerChunk: 0.12,
    /** Share of place boosters among booster spawns where the stage has some. */
    placeBoosterShare: 0.45,
    /** Hard obstacles (fatal, radar) share of obstacle spawns, rising along the track. */
    hardShareStart: 0.15,
    hardShareEnd: 0.5,
  },

  walls: {
    /** Speed kept after breaking through a wall with a helmet. */
    speedKept: 0.85,
    /** Wall thickness (m). */
    thickness: 3,
  },

  helmets: [
    { id: 'passoire', walls: 1, price: 20, level: 1 },
    { id: 'chantier', walls: 2, price: 150, level: 4 },
    { id: 'moto', walls: 3, price: 600, level: 8 },
    { id: 'pompier', walls: 4, price: 2_000, level: 12 },
    { id: 'spatial', walls: 6, price: 7_500, level: 18 },
  ],

  economy: {
    /** One coin every this many metres, linear until `linearUntil`, then sub-linear with `exponent`. */
    distanceCoinEvery: 10,
    linearUntil: 2_000,
    exponent: 0.75,
    /** Coin clusters in flight: clusters per 100 m, coins per cluster, face value growth per stage. */
    clustersPer100m: 1.2,
    clusterMin: 3,
    clusterMax: 7,
    /** Face value of a coin = 1 + floor(stageIndex × valuePerStage). */
    valuePerStage: 0.5,
    /** Free gift: every `giftHours`, pays `giftBase` + `giftPerLevel` × level. */
    giftHours: 4,
    giftBase: 30,
    giftPerLevel: 5,
  },

  xp: {
    /** XP = distance ÷ distanceDivisor + coins ÷ coinDivisor, distance part soft-capped like the coins. */
    distanceDivisor: 15,
    coinDivisor: 4,
    distanceLinearUntil: 20_000,
    distanceExponent: 0.6,
    /** Level n needs levelBase × n^levelExponent points to go from n−1 to n. */
    levelBase: 120,
    levelExponent: 1.55,
    maxLevel: 30,
  },

  /** Shop upgrades: effect per level, levels, start price, price multiplier per level, unlock level. */
  upgrades: {
    force: { levels: 30, price: 30, growth: 1.35, unlock: 1 },
    semelles: { levels: 8, price: 80, growth: 1.7, unlock: 2 },
    combinaison: { levels: 16, price: 100, growth: 1.45, unlock: 2 },
    aimant: { levels: 6, price: 120, growth: 1.8, unlock: 5 },
    fusee: { levels: 4, price: 300, growth: 2.0, unlock: 6 },
    tremplin: { levels: 5, price: 500, growth: 2.2, unlock: 7 },
    avocat: { levels: 3, price: 1_500, growth: 3.0, unlock: 10 },
  },
  upgradeEffects: {
    /** Drag kept per "Combinaison" level. */
    suitDragPerLevel: 0.9,
    /** Extra pickup radius per "Aimant" level (m). */
    magnetRadiusPerLevel: 0.5,
    /** Rocket: speed multiplier and no-drag seconds per charge. */
    rocketBoost: 2,
    rocketSeconds: 2,
    /** Start further by this many metres per "Tremplin" level. */
    rampMetresPerLevel: 200,
  },

  /** Bouncer gain multiplier per "Semelles" level. */
  solesGainPerLevel: 1.08,

  player: {
    /** Character body size (m), for drawing and future collisions. */
    width: 2.2,
    height: 1.6,
    /** Boot position relative to the character, at rest (m). */
    bootOffsetX: -2.6,
    bootOffsetY: 0.4,
  },

  /** Trophies: country ones validate on distance (stage reached), sky ones on the run's max altitude (layer reached). */
  trophies: [
    { id: 'premier_lancer', kind: 'runs', value: 1, reward: 10 },
    { id: 'sortie_arras', kind: 'stage', stage: 'somme', reward: 15 },
    { id: 'somme', kind: 'stage', stage: 'paris', reward: 25 },
    { id: 'paris', kind: 'stage', stage: 'campagne', reward: 40 },
    { id: 'lyon', kind: 'stage', stage: 'lyon', reward: 60 },
    { id: 'marseille', kind: 'stage', stage: 'marseille', reward: 90 },
    { id: 'andorre', kind: 'stage', stage: 'pyrenees', reward: 130 },
    { id: 'ole', kind: 'stage', stage: 'espagne', reward: 180 },
    { id: 'gibraltar', kind: 'stage', stage: 'mediterranee', reward: 250 },
    { id: 'maroc', kind: 'stage', stage: 'maroc', reward: 320 },
    { id: 'alger', kind: 'stage', stage: 'algerie', reward: 400 },
    { id: 'tunis', kind: 'stage', stage: 'tunisie', reward: 500 },
    { id: 'nil', kind: 'stage', stage: 'soudan', reward: 650 },
    { id: 'corne', kind: 'stage', stage: 'somalie', reward: 800 },
    { id: 'fleuve', kind: 'stage', stage: 'congo', reward: 1000 },
    { id: 'lagos', kind: 'stage', stage: 'nigeria', reward: 1300 },
    { id: 'sable', kind: 'stage', stage: 'desert', reward: 2000 },
    { id: 'mur_du_son', kind: 'barriers', value: 1, reward: 50 },
    { id: 'stratosphere', kind: 'layer', layer: 'stratosphere', reward: 100 },
    { id: 'orbite', kind: 'layer', layer: 'orbite', reward: 300 },
    { id: 'lune', kind: 'layer', layer: 'lune', reward: 1000 },
    { id: 'hors_de_tout', kind: 'layer', layer: 'espace', reward: 2500 },
    { id: 'casse_briques', kind: 'walls', value: 10, reward: 80 },
    { id: 'increvable', kind: 'controls', value: 3, reward: 150 },
    { id: 'chaine_5', kind: 'chain', value: 5, reward: 120 },
    { id: 'cent_parties', kind: 'runs', value: 100, reward: 200 },
    { id: 'mille_pieces', kind: 'coins', value: 1000, reward: 100 },
    { id: 'boutique_complete', kind: 'shop', value: 1, reward: 3000 },
    { id: 'niveau_30', kind: 'level', value: 30, reward: 5000 },
  ],

  /** Visual and timing effects. */
  fx: {
    trailPoints: 28,
    trailEverySteps: 4,
    trailMinSpeed: 25,
    particlesPerCoin: 6,
    particlePool: 128,
    particleSeconds: 0.7,
    shockSeconds: 0.7,
    /** Slow motion when a record falls. */
    slowMoSeconds: 0.2,
    slowMoFactor: 0.25,
    bannerSeconds: 2.2,
    /** CloudStorage write debounce. */
    cloudSaveDelayMs: 600,
  },

  customisation: {
    /** Characters allowed in the player's name. */
    nameMaxLength: 16,
    defaultName: 'Joueur',
  },

  /**
   * Premium economy. "Billets" are bought in Telegram Stars (the only payment Telegram allows
   * for digital goods) and earned in small amounts for free. Everything paid is known in advance:
   * no paid random content, ever.
   */
  premium: {
    /** Billets packs sold in Stars. `bonus` billets come on top, growing with the pack. */
    billetPacks: [
      { id: 'billets_s', stars: 50, billets: 50, bonus: 0 },
      { id: 'billets_m', stars: 200, billets: 200, bonus: 40 },
      { id: 'billets_l', stars: 500, billets: 500, bonus: 175 },
    ],
    /** Coin packs paid in billets; coins scale with the level so a pack stays useful late. */
    coinPacks: [
      { id: 'pieces_s', billets: 20, coinsBase: 300, coinsPerLevel: 60 },
      { id: 'pieces_m', billets: 60, coinsBase: 1_100, coinsPerLevel: 220 },
      { id: 'pieces_l', billets: 150, coinsBase: 3_200, coinsPerLevel: 640 },
    ],
    /** Monthly pass: coin multiplier, time accelerator to ×5, gift period halved. */
    pass: { id: 'pass', stars: 250, days: 30, coinMultiplier: 2, giftHours: 2 },
    /**
     * Starter pack, shown once, when the player stalls for the first time, for `hours`.
     * Pays billets and coins at a discount (the equivalent of billets_m plus pieces_m).
     */
    starter: { id: 'starter', stars: 100, billets: 150, coinsBase: 1_100, coinsPerLevel: 220, hours: 24 },
    /** One-run gadgets, bought in coins or billets, consumed at the next kick. */
    gadgets: [
      { id: 'fusee_longue', coins: 400, billets: 8, rockets: 2, magnet: 0, lawyer: 0, soles: 0 },
      { id: 'aimant_geant', coins: 250, billets: 5, rockets: 0, magnet: 4, lawyer: 0, soles: 0 },
      { id: 'bouclier', coins: 900, billets: 15, rockets: 0, magnet: 0, lawyer: 1, soles: 0 },
      { id: 'double_rebond', coins: 350, billets: 7, rockets: 0, magnet: 0, lawyer: 0, soles: 4 },
    ],
    /** Gadgets held at once, per kind. */
    gadgetMax: 9,
    /** Stars a player may spend per calendar day, and the confirmation every purchase needs. */
    dailyStarsCap: 1_000,
    /** Runs after a purchase during which the end screen shows the gain against the player's average. */
    boostRuns: 3,
    /** Runs kept to compute that average. */
    recentRuns: 5,
  },

  /** Free daily wheel: segments with their weight; `coins` scale with the level, `billets` do not. */
  wheel: {
    segments: [
      { coinsBase: 20, coinsPerLevel: 4, billets: 0, weight: 24 },
      { coinsBase: 40, coinsPerLevel: 8, billets: 0, weight: 20 },
      { coinsBase: 0, coinsPerLevel: 0, billets: 1, weight: 12 },
      { coinsBase: 80, coinsPerLevel: 16, billets: 0, weight: 16 },
      { coinsBase: 30, coinsPerLevel: 6, billets: 0, weight: 20 },
      { coinsBase: 0, coinsPerLevel: 0, billets: 3, weight: 4 },
      { coinsBase: 150, coinsPerLevel: 30, billets: 0, weight: 8 },
      { coinsBase: 400, coinsPerLevel: 80, billets: 0, weight: 2 },
    ],
    /** Spin duration (s) and turns before the wheel settles. */
    spinSeconds: 3.4,
    turns: 5,
    /** Segments from this index up are jackpots (coin rain, sound, haptic). */
    jackpotFrom: 6,
  },

  /** Login streak: day 1 to 7, then day 7 repeats. Coins scale with the level; billets on the last day. */
  streak: {
    coinsBase: [10, 20, 35, 50, 80, 120, 200],
    coinsPerLevel: [2, 4, 7, 10, 16, 24, 40],
    billets: [0, 0, 1, 0, 0, 1, 3],
    /** Missing more than this many days breaks the streak. */
    graceDays: 1,
  },

  /** Daily challenges: three per day, drawn from these kinds; targets scale with the best distance. */
  challenges: {
    perDay: 3,
    kinds: [
      { kind: 'distance', share: 0.7, min: 150, coins: 60, billets: 0 },
      { kind: 'coins', share: 0, min: 25, coins: 50, billets: 0 },
      { kind: 'runs', share: 0, min: 5, coins: 40, billets: 1 },
      { kind: 'chain', share: 0, min: 3, coins: 70, billets: 0 },
      { kind: 'altitude', share: 0.6, min: 40, coins: 60, billets: 0 },
      { kind: 'walls', share: 0, min: 2, coins: 80, billets: 1 },
    ],
    /** Coin rewards scale with the level too. */
    coinsPerLevel: 8,
  },

  /** Rules that pay a bonus when the behaviour says the player is about to leave. */
  retention: {
    /** Runs in a row under `stallShare` × best distance before a free chest. */
    stallRuns: 3,
    stallShare: 0.9,
    stallCoinsFactor: 1.5,
    /** Minutes of session before the coin rain (once per session). */
    sessionMinutes: 15,
    sessionCoinsFactor: 2,
    /** Days away before the welcome-back gift (coins and billets). */
    returnDays: 2,
    returnCoinsFactor: 3,
    returnBillets: 2,
  },

  /** "Almost there" line on the end screen: within this share of the next border. */
  nearMiss: { share: 0.2 },

  save: {
    storageKey: 'dehors.save',
    schemaVersion: 4,
  },
} as const;

export type Balance = typeof BALANCE;

/** Coins earned from the distance alone: 1 per 20 m up to 2 km, sub-linear after. */
export function distanceCoins(distance: number): number {
  const E = BALANCE.economy;
  if (distance <= E.linearUntil) return Math.floor(distance / E.distanceCoinEvery);
  const base = E.linearUntil / E.distanceCoinEvery;
  return Math.floor(base * Math.pow(distance / E.linearUntil, E.exponent));
}

/** Launch speed (m/s) for a kick of the given power (0..1) at the given "Force du coup" level. */
export function launchSpeed(power: number, kickLevel: number): number {
  const p = Math.min(1, Math.max(0, power));
  const base = BALANCE.kick.minSpeed + (BALANCE.kick.maxSpeed - BALANCE.kick.minSpeed) * p;
  return base * Math.pow(BALANCE.kick.speedPerLevel, kickLevel);
}
