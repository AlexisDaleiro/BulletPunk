// `.ts` extension: Node's test runner needs it for runtime imports (type imports are erased).
import { TILE_SIZE } from '../config.ts';
import type { TileMap } from './TileMap.ts';

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Moves `body` by its velocity, treating it as a square of half-size `half`, and pushes it out of
 * solid tiles. Axes resolve one at a time so a body slides along walls instead of sticking.
 * Safe while one step moves less than a tile (dash: 620 px/s * 1/60 s ~ 10 px).
 */
export function moveAndCollide(map: TileMap, body: Body, half: number, dt: number): void {
  body.x += body.vx * dt;
  resolve(map, body, half, true);
  body.y += body.vy * dt;
  resolve(map, body, half, false);
}

function resolve(map: TileMap, b: Body, half: number, horizontal: boolean): void {
  const T = TILE_SIZE;
  const minTx = Math.floor((b.x - half) / T);
  const maxTx = Math.ceil((b.x + half) / T) - 1; // a box ending exactly on a tile edge does not touch the next tile
  const minTy = Math.floor((b.y - half) / T);
  const maxTy = Math.ceil((b.y + half) / T) - 1;

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!map.isSolid(tx, ty)) continue;
      if (horizontal) {
        const left = tx * T - half;
        const right = (tx + 1) * T + half;
        // Moving into the tile pushes back out the way it came; a body that spawned inside goes to the nearer side.
        b.x = b.vx > 0 ? left : b.vx < 0 ? right : b.x < (tx + 0.5) * T ? left : right;
        b.vx = 0;
      } else {
        const top = ty * T - half;
        const bottom = (ty + 1) * T + half;
        b.y = b.vy > 0 ? top : b.vy < 0 ? bottom : b.y < (ty + 0.5) * T ? top : bottom;
        b.vy = 0;
      }
    }
  }
}
