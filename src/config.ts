export const TILE_SIZE = 48;

/** Simulation step. Systems' `update` always receives exactly this dt. */
export const FIXED_DT = 1 / 60;
/** Longest real frame the loop will catch up on (avoids spiral of death after tab pause). */
export const MAX_FRAME_DT = 0.1;

export const MAX_PIXEL_RATIO = 2;
/** World pixels visible along the shorter screen side; camera zoom derives from it. */
export const VIEW_SPAN = 720;

export const COLORS = {
  background: 0x05060a,
  cyan: 0x00e5ff,
  red: 0xff0055,
  amber: 0xffe600,
  grid: 0x10202e,
} as const;

/** Shots despawn after travelling this far. */
export const BULLET_RANGE = 900;
/** Muzzle distance from the shooter's center, px. */
export const MUZZLE_OFFSET = 20;
/** Shot ripple radius per weapon noise profile, as a share of the 220 px SHOOT ripple. */
export const NOISE_PROFILE_MULT = { SILENT: 0, MODERATE: 0.6, LOUD: 1, EXPLOSIVE: 1.4 } as const;

/** Enemy bot tuning. Damage and fire-rate multipliers soften them via the passives mechanism. */
export const ENEMY = {
  hp: 40,
  runSpeed: 170,
  turnRate: 8,
  fov: (65 * Math.PI) / 180,
  range: 350,
  /** A ripple is heard when its origin is within this + its current radius. */
  hearing: 500,
  /** Seconds between spotting the player and opening fire: [min, max]. */
  reaction: [0.15, 0.3],
  /** Move input while patrolling: below SNEAK_INPUT, so patrols are silent. */
  patrolInput: 0.45,
  investigateInput: 0.8,
  combatInput: 0.9,
  /** Preferred fighting distance, px. */
  engageDistance: 200,
  damageMult: 0.5,
  fireRateMult: 0.7,
  /** Fire for burstOn seconds, then pause burstOff. */
  burstOn: 0.6,
  burstOff: 0.9,
  /** Share of max HP below which a bot runs for cover. */
  coverHpFraction: 0.3,
} as const;

export const LOCOMOTION = {
  runSpeed: 240, // px/s at full input
  accel: 1800, // px/s^2 while speeding up
  decel: 2400, // px/s^2 while slowing down
  turnRate: 20, // 1/s; higher snaps the body to the aim angle faster
  dashSpeed: 620,
  dashDuration: 0.16,
  dashCooldown: 0.8,
  dashTrailInterval: 0.03,
} as const;

export const PLAYER_VITALS = { hp: 100, shield: 50 } as const;
/** Half-extent of the player's square collision box, px. */
export const PLAYER_COLLIDER_HALF = 11;

/** Player vision: an 80-degree cone out to `range`, plus a 360-degree ring of `proximity` px. */
export const VISION = {
  fov: (80 * Math.PI) / 180,
  range: 420,
  proximity: 65,
} as const;
/** Share of the map still visible in explored areas outside the light (unexplored stays black). */
export const FOG_MEMORY_ALPHA = 0.05;

/** Dungeon sizes are in tiles. */
export const DUNGEON = {
  width: 60,
  height: 60,
  /** Smallest BSP leaf edge. Must be >= roomMin + 2 (1 tile of padding each side). */
  minLeaf: 12,
  /** Leaves at or below this edge may stop splitting early. */
  maxLeaf: 30,
  roomMin: 6,
  roomMax: 14,
  corridorWidth: 2,
  /** Extra corridors beyond the spanning tree, as a fraction of its edge count. */
  loopFraction: 0.15,
} as const;

/** Input magnitude (stick or keys) below which the gait is SNEAK: slow and silent. */
export const SNEAK_INPUT = 0.6;
/** Move scale applied while the sneak key is held. Must stay below SNEAK_INPUT. */
export const KEY_SNEAK_SCALE = 0.45;
export const MOVE_DEADZONE = 0.12;
/** Aim stick magnitude that counts as a deliberate aim. */
export const AIM_DEADZONE = 0.25;
/** Aim stick magnitude at which the weapon auto-fires. */
export const AIM_FIRE_THRESHOLD = 0.8;
/** Touch joystick travel, CSS px. */
export const STICK_RADIUS = 56;

export const NOISE_START_RADIUS = 10;
export const RUN_RIPPLE_INTERVAL = 0.4;
/** Ripple presets: radius grows from NOISE_START_RADIUS to maxRadius over `duration` seconds. */
export const NOISE_PROFILES = {
  RUN: { maxRadius: 90, duration: 0.6, color: '#00e5ff' },
  SHOOT: { maxRadius: 220, duration: 1.0, color: '#ff0055' },
  UTILITY: { maxRadius: 60, duration: 0.5, color: '#ffe600' },
} as const;
export type NoiseKind = keyof typeof NOISE_PROFILES;
