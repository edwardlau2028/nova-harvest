// Nova Harvest: every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on
// the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 16,
  accel: 3000,
  maxSpeed: 380,
  drag: 3.2,
  invulnerable: 2.0,
  dashSpeed: 900,
  dashTime: 0.16,
  dashCooldown: 1.1,
  dashKillPoints: 15,
};

export const LIVES = 3;

/** Points for reaching this score: the harvest is complete and the win screen shows. */
export const WIN_SCORE = 5000;

export const SHARD = {
  radius: 11,
  points: 10,
  fallSpeed: 72,
  sway: 34,
  interval: 0.75,
  intervalJitter: 0.5,
  novaCharge: 12,
  /** Seconds a collected shard keeps the combo chain alive. */
  comboWindow: 3.0,
  /** Every 5 chained shards raise the multiplier by one, up to this. */
  comboStep: 5,
  maxMultiplier: 5,
};

export const WISP = {
  radius: 15,
  miniRadius: 10,
  speed: 78,
  speedPerLevel: 9,
  interval: 2.4,
  intervalScale: 0.92,
  minInterval: 0.8,
  touchPoints: 0,
  novaPoints: 25,
  /** How far a wisp's wobble carries it sideways as it chases. */
  wobble: 46,
};

export const NOVA = {
  /** Charge needed before the player can fire the Nova (0-100). */
  maxCharge: 100,
  radius: 340,
  linger: 0.6,
};

/** Seconds of play per level; speeds and spawn rates stop growing at the last level. */
export const LEVEL = { seconds: 20, max: 10 };

/** Pool sizes; allocated once, at boot, so the loop never allocates. */
export const POOL = { shards: 48, wisps: 40, particles: 256 };

export const PALETTE = {
  backdrop: '#070a18',
  nebulaA: '#1b1440',
  nebulaB: '#0c2a4a',
  nebulaC: '#3a1040',
  star: '#dfe8ff',
  player: '#7fe7ff',
  playerCore: '#ffffff',
  shard: '#ffd76a',
  shardCore: '#fff3c4',
  wisp: '#ff5d8f',
  wispMini: '#ff9ec4',
  darter: '#c77dff',
  nova: '#b8f7ff',
  panel: 'rgba(10, 14, 32, 0.72)',
  text: '#eef1f5',
  muted: '#8b93a3',
  good: '#7dffb0',
  warn: '#ffb454',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'nova-harvest.best';
