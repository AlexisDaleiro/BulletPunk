import type { WeaponDefinition, WeaponType } from '../types.ts';

export interface WeaponVisual { id: string; length: number; width: number; color: number; style: 'PISTOL' | 'CARBINE' | 'ARC' | 'BELT' | 'SUPPRESSED' | 'PUMP' | 'LANCE' | 'COMPACT' | 'DOUBLE' | 'HEAVY_RAIL' }
const MODELS: Record<string, Omit<WeaponVisual, 'id'>> = {
  PLASMA_PISTOL: { length: 21, width: 5, color: 0x91d8d0, style: 'PISTOL' },
  PULSE_CARBINE: { length: 33, width: 6, color: 0x86d6c1, style: 'CARBINE' },
  ARC_SMG: { length: 29, width: 7, color: 0x8bc6fb, style: 'ARC' },
  BELT_LMG: { length: 39, width: 9, color: 0xb4cc7b, style: 'BELT' },
  HUSH_SMG: { length: 37, width: 4, color: 0x63cbbb, style: 'SUPPRESSED' },
  BREACH_SHOTGUN: { length: 32, width: 8, color: 0xe5a05a, style: 'PUMP' },
  LANCE_RIFLE: { length: 44, width: 5, color: 0xb8a1dc, style: 'LANCE' },
  AUTO_SMG: { length: 27, width: 6, color: 0x7dbbc4, style: 'COMPACT' },
  NEON_SHOTGUN: { length: 34, width: 7, color: 0xf298b0, style: 'DOUBLE' },
  HEAVY_RAILGUN: { length: 48, width: 9, color: 0xffbf75, style: 'HEAVY_RAIL' },
};
export function weaponVisual(weapon: Pick<WeaponDefinition, 'id' | 'type'>): WeaponVisual {
  return { id: weapon.id, ...(MODELS[weapon.id] ?? { length: weapon.type === 'RAILGUN' ? 38 : 31, width: 6, color: 0x91d8d0, style: 'CARBINE' }) };
}
export const legacyMuzzleLength = (type: WeaponType): number => type === 'RAILGUN' ? 38 : type === 'SHOTGUN' ? 29 : type === 'PISTOL' ? 21 : 31;
