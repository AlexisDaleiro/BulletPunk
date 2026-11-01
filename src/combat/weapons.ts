import type { WeaponInventoryComponent } from '../ecs/components';
import type { WeaponDefinition } from '../types';

/** The arsenal. Fire rate is rounds/s, spread is the total cone in radians, speed is px/s. */
export const WEAPONS = {
  PLASMA_PISTOL: {
    id: 'PLASMA_PISTOL',
    name: 'PLASMA PISTOL',
    type: 'PISTOL',
    damagePerPellet: 14,
    pelletCount: 1,
    spreadAngle: 0.03,
    fireRate: 4,
    magazineSize: 12,
    reloadTime: 1.1,
    projectileSpeed: 720,
    noiseProfile: 'MODERATE',
  },
  AUTO_SMG: {
    id: 'AUTO_SMG',
    name: 'AUTO-SMG',
    type: 'SMG',
    damagePerPellet: 8,
    pelletCount: 1,
    spreadAngle: 0.09,
    fireRate: 12,
    magazineSize: 30,
    reloadTime: 1.6,
    projectileSpeed: 800,
    noiseProfile: 'LOUD',
  },
  NEON_SHOTGUN: {
    id: 'NEON_SHOTGUN',
    name: 'NEON SHOTGUN',
    type: 'SHOTGUN',
    damagePerPellet: 7,
    pelletCount: 7,
    spreadAngle: 0.35,
    fireRate: 1.3,
    magazineSize: 6,
    reloadTime: 2.0,
    projectileSpeed: 650,
    noiseProfile: 'LOUD',
  },
  HEAVY_RAILGUN: {
    id: 'HEAVY_RAILGUN',
    name: 'HEAVY RAILGUN',
    type: 'RAILGUN',
    damagePerPellet: 70,
    pelletCount: 1,
    spreadAngle: 0,
    fireRate: 0.6,
    magazineSize: 3,
    reloadTime: 2.6,
    projectileSpeed: 1800,
    noiseProfile: 'EXPLOSIVE',
    specialAttributes: { piercing: true },
  },
} as const satisfies Record<string, WeaponDefinition>;

export type WeaponId = keyof typeof WEAPONS;

export const isWeaponId = (id: string): id is WeaponId => id in WEAPONS;

/** The pistol has unlimited spare rounds; everything else starts with three spare magazines. */
export const startingReserve = (w: WeaponDefinition): number => (w.type === 'PISTOL' ? Infinity : w.magazineSize * 3);

export function createWeaponInventory(ids: readonly WeaponId[]): WeaponInventoryComponent {
  const slots: WeaponDefinition[] = ids.map((id) => WEAPONS[id]);
  return {
    slots,
    activeSlot: 0,
    magazine: slots.map((w) => w.magazineSize),
    reserve: slots.map(startingReserve),
    reloadTimer: 0,
    fireCooldown: 0,
  };
}
