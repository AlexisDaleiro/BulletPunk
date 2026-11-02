import type { TileMap } from '../world/TileMap.ts';
import { lineOfSight } from '../world/raycast.ts';

export function pulseReaches(map: TileMap, x: number, y: number, tx: number, ty: number, radius: number): boolean {
  return Math.hypot(tx - x, ty - y) <= radius && lineOfSight(map, x, y, tx, ty);
}
