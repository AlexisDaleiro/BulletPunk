import type { RoomKind } from './types';

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

/** Keycards: red opens the first locked room, blue the second, gold (Core Override) runs the elevator. */
export const KEY_INFO = {
  red: { name: 'RED ACCESS CARD', color: 0xff0055 },
  blue: { name: 'BLUE BYPASS CARD', color: 0x3d7bff },
  gold: { name: 'GOLD CORE KEY', color: 0xffd400 },
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
/** Ambient terrain brightness outside the cone, including areas not explored yet. */
export const FOG_MEMORY_ALPHA = 0.38;

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
  loopFraction: 0.3,
  /** Chance a leaf hosts an elongated room (service corridor) when it is wide enough. */
  longRoomChance: 0.22,
  /** Elongated rooms: short edge range and the longest edge. */
  longRoom: { shortMin: 4, shortMax: 5, longMax: 16 },
} as const;

/** Where the generator spends its attention: tune a floor's feel here, not in the layouts. */
export const WORLD = {
  /** Closets and vault annexes carved per floor: [min, max] by floor index (floor 1 first). */
  closetsPerFloor: (floor: number): [number, number] => (floor <= 1 ? [1, 2] : [1, 3]),
  /** A shutter vault (opened from a terminal) appears from this floor on. */
  vaultFromFloor: 2,
  vaultChance: 0.7,
  /** Secret rooms: guaranteed one per floor, a second one from this floor with this chance. */
  secondSecretFromFloor: 3,
  secondSecretChance: 0.5,
  /** Hazard patches per eligible room: chance and how many more per floor. */
  hazardChance: (floor: number): number => Math.min(0.95, 0.6 + 0.06 * floor),
  /** Chance a service corridor is guarded by a tripwire. */
  tripwireChance: (floor: number): number => Math.min(0.85, 0.5 + 0.06 * floor),
} as const;

/** Bots per room kind: [min, max] before the per-floor extras. Total stays close to the old 1-3 per room. */
export const ROOM_ENEMIES = {
  ENTRY: [0, 0],
  DEPOT: [2, 3],
  WORKSHOP: [2, 3],
  SECURITY: [3, 4],
  LAB: [2, 3],
  MARKET: [1, 3],
  SERVICE: [1, 3],
  SUPPLY: [1, 2],
  MEDICAL: [0, 1],
  TECH: [1, 2],
  VAULT: [0, 0],
  SHOP: [0, 0],
  EXTRACTION: [3, 4],
  SECRET: [0, 0],
  ANNEX: [0, 0],
} as const satisfies Record<RoomKind, readonly [number, number]>;

/** Destructible obstacles. Damage comes from any bullet or blast. */
export const DESTRUCTIBLE = {
  CRATE: { hp: 36 },
  BARREL: { hp: 20, radius: 110, damage: 48, wallDamage: 160 },
  WEAK_WALL: { hp: 150 },
} as const;

/** Floor hazards. All are drawn with a warning and can be walked around. */
export const HAZARDS = {
  shock: { cycle: 2.8, warn: 1.1, active: 0.5, damage: 14 },
  toxic: { dps: 6 },
  laser: { alarmSeconds: 7, pulse: 1.1, cooldown: 12, hearing: 760 },
} as const;

/** Reward tuning. Chances are per room; amounts grow with the floor. */
export const REWARDS = {
  /** Chance of a stray supply cache by room kind (supply rooms always get theirs). */
  cacheChance: {
    ENTRY: 0.35, DEPOT: 0.45, WORKSHOP: 0.4, SECURITY: 0.45, LAB: 0.4, MARKET: 0.35, SERVICE: 0.3,
    MEDICAL: 0.5, TECH: 0.35, EXTRACTION: 0.3,
  } as Partial<Record<RoomKind, number>>,
  supplyWeights: { AMMO: 4, MED: 3, CREDITS: 3 },
  credits: { base: 12, perFloor: 4, special: 18 },
  /** Fraction of max HP a medical kit restores (shield refills in full). */
  medFraction: 0.4,
  /** Spare magazines an ammo cache grants. */
  ammoMagazines: 1,
  /** Special chest tier odds by floor: [tier1, tier2] cumulative thresholds, the rest is tier 3. */
  specialTier: (floor: number): [number, number] => [Math.max(0.15, 0.55 - 0.06 * floor), Math.max(0.55, 0.92 - 0.04 * floor)],
} as const;

/** Enemy scaling per floor, kept in one place. */
export const DIFFICULTY = {
  extraBotsFromFloor: 3,
  hpPerFloor: 0.1,
  damagePerFloor: 0.04,
  /** Share of bots carrying the SMG / shotgun, raised each floor. */
  smgChance: (floor: number): number => Math.min(0.4, 0.25 + 0.02 * floor),
  shotgunChance: (floor: number): number => Math.min(0.3, 0.1 + 0.03 * floor),
} as const;

/** Input magnitude (stick or keys) below which the gait is SNEAK: slow and silent. */
export const SNEAK_INPUT = 0.6;
/** Move scale applied while the sneak key is held. Must stay below SNEAK_INPUT. */
export const KEY_SNEAK_SCALE = 0.45;
export const MOVE_DEADZONE = 0.12;
/** A horizontal swipe across half the screen turns the mobile player 180 degrees. */
export const TOUCH_TURN_RADIANS = Math.PI * 2;
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
