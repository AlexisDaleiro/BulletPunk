export type KeyColor = 'red' | 'blue' | 'gold';

export type TileType =
  | 'VOID'
  | 'FLOOR'
  | 'WALL'
  | 'COVER'
  | 'DOOR_LOCKED'
  | 'DOOR_UNLOCKED'
  | 'SECRET_WALL'
  | 'EXIT_ELEVATOR'
  /** Walkable leftovers of a destroyed obstacle. */
  | 'RUBBLE'
  /** Low destructible cover: blocks movement and shots, not sight. */
  | 'CRATE'
  /** Destructible, explodes when destroyed. */
  | 'BARREL'
  /** Heavy shipping container: blocks movement and sight, indestructible. */
  | 'CONTAINER'
  /** Machinery, benches, shelves, racks: blocks movement and shots, not sight. Variant picks the look. */
  | 'MACHINE'
  /** Marked wall that gives way to explosions and sustained fire. */
  | 'WEAK_WALL'
  /** Security shutter, opened from a terminal. */
  | 'SHUTTER';

/** The three identities of the one universe. */
export type Sector = 'MILITARY' | 'URBAN' | 'LAB';

/** What a room is for: layout, decoration, population and loot all key off this. */
export type RoomKind =
  | 'ENTRY'
  | 'DEPOT'
  | 'WORKSHOP'
  | 'SECURITY'
  | 'LAB'
  | 'MARKET'
  | 'SERVICE'
  | 'SUPPLY'
  | 'MEDICAL'
  | 'TECH'
  | 'VAULT'
  | 'SHOP'
  | 'EXTRACTION'
  | 'SECRET'
  | 'ANNEX';

export interface Room {
  id: string;
  x: number; // Tile coords
  y: number;
  width: number;
  height: number;
  /** Role in the progression (where the player starts, what is locked). */
  type: 'SPAWN' | 'COMBAT' | 'CHEST' | 'SECRET' | 'SHOP' | 'EXIT' | 'ANNEX';
  /** Function of the room: picks its layout, decor, population and loot. */
  kind: RoomKind;
  sector: Sector;
  connectedRoomIds: string[];
  cleared: boolean;
}

export interface NoiseEvent {
  id: string;
  x: number; // World pixels
  y: number;
  currentRadius: number;
  maxRadius: number;
  expansionSpeed: number; // px/sec
  intensity: number; // 0 to 1
  color: string;
  sourceEntityId: string;
}

export type WeaponType =
  | 'PISTOL'
  | 'SMG'
  | 'SHOTGUN'
  | 'PLASMA_RIFLE'
  | 'RAILGUN'
  | 'TESLA_DISRUPTOR';

export interface WeaponDefinition {
  id: string;
  name: string;
  type: WeaponType;
  damagePerPellet: number;
  pelletCount: number;
  spreadAngle: number; // radians
  fireRate: number; // rounds per sec
  magazineSize: number;
  reloadTime: number; // seconds
  projectileSpeed: number; // px/sec
  range?: number; // world pixels; defaults to BULLET_RANGE
  noiseProfile: 'SILENT' | 'MODERATE' | 'LOUD' | 'EXPLOSIVE';
  noiseScale?: number; // Suppressor attenuation inside a noise profile
  specialAttributes?: {
    piercing?: boolean;
    ricochetCount?: number;
    empStunSeconds?: number;
    homingAngle?: number;
  };
}

export interface CyberwarePassive {
  id: string;
  name: string;
  description: string;
  cost: number;
  modifiers: {
    moveSpeedMult?: number;
    visionRangeMult?: number;
    visionAngleBonus?: number;
    noiseDampingMult?: number; // Reduces player's sound ripple radius
    movementNoiseMult?: number; // Footsteps only; stacks with general noise damping
    damageMult?: number;
    fireRateMult?: number;
    bulletBounces?: number;
    shieldRegenRate?: number;
  };
}
