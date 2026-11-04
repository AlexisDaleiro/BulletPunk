import type { WeaponType } from '../types.ts';
import type { CosmeticLook } from '../profile/cosmetics.ts';

export interface OperativeAppearance {
  look?: CosmeticLook;
  id: string;
  color: number;
  palette: { cloth: number; armor: number; light: number; metal: number };
  silhouette?: 'LIGHT' | 'HEAVY' | 'SCOUT';
  hostile?: boolean;
  elite?: boolean;
}

export interface EnemyAppearance extends OperativeAppearance {
  name: string;
  silhouette: 'LIGHT' | 'HEAVY' | 'SCOUT';
  hostile: true;
}

export const ENEMY_APPEARANCES = {
  BASTION: {
    id: 'BASTION', name: 'BASTIÓN · ÉLITE', silhouette: 'HEAVY', hostile: true, elite: true, color: 0xf3c56f,
    palette: { cloth: 0x303c40, armor: 0x657981, light: 0xe8d29a, metal: 0xadc0be },
  },
  SENTRY: {
    id: 'SENTRY', name: 'CUSTODIO', silhouette: 'LIGHT', hostile: true, color: 0xf17b63,
    palette: { cloth: 0x3b3434, armor: 0x847966, light: 0xe4cfa4, metal: 0xa6a49a },
  },
  HUNTER: {
    id: 'HUNTER', name: 'RASTREADOR', silhouette: 'SCOUT', hostile: true, color: 0xef9e52,
    palette: { cloth: 0x303d45, armor: 0x586e78, light: 0xc0d3d9, metal: 0x96aab2 },
  },
  BREACHER: {
    id: 'ENEMY_BREACHER', name: 'RUPTOR', silhouette: 'HEAVY', hostile: true, color: 0xff655c,
    palette: { cloth: 0x453536, armor: 0x835052, light: 0xd4afa0, metal: 0xa48f84 },
  },
} as const satisfies Record<string, EnemyAppearance>;

/** A silhouette communicates the weapon threat; it does not silently change combat balance. */
export function enemyAppearance(type: WeaponType): EnemyAppearance {
  return type === 'SHOTGUN' ? ENEMY_APPEARANCES.BREACHER : type === 'SMG' || type === 'RAILGUN' ? ENEMY_APPEARANCES.HUNTER : ENEMY_APPEARANCES.SENTRY;
}
