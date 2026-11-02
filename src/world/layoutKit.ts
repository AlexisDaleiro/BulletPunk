// Shared tools for room layouts: a context with "where may I build" rules, a rollback net, and the
// look selectors (machine models) the renderer reads. `.ts` extensions: Node's test runner.
import { TILE_SIZE } from '../config.ts';
import type { Rng } from '../core/rng.ts';
import type { Room, TileType } from '../types';
import type { DecorKind, Plan } from './plan.ts';
import { isSolidTile, type TileMap } from './TileMap.ts';

const T = TILE_SIZE;

/** `MACHINE` tile models. Gameplay treats them all alike (solid, see-through, indestructible). */
export const MV = {
  PRESS: 0, LATHE: 1, GENERATOR: 2, BENCH: 3, ISLAND: 4,
  TANK: 8, SCANNER: 9, LAB_CONSOLE: 10, CENTRIFUGE: 11,
  KIOSK: 12, NOODLE: 13, SHOPFRONT: 14, SEATS: 15, PILLAR: 16,
  SHELF: 20, MED_UNIT: 24, RACK: 28, CONSOLE: 29, DEPOSIT: 32, BUNK: 33,
} as const;

/** CONTAINER paint is variant bits 0-1; bit 4 marks a vertical (north-south) container. */
export const CONTAINER_VERTICAL = 16;

export interface Ctx {
  map: TileMap;
  room: Room;
  rng: Rng;
  plan: Plan;
  /** Walkable tiles just outside the room wall line: its doorways. */
  openings: { x: number; y: number }[];
  /** Room tiles that must stay clear so every doorway works (index = y * width + x). */
  apron: Set<number>;
  reserved: Set<number>;
}

export const idx = (map: TileMap, x: number, y: number): number => y * map.width + x;
export const inRoom = (r: Room, x: number, y: number): boolean => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
export const centerOf = (r: Room): { x: number; y: number } => ({ x: r.x + Math.floor(r.width / 2), y: r.y + Math.floor(r.height / 2) });

/** Tiles touching the room's wall line that lead somewhere: floor corridors, locked doors, shutters, secret walls. */
export function findOpenings(map: TileMap, room: Room): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const consider = (x: number, y: number): void => {
    const t = map.get(x, y);
    if (t !== 'WALL' && t !== 'VOID') out.push({ x, y });
  };
  for (let x = room.x; x < room.x + room.width; x++) {
    consider(x, room.y - 1);
    consider(x, room.y + room.height);
  }
  for (let y = room.y; y < room.y + room.height; y++) {
    consider(room.x - 1, y);
    consider(room.x + room.width, y);
  }
  return out;
}

export function makeCtx(map: TileMap, room: Room, rng: Rng, plan: Plan): Ctx {
  const openings = findOpenings(map, room);
  const apron = new Set<number>();
  for (const o of openings) {
    // Direction into the room: the opening sits just outside one edge.
    const dx = o.x < room.x ? 1 : o.x >= room.x + room.width ? -1 : 0;
    const dy = o.y < room.y ? 1 : o.y >= room.y + room.height ? -1 : 0;
    for (let y = o.y - 1; y <= o.y + 1; y++) {
      for (let x = o.x - 1; x <= o.x + 1; x++) if (inRoom(room, x, y)) apron.add(idx(map, x, y));
    }
    for (const k of [1, 2]) {
      const x = o.x + dx * k;
      const y = o.y + dy * k;
      if (inRoom(room, x, y)) apron.add(idx(map, x, y));
    }
  }
  return { map, room, rng, plan, openings, apron, reserved: new Set() };
}

/** A plain floor tile of the room that may still hold an obstacle. */
export function ok(c: Ctx, x: number, y: number): boolean {
  if (!inRoom(c.room, x, y) || c.map.get(x, y) !== 'FLOOR') return false;
  const i = idx(c.map, x, y);
  return !c.apron.has(i) && !c.reserved.has(i) && !c.plan.claimed.has(i);
}

export function put(c: Ctx, x: number, y: number, tile: TileType, variant = 0): boolean {
  if (!ok(c, x, y)) return false;
  c.map.setWithVariant(x, y, tile, variant);
  c.reserved.add(idx(c.map, x, y));
  return true;
}

/** Keeps a tile free of obstacles without changing it (spawn point, elevator, chest, terminal...). */
export function reserve(c: Ctx, x: number, y: number, w = 1, h = 1): void {
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) c.reserved.add(idx(c.map, tx, ty));
}

/** A defensive spot for bots: must be open floor of this room, and stays free of obstacles. */
export function post(c: Ctx, x: number, y: number): void {
  if (!inRoom(c.room, x, y) || c.map.get(x, y) !== 'FLOOR') return;
  c.plan.addPost(c.room.id, x, y);
  c.reserved.add(idx(c.map, x, y));
}

export function reserveAround(c: Ctx, cx: number, cy: number, radius: number): void {
  reserve(c, cx - radius, cy - radius, radius * 2 + 1, radius * 2 + 1);
}

/** Long/short axes of a room: `at(u, v)` maps (along the long edge, across it) to a tile. */
export interface Axes {
  horiz: boolean;
  long: number;
  short: number;
  at(u: number, v: number): { x: number; y: number };
}

export function axes(room: Room): Axes {
  const horiz = room.width >= room.height;
  return {
    horiz,
    long: horiz ? room.width : room.height,
    short: horiz ? room.height : room.width,
    at: (u, v) => (horiz ? { x: room.x + u, y: room.y + v } : { x: room.x + v, y: room.y + u }),
  };
}

export const tileCenterPx = (tx: number, ty: number): { x: number; y: number } => ({ x: (tx + 0.5) * T, y: (ty + 0.5) * T });

/** Decor whose box is given in tiles (top-left tile, size in tiles). */
export function decor(c: Ctx, kind: DecorKind, tx: number, ty: number, wTiles: number, hTiles: number, variant = 0, rot = 0, color?: number): void {
  c.plan.decor.push({ kind, x: (tx + wTiles / 2) * T, y: (ty + hTiles / 2) * T, w: wTiles * T, h: hTiles * T, rot, variant, color });
}

/** Decor in free px coordinates. */
export function decorPx(c: Ctx, kind: DecorKind, x: number, y: number, w: number, h: number, variant = 0, rot = 0, color?: number): void {
  c.plan.decor.push({ kind, x, y, w, h, rot, variant, color });
}

export function light(c: Ctx, tx: number, ty: number, r: number, color: number, alpha = 0.22, flicker = false): void {
  const p = tileCenterPx(tx, ty);
  c.plan.lights.push({ x: p.x, y: p.y, r, color, alpha, flicker });
}

/** Random tiles of the room that are free to build on, in random order. */
export function freeTiles(c: Ctx, filter?: (x: number, y: number) => boolean): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = c.room.y; y < c.room.y + c.room.height; y++) {
    for (let x = c.room.x; x < c.room.x + c.room.width; x++) if (ok(c, x, y) && (!filter || filter(x, y))) out.push({ x, y });
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = c.rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function touchesSolid(c: Ctx, x: number, y: number): boolean {
  return isSolidTile(c.map.get(x - 1, y)) || isSolidTile(c.map.get(x + 1, y)) || isSolidTile(c.map.get(x, y - 1)) || isSolidTile(c.map.get(x, y + 1));
}

/** Scatters `count` single-tile obstacles that never touch each other (not even diagonally). */
export function scatter(c: Ctx, tile: TileType, count: number, filter?: (x: number, y: number) => boolean): number {
  let placed = 0;
  for (const p of freeTiles(c, filter)) {
    if (placed >= count) break;
    let crowded = false;
    for (let dy = -1; dy <= 1 && !crowded; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = c.map.get(p.x + dx, p.y + dy);
        if (t === 'CRATE' || t === 'BARREL' || t === 'COVER') crowded = true;
      }
    }
    if (!crowded && put(c, p.x, p.y, tile)) placed++;
  }
  return placed;
}

interface Snapshot {
  tiles: TileType[];
  variants: number[];
  reserved: number[];
  plan: number[];
  posts: string;
}

function snapshot(c: Ctx): Snapshot {
  const { room, map } = c;
  const tiles: TileType[] = [];
  const variants: number[] = [];
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      tiles.push(map.get(x, y));
      variants.push(map.variant(x, y));
    }
  }
  return { tiles, variants, reserved: [...c.reserved], plan: c.plan.mark(), posts: JSON.stringify(c.plan.posts[room.id] ?? []) };
}

function restore(c: Ctx, s: Snapshot): void {
  const { room, map } = c;
  let i = 0;
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++, i++) map.setWithVariant(x, y, s.tiles[i], s.variants[i]);
  }
  c.reserved.clear();
  for (const r of s.reserved) c.reserved.add(r);
  c.plan.rollback(s.plan);
  c.plan.posts[room.id] = JSON.parse(s.posts) as { tx: number; ty: number }[];
}

/**
 * Every walkable tile of the room, and every doorway, must be reachable from the first doorway
 * without leaving the room, and obstacles may not eat more than `maxFill` of the floor. Locked
 * doors, shutters and secret walls count as passable here: they are the room's real entrances.
 */
export function layoutIsWalkable(c: Ctx, maxFill = 0.5): boolean {
  const { map, room } = c;
  const passable = (x: number, y: number): boolean => {
    const t = map.get(x, y);
    return !isSolidTile(t) || t === 'DOOR_LOCKED' || t === 'SHUTTER' || t === 'SECRET_WALL';
  };
  const seen = new Set<number>();
  const start = c.openings[0] ?? centerOf(room);
  const stack = [start];
  seen.add(idx(map, start.x, start.y));
  while (stack.length > 0) {
    const p = stack.pop() as { x: number; y: number };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = p.x + dx;
      const y = p.y + dy;
      const near = inRoom(room, x, y) || c.openings.some((o) => o.x === x && o.y === y);
      if (!near || !passable(x, y) || seen.has(idx(map, x, y))) continue;
      seen.add(idx(map, x, y));
      stack.push({ x, y });
    }
  }
  let open = 0;
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      if (!passable(x, y)) continue;
      open++;
      if (!seen.has(idx(map, x, y))) return false;
    }
  }
  if (c.openings.some((o) => !seen.has(idx(map, o.x, o.y)))) return false;
  return open >= room.width * room.height * (1 - maxFill);
}

/** Runs `build`; if the room ends up cut in pieces or choked, undoes everything and runs `fallback`. */
export function applyLayout(c: Ctx, build: (c: Ctx) => void, fallback: (c: Ctx) => void): void {
  const snap = snapshot(c);
  build(c);
  if (layoutIsWalkable(c)) return;
  restore(c, snap);
  fallback(c);
}
