// `.ts` extensions: Node's test runner needs them for runtime imports (type imports are erased).
import type { Rng } from '../core/rng.ts';
import type { Room } from '../types';
import { shuffled } from './locks.ts';
import type { TileMap } from './TileMap.ts';

const MIN_SIDE = 3;
const MAX_SIDE = 5;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
/** Rooms a secret room may hang off: ones the player can actually stand in. */
const HOST_TYPES = new Set<Room['type']>(['COMBAT', 'SPAWN', 'EXIT', 'SHOP']);

interface Candidate {
  x: number;
  y: number;
  w: number;
  h: number;
  /** One wall tile per neighbouring room: the single tile between that room and the secret room. */
  walls: { roomId: string; x: number; y: number }[];
}

/**
 * Hides a small room in unused space, exactly one wall tile away from 2-3 ordinary rooms, and
 * turns one wall tile toward each of them into a SECRET_WALL (the only way in). Returns null when
 * the map has no spot that touches at least two rooms.
 */
export function carveSecretRoom(map: TileMap, rooms: Room[], rng: Rng): Room | null {
  const found: Candidate[] = [];
  for (let w = MIN_SIDE; w <= MAX_SIDE; w++) {
    for (let h = MIN_SIDE; h <= MAX_SIDE; h++) {
      for (let y = 2; y <= map.height - h - 2; y++) {
        for (let x = 2; x <= map.width - w - 2; x++) {
          if (!ringIsEmpty(map, x, y, w, h)) continue;
          const walls = hostWalls(map, rooms, x, y, w, h);
          if (walls.length >= 2) found.push({ x, y, w, h, walls });
        }
      }
    }
  }
  if (found.length === 0) return null;

  // Prefer spots touching three rooms, then pick at random so floors differ.
  const score = (c: Candidate): number => Math.min(c.walls.length, 3);
  const best = found.reduce((m, c) => Math.max(m, score(c)), 0);
  const pool = found.filter((c) => score(c) === best);
  const spot = pool[rng.int(0, pool.length - 1)];

  for (let ty = spot.y - 1; ty <= spot.y + spot.h; ty++) {
    for (let tx = spot.x - 1; tx <= spot.x + spot.w; tx++) {
      const inside = tx >= spot.x && tx < spot.x + spot.w && ty >= spot.y && ty < spot.y + spot.h;
      if (inside) map.set(tx, ty, 'FLOOR');
      else if (map.get(tx, ty) === 'VOID') map.set(tx, ty, 'WALL');
    }
  }
  const chosen = shuffled(spot.walls, rng).slice(0, 3);
  for (const wall of chosen) map.set(wall.x, wall.y, 'SECRET_WALL');

  const room: Room = {
    id: `room-${rooms.length}`,
    x: spot.x,
    y: spot.y,
    width: spot.w,
    height: spot.h,
    type: 'SECRET',
    connectedRoomIds: chosen.map((c) => c.roomId),
    cleared: false,
  };
  rooms.push(room);
  return room;
}

/** The rectangle plus a 1-tile border must hold nothing but void and wall: no floor, doors or cover. */
function ringIsEmpty(map: TileMap, x: number, y: number, w: number, h: number): boolean {
  for (let ty = y - 1; ty <= y + h; ty++) {
    for (let tx = x - 1; tx <= x + w; tx++) {
      const tile = map.get(tx, ty);
      if (tile !== 'VOID' && tile !== 'WALL') return false;
    }
  }
  return true;
}

/** Wall tiles with an interior tile on one side and a host room's floor on the other. */
function hostWalls(map: TileMap, rooms: readonly Room[], x: number, y: number, w: number, h: number): Candidate['walls'] {
  const byRoom = new Map<string, { roomId: string; x: number; y: number }>();
  const inside = (tx: number, ty: number): boolean => tx >= x && tx < x + w && ty >= y && ty < y + h;
  for (let sy = y; sy < y + h; sy++) {
    for (let sx = x; sx < x + w; sx++) {
      for (const [dx, dy] of DIRS) {
        const mx = sx + dx;
        const my = sy + dy;
        if (inside(mx, my) || map.get(mx, my) !== 'WALL') continue;
        const fx = sx + 2 * dx;
        const fy = sy + 2 * dy;
        if (map.get(fx, fy) !== 'FLOOR') continue;
        const host = rooms.find((r) => fx >= r.x && fx < r.x + r.width && fy >= r.y && fy < r.y + r.height);
        if (host && HOST_TYPES.has(host.type) && !byRoom.has(host.id)) byRoom.set(host.id, { roomId: host.id, x: mx, y: my });
      }
    }
  }
  return [...byRoom.values()];
}
