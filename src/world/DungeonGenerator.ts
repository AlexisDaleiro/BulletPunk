import type { Room } from '../types';
// `.ts` extensions: Node's test runner needs them for runtime imports (type imports are erased).
import { DUNGEON, TILE_SIZE } from '../config.ts';
import { createRng, type Rng } from '../core/rng.ts';
import { TileMap } from './TileMap.ts';

export interface Dungeon {
  seed: number;
  map: TileMap;
  rooms: Room[];
  /** Spawn point in world px: the center of the SPAWN room. */
  spawn: { x: number; y: number };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Edge = readonly [number, number];

/**
 * BSP rooms joined by a minimum spanning tree plus a few loop corridors.
 * Deterministic per seed. Every room is reachable from every other.
 */
export function generateDungeon(seed: number, width: number = DUNGEON.width, height: number = DUNGEON.height): Dungeon {
  const rng = createRng(seed);
  const map = new TileMap(width, height);

  // The outermost ring of tiles stays VOID/WALL, so the root leaf starts at 1.
  const leaves = partition({ x: 1, y: 1, w: width - 2, h: height - 2 }, rng);
  const rooms = leaves.map((leaf, i) => placeRoom(leaf, i, rng));
  for (const room of rooms) fill(map, room.x, room.y, room.width, room.height, 'FLOOR');

  for (const [a, b] of connect(rooms, rng)) {
    carveCorridor(map, center(rooms[a]), center(rooms[b]), rng);
    rooms[a].connectedRoomIds.push(rooms[b].id);
    rooms[b].connectedRoomIds.push(rooms[a].id);
  }

  wallOffFloors(map);
  const spawnRoom = classify(rooms, rng);
  for (const room of rooms) if (room.type === 'COMBAT') placeCover(map, room, rng);

  const c = center(spawnRoom);
  return { seed, map, rooms, spawn: { x: (c.x + 0.5) * TILE_SIZE, y: (c.y + 0.5) * TILE_SIZE } };
}

/** Recursively splits `leaf` into rectangles whose edges are >= minLeaf. */
function partition(leaf: Rect, rng: Rng): Rect[] {
  const { minLeaf, maxLeaf } = DUNGEON;
  const canSplitX = leaf.w >= 2 * minLeaf;
  const canSplitY = leaf.h >= 2 * minLeaf;
  const small = leaf.w <= maxLeaf && leaf.h <= maxLeaf;
  if ((!canSplitX && !canSplitY) || (small && rng.chance(0.4))) return [leaf];

  // Cut across the long side; near-square leaves flip a coin.
  const wide = leaf.w > leaf.h * 1.25;
  const tall = leaf.h > leaf.w * 1.25;
  const splitX = canSplitX && (!canSplitY || wide || (!tall && rng.chance(0.5)));
  if (splitX) {
    const cut = rng.int(minLeaf, leaf.w - minLeaf);
    return [
      ...partition({ ...leaf, w: cut }, rng),
      ...partition({ ...leaf, x: leaf.x + cut, w: leaf.w - cut }, rng),
    ];
  }
  const cut = rng.int(minLeaf, leaf.h - minLeaf);
  return [
    ...partition({ ...leaf, h: cut }, rng),
    ...partition({ ...leaf, y: leaf.y + cut, h: leaf.h - cut }, rng),
  ];
}

/** Random room inside the leaf, keeping 1 tile of padding so neighbours never touch. */
function placeRoom(leaf: Rect, index: number, rng: Rng): Room {
  const width = rng.int(DUNGEON.roomMin, Math.min(DUNGEON.roomMax, leaf.w - 2));
  const height = rng.int(DUNGEON.roomMin, Math.min(DUNGEON.roomMax, leaf.h - 2));
  return {
    id: `room-${index}`,
    x: leaf.x + rng.int(1, leaf.w - 1 - width),
    y: leaf.y + rng.int(1, leaf.h - 1 - height),
    width,
    height,
    type: 'COMBAT',
    connectedRoomIds: [],
    cleared: false,
  };
}

function center(room: Room): { x: number; y: number } {
  return { x: room.x + Math.floor(room.width / 2), y: room.y + Math.floor(room.height / 2) };
}

/** Prim's MST over room centers, then `loopFraction` extra short edges so the floor is not a tree. */
function connect(rooms: Room[], rng: Rng): Edge[] {
  const n = rooms.length;
  const dist = (a: number, b: number): number => {
    const ca = center(rooms[a]);
    const cb = center(rooms[b]);
    return Math.hypot(ca.x - cb.x, ca.y - cb.y);
  };

  const inTree = new Set<number>([0]);
  const edges: Edge[] = [];
  while (inTree.size < n) {
    let best: Edge | null = null;
    let bestDist = Infinity;
    for (const a of inTree) {
      for (let b = 0; b < n; b++) {
        if (inTree.has(b)) continue;
        const d = dist(a, b);
        if (d < bestDist) {
          bestDist = d;
          best = [a, b];
        }
      }
    }
    if (!best) break;
    edges.push(best);
    inTree.add(best[1]);
  }

  const used = new Set(edges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
  const extras: Edge[] = [];
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) if (!used.has(`${a}-${b}`)) extras.push([a, b]);
  }
  extras.sort((p, q) => dist(p[0], p[1]) - dist(q[0], q[1]));
  // Pick from the shortest candidates so loops are local shortcuts, not map-spanning tunnels.
  const pool = extras.slice(0, n * 2);
  const loops = Math.ceil(DUNGEON.loopFraction * edges.length);
  for (let i = 0; i < loops && pool.length > 0; i++) {
    edges.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  }
  return edges;
}

/** L-shaped corridor, `corridorWidth` tiles thick, bending at a random corner. */
function carveCorridor(map: TileMap, a: { x: number; y: number }, b: { x: number; y: number }, rng: Rng): void {
  const horizontalFirst = rng.chance(0.5);
  const corner = horizontalFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  carveLine(map, a, corner);
  carveLine(map, corner, b);
}

function carveLine(map: TileMap, p: { x: number; y: number }, q: { x: number; y: number }): void {
  const t = DUNGEON.corridorWidth;
  const x = Math.min(p.x, q.x);
  const y = Math.min(p.y, q.y);
  fill(map, x, y, Math.abs(p.x - q.x) + t, Math.abs(p.y - q.y) + t, 'FLOOR');
}

/** Fills a rectangle, never touching the outermost ring of tiles. */
function fill(map: TileMap, x: number, y: number, w: number, h: number, tile: 'FLOOR'): void {
  for (let ty = Math.max(1, y); ty < Math.min(map.height - 1, y + h); ty++) {
    for (let tx = Math.max(1, x); tx < Math.min(map.width - 1, x + w); tx++) map.set(tx, ty, tile);
  }
}

/** Every VOID tile touching (even diagonally) a FLOOR tile becomes WALL. */
function wallOffFloors(map: TileMap): void {
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      if (map.get(tx, ty) !== 'VOID') continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (map.get(tx + dx, ty + dy) === 'FLOOR') map.set(tx, ty, 'WALL');
        }
      }
    }
  }
}

/** Random SPAWN room; EXIT is the room farthest from it by corridor hops. Returns the spawn room. */
function classify(rooms: Room[], rng: Rng): Room {
  const spawn = rooms[rng.int(0, rooms.length - 1)];
  const hops = new Map<string, number>([[spawn.id, 0]]);
  const queue = [spawn];
  let exit = spawn;
  for (let room = queue.shift(); room; room = queue.shift()) {
    const d = hops.get(room.id) as number;
    if (d > (hops.get(exit.id) as number)) exit = room;
    for (const id of room.connectedRoomIds) {
      if (hops.has(id)) continue;
      hops.set(id, d + 1);
      queue.push(rooms.find((r) => r.id === id) as Room);
    }
  }
  spawn.type = 'SPAWN';
  exit.type = 'EXIT';
  return spawn;
}

/**
 * 2-4 single-tile barricades, kept 2 tiles off the walls, off the room center and never
 * touching each other: a room stays one open space, so cover can not block a route.
 */
function placeCover(map: TileMap, room: Room, rng: Rng): void {
  const c = center(room);
  const count = rng.int(2, 4);
  for (let placed = 0, tries = 0; placed < count && tries < 20; tries++) {
    const tx = rng.int(room.x + 2, room.x + room.width - 3);
    const ty = rng.int(room.y + 2, room.y + room.height - 3);
    if (tx === c.x && ty === c.y) continue;
    let crowded = false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) if (map.get(tx + dx, ty + dy) === 'COVER') crowded = true;
    }
    if (crowded) continue;
    map.set(tx, ty, 'COVER');
    placed++;
  }
}
