import type { WeaponDefinition, WeaponType } from '../types.ts';
import { legacyMuzzleLength, weaponVisual } from './weaponVisual.ts';

/** Shared by the drawn barrel and projectile origin, in operative-local coordinates. */
export function weaponMuzzle(weapon: WeaponType | Pick<WeaponDefinition, 'id' | 'type'>): { x: number; y: number } {
  return { x: typeof weapon === 'string' ? legacyMuzzleLength(weapon) : weaponVisual(weapon).length, y: 8 };
}
