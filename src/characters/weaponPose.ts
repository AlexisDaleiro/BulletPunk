import type { WeaponType } from '../types.ts';

/** Shared by the drawn barrel and projectile origin, in operative-local coordinates. */
export function weaponMuzzle(type: WeaponType): { x: number; y: number } {
  return { x: type === 'RAILGUN' ? 38 : type === 'SHOTGUN' ? 29 : type === 'PISTOL' ? 21 : 31, y: 8 };
}
