import type { WeaponInventoryComponent } from '../ecs/components';
import type { WeaponDefinition } from '../types';

/** The arsenal. Fire rate is rounds/s, spread is the total cone in radians, speed is px/s. */
export const WEAPONS = {
  PULSE_CARBINE: {
    id: 'PULSE_CARBINE', name: 'LATIDO / CARABINA', type: 'PLASMA_RIFLE',
    damagePerPellet: 15, pelletCount: 1, spreadAngle: 0.035, fireRate: 5,
    magazineSize: 18, reloadTime: 1.6, projectileSpeed: 1050, range: 470, noiseProfile: 'MODERATE',
  },
  ARC_SMG: {
    id: 'ARC_SMG', name: 'ARCO / SUBFUSIL', type: 'SMG',
    damagePerPellet: 7, pelletCount: 1, spreadAngle: 0.11, fireRate: 11,
    magazineSize: 24, reloadTime: 1.4, projectileSpeed: 820, range: 360, noiseProfile: 'LOUD',
  },
  BELT_LMG: {
    id: 'BELT_LMG', name: 'LASTRE / AMETRALLADORA', type: 'PLASMA_RIFLE',
    damagePerPellet: 6, pelletCount: 1, spreadAngle: 0.12, fireRate: 11,
    magazineSize: 44, reloadTime: 3, projectileSpeed: 900, range: 470, noiseProfile: 'LOUD',
  },
  HUSH_SMG: {
    id: 'HUSH_SMG', name: 'HUSH / SUBFUSIL', type: 'SMG',
    damagePerPellet: 8, pelletCount: 1, spreadAngle: 0.08, fireRate: 10,
    magazineSize: 28, reloadTime: 1.5, projectileSpeed: 800, range: 340, noiseProfile: 'MODERATE', noiseScale: 0.35,
  },
  BREACH_SHOTGUN: {
    id: 'BREACH_SHOTGUN', name: 'FORJA / ESCOPETA', type: 'SHOTGUN',
    damagePerPellet: 8, pelletCount: 7, spreadAngle: 0.38, fireRate: 1.2,
    magazineSize: 5, reloadTime: 2.1, projectileSpeed: 660, range: 280, noiseProfile: 'LOUD',
  },
  LANCE_RIFLE: {
    id: 'LANCE_RIFLE', name: 'AGUJA / RIFLE EM', type: 'RAILGUN',
    damagePerPellet: 65, pelletCount: 1, spreadAngle: 0.01, fireRate: 0.7,
    magazineSize: 4, reloadTime: 2.4, projectileSpeed: 1600, range: 760, noiseProfile: 'LOUD',
    specialAttributes: { piercing: true },
  },
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
