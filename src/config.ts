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
  grid: 0x10202e,
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
