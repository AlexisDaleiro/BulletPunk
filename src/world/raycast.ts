// `.ts` extension: Node's test runner needs it for runtime imports (type imports are erased).
import { TILE_SIZE } from '../config.ts';
import type { TileMap } from './TileMap.ts';

export interface TileHit {
  /** Fraction 0..1 along the segment where it enters the blocked tile. */
  t: number;
  /** Unit normal of the face that was hit (0,0 when the segment starts inside a blocked tile). */
  nx: number;
  ny: number;
}

/**
 * Walks the grid cells along segment (x0,y0)->(x1,y1) (Amanatides-Woo) and returns the first
 * cell for which `blocked` is true, or null if the segment is clear.
 */
export function raycastTiles(
  blocked: (tx: number, ty: number) => boolean,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): TileHit | null {
  const T = TILE_SIZE;
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tx = Math.floor(x0 / T);
  let ty = Math.floor(y0 / T);
  if (blocked(tx, ty)) return { t: 0, nx: 0, ny: 0 };

  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const deltaX = dx !== 0 ? T / Math.abs(dx) : Infinity;
  const deltaY = dy !== 0 ? T / Math.abs(dy) : Infinity;
  let nextX = dx > 0 ? ((tx + 1) * T - x0) / dx : dx < 0 ? (tx * T - x0) / dx : Infinity;
  let nextY = dy > 0 ? ((ty + 1) * T - y0) / dy : dy < 0 ? (ty * T - y0) / dy : Infinity;

  for (;;) {
    if (nextX < nextY) {
      if (nextX > 1) return null;
      tx += stepX;
      if (blocked(tx, ty)) return { t: nextX, nx: -stepX, ny: 0 };
      nextX += deltaX;
    } else {
      if (nextY > 1) return null;
      ty += stepY;
      if (blocked(tx, ty)) return { t: nextY, nx: 0, ny: -stepY };
      nextY += deltaY;
    }
  }
}

/** True when no sight-blocking tile lies between the two points. */
export function lineOfSight(map: TileMap, ax: number, ay: number, bx: number, by: number): boolean {
  return raycastTiles((tx, ty) => map.blocksSight(tx, ty), ax, ay, bx, by) === null;
}

/** Eye at (ex, ey) facing `angle` with a cone of `fov` and reach `range`: can it see (tx, ty)? */
export function canSee(
  map: TileMap,
  ex: number,
  ey: number,
  angle: number,
  fov: number,
  range: number,
  tx: number,
  ty: number,
): boolean {
  const dx = tx - ex;
  const dy = ty - ey;
  if (dx * dx + dy * dy > range * range) return false;
  const off = Math.atan2(dy, dx) - angle;
  if (Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) > fov / 2) return false;
  return lineOfSight(map, ex, ey, tx, ty);
}

/**
 * First fraction 0..1 at which segment (x0,y0)->(x1,y1) touches the circle (cx,cy,r),
 * 0 if it starts inside, or null on a miss.
 */
export function segmentCircle(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  r: number,
): number | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const fx = x0 - cx;
  const fy = y0 - cy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (fx * dx + fy * dy);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}
