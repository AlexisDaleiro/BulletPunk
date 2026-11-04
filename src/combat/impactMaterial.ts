import type { TileType } from '../types.ts';

export type ImpactMaterial = 'METAL' | 'WOOD' | 'CONCRETE' | 'SHIELD' | 'ARMOR';
export function tileImpactMaterial(tile: TileType): ImpactMaterial {
  return tile === 'CRATE' ? 'WOOD' : ['CONTAINER', 'MACHINE', 'BARREL', 'COVER', 'SHUTTER', 'DOOR_LOCKED'].includes(tile) ? 'METAL' : 'CONCRETE';
}
export const IMPACT_STYLE: Record<ImpactMaterial, { color: number; chips: number; count: number; dust: number }> = {
  METAL: { color: 0xffd5a0, chips: 0xe5b573, count: 5, dust: 0 },
  WOOD: { color: 0xd9b57b, chips: 0x9a7549, count: 6, dust: .12 },
  CONCRETE: { color: 0xc3d0c9, chips: 0x8c999c, count: 5, dust: .2 },
  SHIELD: { color: 0x91e8f2, chips: 0xb8f7ff, count: 4, dust: 0 },
  ARMOR: { color: 0xffbc91, chips: 0xf5d2b0, count: 3, dust: 0 },
};
