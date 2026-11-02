// `.ts` extensions: Node's test runner needs them for runtime imports (type imports are erased).
import type { Rng } from '../core/rng.ts';
import type { KeyColor, Room } from '../types';
import type { TileMap } from './TileMap.ts';

export interface Door {
  color: KeyColor;
  /** Tile coordinates of every door tile (a doorway is 1-4 tiles wide). */
  tiles: { x: number; y: number }[];
  /** The CHEST room this door seals off. */
  sealedRoomId: string;
  unlocked: boolean;
}

export interface LockPlan {
  doors: Door[];
  /** Room holding each key. */
  keyRooms: Partial<Record<KeyColor, string>>;
  /** Rooms reachable from the spawn with every door closed. */
  openRoomIds: ReadonlySet<string>;
}

const NO_DOORS: ReadonlySet<number> = new Set();
/** Door colors in the order they chain: red guards the first locked room, blue the second. */
const DOOR_COLORS: readonly KeyColor[] = ['red', 'blue'];
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export const roomCenter = (r: Room): { x: number; y: number } => ({
  x: r.x + Math.floor(r.width / 2),
  y: r.y + Math.floor(r.height / 2),
});

export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Walkable tiles just outside a room's wall line: its doorway(s). */
function ringOpenings(map: TileMap, room: Room): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let x = room.x; x < room.x + room.width; x++) {
    for (const y of [room.y - 1, room.y + room.height]) if (!map.isSolid(x, y)) out.push({ x, y });
  }
  for (let y = room.y; y < room.y + room.height; y++) {
    for (const x of [room.x - 1, room.x + room.width]) if (!map.isSolid(x, y)) out.push({ x, y });
  }
  return out;
}

/** Ids of rooms whose center is reachable from `from` on foot; tiles in `opened` count as walkable. */
export function floodRooms(
  map: TileMap,
  rooms: readonly Room[],
  from: { x: number; y: number },
  opened: ReadonlySet<number> = NO_DOORS,
): Set<string> {
  const w = map.width;
  const seen = new Uint8Array(w * map.height);
  const start = from.y * w + from.x;
  const stack = [start];
  seen[start] = 1;
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const j = ny * w + nx;
      if (seen[j] || (map.isSolid(nx, ny) && !opened.has(j))) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  // A room counts as reached when any tile of it can be stood on: layouts may put an obstacle at its center.
  const reached = new Set<string>();
  for (const r of rooms) {
    for (let y = r.y; y < r.y + r.height && !reached.has(r.id); y++) {
      for (let x = r.x; x < r.x + r.width; x++) {
        if (seen[y * w + x]) {
          reached.add(r.id);
          break;
        }
      }
    }
  }
  return reached;
}

/**
 * Seals up to two dead-end combat rooms behind colored doors and places the keys so the chain is
 * solvable by construction: red key in the open area, blue key behind the red door, gold Core Key
 * behind the blue door (or behind the red door, or in the open area, when fewer rooms qualify).
 * A room qualifies only if closing its doorway leaves every other room reachable. Mutates `map`
 * (door tiles) and marks sealed rooms as CHEST.
 */
export function planLocks(map: TileMap, rooms: Room[], spawnRoom: Room, rng: Rng): LockPlan {
  const spawn = roomCenter(spawnRoom);
  const doors: Door[] = [];

  for (const room of shuffled(rooms.filter((r) => r.type === 'COMBAT'), rng)) {
    if (doors.length === DOOR_COLORS.length) break;
    const tiles = ringOpenings(map, room);
    if (tiles.length < 1 || tiles.length > 4) continue;

    for (const t of tiles) map.set(t.x, t.y, 'DOOR_LOCKED');
    const sealed = new Set([...doors.map((d) => d.sealedRoomId), room.id]);
    const reach = floodRooms(map, rooms, spawn);
    if (rooms.every((r) => sealed.has(r.id) || reach.has(r.id))) {
      doors.push({ color: DOOR_COLORS[doors.length], tiles, sealedRoomId: room.id, unlocked: false });
      room.type = 'CHEST';
    } else {
      for (const t of tiles) map.set(t.x, t.y, 'FLOOR'); // it was a through-way: leave it open
    }
  }

  // Two sealed rooms can depend on each other (one reachable only through the other's doorway), so
  // play the chain out and drop the last door until the floor is solvable. Zero doors always is.
  for (;;) {
    const openRoomIds = floodRooms(map, rooms, spawn);
    const open = rooms.filter((r) => r.type === 'COMBAT' && openRoomIds.has(r.id));
    const openRoom = (): string => (open.length > 0 ? open[rng.int(0, open.length - 1)] : spawnRoom).id;

    const keyRooms: Partial<Record<KeyColor, string>> = {};
    if (doors.length === 2) {
      keyRooms.red = openRoom();
      keyRooms.blue = doors[0].sealedRoomId;
      keyRooms.gold = doors[1].sealedRoomId;
    } else if (doors.length === 1) {
      keyRooms.red = openRoom();
      keyRooms.gold = doors[0].sealedRoomId;
    } else {
      keyRooms.gold = openRoom();
    }
    if (doors.length === 0 || isSolvable(map, rooms, doors, keyRooms)) return { doors, keyRooms, openRoomIds };

    const dropped = doors.pop() as Door;
    for (const t of dropped.tiles) map.set(t.x, t.y, 'FLOOR');
    (rooms.find((r) => r.id === dropped.sealedRoomId) as Room).type = 'COMBAT';
  }
}

/**
 * Topological order of the unlock dependencies, or null if they contain a cycle (a lock needing a
 * key that sits behind that same lock, directly or through a chain) or the Core Key is missing.
 * Nodes: `key:<color>`, `door:<color>`, `exit`. An edge a -> b means a must happen before b.
 */
export function topoOrder(doors: readonly Door[], keyRooms: Partial<Record<KeyColor, string>>): string[] | null {
  if (!keyRooms.gold) return null;
  const nodes = new Set<string>(['exit']);
  const edges: [string, string][] = [['key:gold', 'exit']];

  for (const d of doors) {
    if (!keyRooms[d.color]) return null; // a lock with no key anywhere
    nodes.add(`door:${d.color}`);
    edges.push([`key:${d.color}`, `door:${d.color}`]);
  }
  for (const [color, roomId] of Object.entries(keyRooms)) {
    nodes.add(`key:${color}`);
    const lock = doors.find((d) => d.sealedRoomId === roomId);
    if (lock) edges.push([`door:${lock.color}`, `key:${color}`]); // the key is inside this lock's room
  }

  const indegree = new Map<string, number>([...nodes].map((n) => [n, 0]));
  for (const [, to] of edges) indegree.set(to, (indegree.get(to) ?? 0) + 1);
  const ready = [...nodes].filter((n) => indegree.get(n) === 0);
  const order: string[] = [];
  for (let n = ready.shift(); n !== undefined; n = ready.shift()) {
    order.push(n);
    for (const [from, to] of edges) {
      if (from !== n) continue;
      const left = (indegree.get(to) as number) - 1;
      indegree.set(to, left);
      if (left === 0) ready.push(to);
    }
  }
  return order.length === nodes.size ? order : null;
}

/**
 * Plays the floor out: walk everywhere reachable, pick up every key in reach, open every door
 * those keys fit, repeat. Solvable when that fixpoint holds the Core Key and reaches the exit.
 */
export function isSolvable(
  map: TileMap,
  rooms: readonly Room[],
  doors: readonly Door[],
  keyRooms: Partial<Record<KeyColor, string>>,
): boolean {
  const spawn = rooms.find((r) => r.type === 'SPAWN');
  const exit = rooms.find((r) => r.type === 'EXIT');
  if (!spawn || !exit) return false;

  const opened = new Set<number>();
  const have = new Set<KeyColor>();
  const used = new Set<KeyColor>();
  for (;;) {
    const reach = floodRooms(map, rooms, roomCenter(spawn), opened);
    for (const [color, roomId] of Object.entries(keyRooms) as [KeyColor, string][]) {
      if (reach.has(roomId)) have.add(color);
    }
    let changed = false;
    for (const d of doors) {
      if (!have.has(d.color) || used.has(d.color)) continue;
      used.add(d.color);
      for (const t of d.tiles) opened.add(t.y * map.width + t.x);
      changed = true;
    }
    if (!changed) return have.has('gold') && reach.has(exit.id);
  }
}
