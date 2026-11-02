import type { KeyColor, Room } from '../types';
// `.ts` extensions: Node's test runner needs them for runtime imports (type imports are erased).
import { DUNGEON, REWARDS, TILE_SIZE, WORLD } from '../config.ts';
import { createRng, type Rng } from '../core/rng.ts';
import { idx, makeCtx } from './layoutKit.ts';
import { addChest, buildRoomLayout, cacheSpot, placeChests } from './layouts.ts';
import { planLocks, roomCenter, shuffled, type Door } from './locks.ts';
import { Plan, VAULT_TIER, type SecretPlan } from './plan.ts';
import { commitPocket, findCornerPockets, findVoidPockets, type Pocket } from './pockets.ts';
import { addTells, createSecret, furnishSecret } from './secrets.ts';
import { assignKinds, assignSectors, isElongated } from './sectors.ts';
import { TileMap } from './TileMap.ts';

export interface Dungeon {
  seed: number;
  floor: number;
  map: TileMap;
  rooms: Room[];
  /** Spawn point in world px: the center of the SPAWN room. */
  spawn: { x: number; y: number };
  /** Colored doors sealing CHEST rooms (0-2). */
  doors: Door[];
  /** Room holding each key. Always includes gold, the Core Override Key. */
  keyRooms: Partial<Record<KeyColor, string>>;
  /** Tile of the exit elevator, in the EXIT room. */
  elevator: { x: number; y: number };
  /** Everything placed besides tiles: decor, lights, chests, terminals, hazards, shutters, secrets. */
  plan: Plan;
}

export interface GenerateOptions {
  /** 1-based. Shops appear on even floors. */
  floor?: number;
  width?: number;
  height?: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Edge = readonly [number, number];

/**
 * BSP rooms joined by a minimum spanning tree plus loop corridors, then dressed with the
 * progression layer (colored doors and keys, solvable by construction; a shop on even floors; the
 * exit elevator), sectors and room functions, side pockets (closets, shutter vault, secret rooms),
 * a hand-designed layout per room, chests, hazards, decor and light. Deterministic per seed and floor.
 */
export function generateDungeon(seed: number, options: GenerateOptions = {}): Dungeon {
  const { floor = 1, width = DUNGEON.width, height = DUNGEON.height } = options;
  const rng = createRng(seed);
  const map = new TileMap(width, height);

  // The outermost ring of tiles stays VOID/WALL, so the root leaf starts at 1.
  const leaves = partition({ x: 1, y: 1, w: width - 2, h: height - 2 }, rng);
  const rooms = leaves.map((leaf, i) => placeRoom(leaf, i, rng));
  for (const room of rooms) fill(map, room.x, room.y, room.width, room.height, 'FLOOR');

  for (const [a, b] of connect(rooms, rng)) {
    carveCorridor(map, roomCenter(rooms[a]), roomCenter(rooms[b]), rng);
    rooms[a].connectedRoomIds.push(rooms[b].id);
    rooms[b].connectedRoomIds.push(rooms[a].id);
  }

  wallOffFloors(map);
  const spawnRoom = classify(rooms, rng);
  const exitRoom = rooms.find((r) => r.type === 'EXIT') as Room;

  const { doors, keyRooms, openRoomIds } = planLocks(map, rooms, spawnRoom, rng);
  if (floor % 2 === 0) assignShop(rooms, spawnRoom, openRoomIds, new Set(Object.values(keyRooms)));

  const elevator = roomCenter(exitRoom);
  map.set(elevator.x, elevator.y, 'EXIT_ELEVATOR');

  const plan = new Plan();
  plan.floor = floor;
  assignSectors(rooms, rng);
  assignKinds(rooms, floor, rng);
  const main = rooms.slice();
  const pockets = carvePockets(map, rooms, plan, openRoomIds, floor, rng);

  // Hand-designed layouts for every main room, then their chests. Pockets are furnished after.
  for (const room of main) {
    const ctx = makeCtx(map, room, rng, plan);
    buildRoomLayout(ctx);
    const door = doors.find((d) => d.sealedRoomId === room.id);
    placeChests(ctx, door ? VAULT_TIER[door.color] : 2);
  }
  for (const p of pockets) furnishPocket(map, plan, p, rng);
  ensureTerminal(map, rooms, plan, openRoomIds, rng);
  ensureSupply(map, rooms, plan, openRoomIds, rng);
  for (const s of plan.secrets) addTells(plan, s);
  addCorridorLights(map, rooms, plan, rng);

  const c = roomCenter(spawnRoom);
  return {
    seed,
    floor,
    map,
    rooms,
    spawn: { x: (c.x + 0.5) * TILE_SIZE, y: (c.y + 0.5) * TILE_SIZE },
    doors,
    keyRooms,
    elevator,
    plan,
  };
}

interface PocketJob {
  room: Room;
  job: 'CLOSET' | 'VAULT' | 'SECRET';
  secret?: SecretPlan;
}

/** Secret rooms, a shutter vault and a few closets, all hung off rooms the player can reach. */
function carvePockets(map: TileMap, rooms: Room[], plan: Plan, open: ReadonlySet<string>, floor: number, rng: Rng): PocketJob[] {
  const jobs: PocketJob[] = [];
  const hosts = (): Room[] => rooms.filter((r) => r.type === 'COMBAT' && open.has(r.id) && !isElongated(r));
  const choose = (): Pocket | null => {
    const h = hosts();
    const voids = findVoidPockets(map, plan, h);
    // Void space first (a proper room behind a wall); a walled-off corner when the map is packed.
    const pool = voids.length > 0 ? voids : findCornerPockets(map, plan, h);
    return pool.length > 0 ? pool[rng.int(0, pool.length - 1)] : null;
  };
  const make = (job: PocketJob['job'], doorTile: 'FLOOR' | 'SHUTTER' | 'SECRET_WALL'): void => {
    const pocket = choose();
    if (!pocket) return;
    const site = pocket.sites[rng.int(0, pocket.sites.length - 1)];
    const secret = job === 'SECRET';
    const room = commitPocket(map, rooms, plan, pocket, site, doorTile, secret ? 'SECRET' : 'ANNEX', secret ? 'SECRET' : 'ANNEX');
    const entry: PocketJob = { room, job };
    if (secret) entry.secret = createSecret(plan, map, site, room, rng);
    if (job === 'VAULT') plan.shutters.push({ id: plan.nextId('shutter'), tiles: [site.wall], roomId: room.id });
    jobs.push(entry);
  };

  make('SECRET', 'SECRET_WALL');
  if (floor >= WORLD.secondSecretFromFloor && rng.chance(WORLD.secondSecretChance)) make('SECRET', 'SECRET_WALL');
  if (floor >= WORLD.vaultFromFloor && rng.chance(WORLD.vaultChance)) make('VAULT', 'SHUTTER');
  const [lo, hi] = WORLD.closetsPerFloor(floor);
  for (let i = rng.int(lo, hi); i > 0; i--) make('CLOSET', 'FLOOR');
  return jobs;
}

function furnishPocket(map: TileMap, plan: Plan, p: PocketJob, rng: Rng): void {
  if (p.job === 'SECRET' && p.secret) {
    furnishSecret(map, plan, p.room, p.secret, rng);
    return;
  }
  const c = makeCtx(map, p.room, rng, plan);
  const spot = cacheSpot(c);
  if (!spot) return;
  if (p.job === 'VAULT') addChest(c, spot, 'SPECIAL', rng.next() < REWARDS.specialTier(plan.floor)[1] ? 2 : 3);
  else addChest(c, spot, 'SUPPLY', 1);
}

/** Shutters and tripwires are useless without a terminal: guarantee one in a reachable room. */
function ensureTerminal(map: TileMap, rooms: Room[], plan: Plan, open: ReadonlySet<string>, rng: Rng): void {
  const needed = plan.shutters.length > 0 || plan.hazards.some((h) => h.kind === 'LASER');
  if (!needed || plan.terminals.length > 0) return;
  // Roomy combat rooms first, then service passages, and the arrival room as the last resort.
  const rank = (r: Room): number => (r.type === 'SPAWN' ? 2 : isElongated(r) ? 1 : 0);
  const order = shuffled(rooms.filter((r) => (r.type === 'COMBAT' || r.type === 'SPAWN') && open.has(r.id)), rng).sort((a, b) => rank(a) - rank(b));
  for (const room of order) {
    const spot = cacheSpot(makeCtx(map, room, rng, plan));
    if (!spot) continue;
    plan.terminals.push({ id: plan.nextId('term'), tx: spot.x, ty: spot.y, roomId: room.id });
    return;
  }
}

/** Survival comes first: a floor always has at least one supply cache in a room the player can reach. */
function ensureSupply(map: TileMap, rooms: Room[], plan: Plan, open: ReadonlySet<string>, rng: Rng): void {
  if (plan.chests.some((c) => c.family === 'SUPPLY' && open.has(c.roomId))) return;
  for (const room of shuffled(rooms.filter((r) => (r.type === 'COMBAT' || r.type === 'SPAWN') && open.has(r.id)), rng)) {
    const c = makeCtx(map, room, rng, plan);
    const spot = cacheSpot(c);
    if (!spot) continue;
    addChest(c, spot, 'SUPPLY', 1);
    return;
  }
}

/** A few dim lamps along corridors so the spaces between rooms are not pitch black. */
function addCorridorLights(map: TileMap, rooms: readonly Room[], plan: Plan, rng: Rng): void {
  const inRoom = new Set<number>();
  for (const r of rooms) for (let y = r.y - 1; y <= r.y + r.height; y++) for (let x = r.x - 1; x <= r.x + r.width; x++) inRoom.add(idx(map, x, y));
  let placed = 0;
  for (let y = 1; y < map.height - 1 && placed < 40; y++) {
    for (let x = 1; x < map.width - 1 && placed < 40; x++) {
      if (map.get(x, y) !== 'FLOOR' || inRoom.has(idx(map, x, y)) || !rng.chance(0.03)) continue;
      plan.lights.push({ x: (x + 0.5) * TILE_SIZE, y: (y + 0.5) * TILE_SIZE, r: 96, color: 0xb9d3ff, alpha: 0.12, flicker: rng.chance(0.25) });
      placed++;
    }
  }
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

/**
 * Random room inside the leaf, keeping 1 tile of padding so neighbours never touch. Wide-enough
 * leaves sometimes get a long thin room instead: a service passage.
 */
function placeRoom(leaf: Rect, index: number, rng: Rng): Room {
  const { roomMin, roomMax, longRoom, longRoomChance } = DUNGEON;
  let width: number;
  let height: number;
  const longX = leaf.w - 2 >= 10;
  const longY = leaf.h - 2 >= 10;
  if ((longX || longY) && rng.chance(longRoomChance)) {
    const horizontal = longX && (!longY || rng.chance(0.5));
    const long = rng.int(10, Math.min(longRoom.longMax, (horizontal ? leaf.w : leaf.h) - 2));
    const short = rng.int(longRoom.shortMin, longRoom.shortMax);
    width = horizontal ? long : short;
    height = horizontal ? short : long;
  } else {
    width = rng.int(roomMin, Math.min(roomMax, leaf.w - 2));
    height = rng.int(roomMin, Math.min(roomMax, leaf.h - 2));
  }
  return {
    id: `room-${index}`,
    x: leaf.x + rng.int(1, leaf.w - 1 - width),
    y: leaf.y + rng.int(1, leaf.h - 1 - height),
    width,
    height,
    type: 'COMBAT',
    kind: 'DEPOT',
    sector: 'MILITARY',
    connectedRoomIds: [],
    cleared: false,
  };
}

/** Prim's MST over room centers, then `loopFraction` extra short edges so the floor is not a tree. */
function connect(rooms: Room[], rng: Rng): Edge[] {
  const n = rooms.length;
  const dist = (a: number, b: number): number => {
    const ca = roomCenter(rooms[a]);
    const cb = roomCenter(rooms[b]);
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

const roomy = (r: Room): boolean => Math.min(r.width, r.height) >= 6;

/** Random SPAWN room; EXIT is the roomy room farthest from it by corridor hops. Returns the spawn room. */
function classify(rooms: Room[], rng: Rng): Room {
  const candidates = rooms.filter(roomy);
  const spawn = candidates[rng.int(0, candidates.length - 1)];
  const hops = new Map<string, number>([[spawn.id, 0]]);
  const queue = [spawn];
  let exit = spawn;
  for (let room = queue.shift(); room; room = queue.shift()) {
    const d = hops.get(room.id) as number;
    if (d > (hops.get(exit.id) as number) && roomy(room)) exit = room;
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

/** The open combat room nearest the spawn (and holding no key) becomes the safe-zone shop. */
function assignShop(rooms: Room[], spawnRoom: Room, open: ReadonlySet<string>, keyRoomIds: ReadonlySet<string | undefined>): void {
  const from = roomCenter(spawnRoom);
  const dist = (r: Room): number => {
    const c = roomCenter(r);
    return Math.hypot(c.x - from.x, c.y - from.y);
  };
  const candidates = rooms.filter((r) => r.type === 'COMBAT' && open.has(r.id) && !keyRoomIds.has(r.id) && roomy(r));
  candidates.sort((a, b) => dist(a) - dist(b));
  if (candidates.length > 0) candidates[0].type = 'SHOP';
}
