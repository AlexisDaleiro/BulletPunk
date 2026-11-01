// `.ts` extension: Node's test runner needs it for runtime imports (type imports are erased).
import { TILE_SIZE } from '../config.ts';
import type { TileMap } from './TileMap.ts';

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Wall line segments in world px for the vision raycaster: every boundary between a sight-blocking
 * tile and an open one, with collinear neighbours merged into one long segment.
 * Faces between two blockers are skipped; they can never be seen.
 */
export function extractWallEdges(map: TileMap): Segment[] {
  const T = TILE_SIZE;
  const out: Segment[] = [];

  // Horizontal faces sit on the line y between rows y-1 and y.
  for (let y = 0; y <= map.height; y++) {
    let start = -1;
    for (let x = 0; x <= map.width; x++) {
      const face = x < map.width && map.blocksSight(x, y - 1) !== map.blocksSight(x, y);
      if (face && start < 0) start = x;
      if (!face && start >= 0) {
        out.push({ x1: start * T, y1: y * T, x2: x * T, y2: y * T });
        start = -1;
      }
    }
  }

  // Vertical faces sit on the line x between columns x-1 and x.
  for (let x = 0; x <= map.width; x++) {
    let start = -1;
    for (let y = 0; y <= map.height; y++) {
      const face = y < map.height && map.blocksSight(x - 1, y) !== map.blocksSight(x, y);
      if (face && start < 0) start = y;
      if (!face && start >= 0) {
        out.push({ x1: x * T, y1: start * T, x2: x * T, y2: y * T });
        start = -1;
      }
    }
  }
  return out;
}
