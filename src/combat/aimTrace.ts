import { weaponMuzzle } from '../characters/weaponPose.ts';
import { raycastTiles } from '../world/raycast.ts';
import type { TileMap } from '../world/TileMap.ts';
import type { WeaponType } from '../types.ts';

/** The guide starts where bullets do, including the lateral offset of the held weapon. */
export function traceAim(map: TileMap, x: number, y: number, angle: number, type: WeaponType, range: number) {
  const local = weaponMuzzle(type);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const sx = x + cos * local.x - sin * local.y, sy = y + sin * local.x + cos * local.y;
  const blocked = (tx: number, ty: number) => map.isSolid(tx, ty);
  const barrelHit = raycastTiles(blocked, x, y, sx, sy);
  if (barrelHit) return { sx: x, sy: y, ex: x + (sx - x) * barrelHit.t, ey: y + (sy - y) * barrelHit.t, blocked: true };
  const ex = sx + cos * range, ey = sy + sin * range;
  const hit = raycastTiles(blocked, sx, sy, ex, ey);
  return { sx, sy, ex: sx + (ex - sx) * (hit?.t ?? 1), ey: sy + (ey - sy) * (hit?.t ?? 1), blocked: !!hit };
}
