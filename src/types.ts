export type TileType =
  | 'VOID'
  | 'FLOOR'
  | 'WALL'
  | 'COVER'
  | 'DOOR_LOCKED'
  | 'DOOR_UNLOCKED'
  | 'SECRET_WALL'
  | 'EXIT_ELEVATOR';

export interface Room {
  id: string;
  x: number; // Tile coords
  y: number;
  width: number;
  height: number;
  type: 'SPAWN' | 'COMBAT' | 'CHEST' | 'SECRET' | 'SHOP' | 'EXIT';
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
  noiseProfile: 'SILENT' | 'MODERATE' | 'LOUD' | 'EXPLOSIVE';
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
    damageMult?: number;
    fireRateMult?: number;
    bulletBounces?: number;
    shieldRegenRate?: number;
  };
}
