// Playability checks for a generated floor, used by the tests (and handy from the console):
// walks the floor the way a player would and reports everything that would strand or cheat them.
// `.ts` extensions: Node's test runner.
import { TILE_SIZE } from '../config.ts';
import type { Dungeon } from './DungeonGenerator.ts';
import { roomCenter } from './locks.ts';
import type { TileMap } from './TileMap.ts';

/** Tiles reachable on foot from (sx, sy); tiles in `opened` count as walkable even if solid. */
export function reachableTiles(map: TileMap, sx: number, sy: number, opened: ReadonlySet<number> = new Set()): Uint8Array {
  const seen = new Uint8Array(map.width * map.height);
  const stack = [sy * map.width + sx];
  seen[stack[0]] = 1;
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const x = i % map.width;
    const y = (i - x) / map.width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const j = ny * map.width + nx;
      if (seen[j] || (map.isSolid(nx, ny) && !opened.has(j))) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  return seen;
}

/** Everything that is closed at the start of a floor: locked doors, shutters and secret walls. */
export function gatesOf(d: Dungeon): Set<number> {
  const out = new Set<number>();
  for (const door of d.doors) for (const t of door.tiles) out.add(t.y * d.map.width + t.x);
  for (const s of d.plan.shutters) for (const t of s.tiles) out.add(t.y * d.map.width + t.x);
  for (const s of d.plan.secrets) out.add(s.wall.y * d.map.width + s.wall.x);
  return out;
}

/** Returns a list of human-readable problems; empty means the floor is sound. */
export function validateDungeon(d: Dungeon): string[] {
  const problems: string[] = [];
  const { map, plan } = d;
  const w = map.width;
  const at = (x: number, y: number): number => y * w + x;
  const sx = Math.floor(d.spawn.x / TILE_SIZE);
  const sy = Math.floor(d.spawn.y / TILE_SIZE);
  if (map.isSolid(sx, sy)) problems.push('spawn is inside an obstacle');

  const start = reachableTiles(map, sx, sy);
  const full = reachableTiles(map, sx, sy, gatesOf(d));
  const tileOk = (label: string, x: number, y: number, view: Uint8Array): void => {
    if (!map.inBounds(x, y) || map.isSolid(x, y)) problems.push(`${label} at ${x},${y} sits in a ${map.get(x, y)}`);
    else if (!view[at(x, y)]) problems.push(`${label} at ${x},${y} is unreachable`);
  };

  // Rooms: every room is reachable once every gate is open; the always-open ones without opening anything.
  const gatedRooms = new Set<string>([...d.doors.map((x) => x.sealedRoomId), ...plan.shutters.map((x) => x.roomId), ...plan.secrets.map((x) => x.roomId)]);
  for (const r of d.rooms) {
    const free: { x: number; y: number }[] = [];
    for (let y = r.y; y < r.y + r.height; y++) for (let x = r.x; x < r.x + r.width; x++) if (!map.isSolid(x, y)) free.push({ x, y });
    if (free.length > 0 && !free.some((p) => full[at(p.x, p.y)])) problems.push(`${r.id} (${r.kind}) cannot be reached even with every gate open`);
    if (!gatedRooms.has(r.id) && free.length > 0 && !free.some((p) => start[at(p.x, p.y)])) problems.push(`${r.id} (${r.kind}) is cut off without a gate`);
    // Obstacles never leave an isolated walkable pocket inside a room.
    for (const p of free) if (!full[at(p.x, p.y)]) problems.push(`${r.id} (${r.kind}) has a walled-in floor tile at ${p.x},${p.y}`);
  }

  const chestTiles = new Set<number>();
  for (const ch of plan.chests) {
    const gated = gatedRooms.has(ch.roomId);
    tileOk(`chest ${ch.id}`, ch.tx, ch.ty, gated ? full : start);
    if (chestTiles.has(at(ch.tx, ch.ty))) problems.push(`two chests share ${ch.tx},${ch.ty}`);
    chestTiles.add(at(ch.tx, ch.ty));
    if (ch.family === 'SUPPLY' && ch.tier !== 1) problems.push(`supply ${ch.id} has tier ${ch.tier}`);
    if (ch.family === 'SPECIAL' && ch.category !== 'GEAR') problems.push(`special ${ch.id} holds ${ch.category}`);
  }
  for (const t of plan.terminals) tileOk(`terminal ${t.id}`, t.tx, t.ty, start);
  for (const m of plan.medics) tileOk('medic', m.tx, m.ty, start);
  for (const h of plan.hazards) {
    for (let y = h.ty; y < h.ty + h.h; y++) for (let x = h.tx; x < h.tx + h.w; x++) tileOk(`hazard ${h.id}`, x, y, full);
  }
  for (const [roomId, posts] of Object.entries(plan.posts)) for (const p of posts) tileOk(`post of ${roomId}`, p.tx, p.ty, full);
  tileOk('elevator', d.elevator.x, d.elevator.y, full);
  if (map.get(d.elevator.x, d.elevator.y) !== 'EXIT_ELEVATOR') problems.push('elevator tile was overwritten');

  for (const s of plan.secrets) {
    if (map.get(s.wall.x, s.wall.y) !== 'SECRET_WALL') problems.push(`secret ${s.id}: wall tile is ${map.get(s.wall.x, s.wall.y)}`);
    tileOk(`secret ${s.id} approach`, s.approach.x, s.approach.y, start);
    const inside = d.rooms.find((r) => r.id === s.roomId);
    if (!inside || !plan.chests.some((c) => c.roomId === s.roomId && c.family === 'SPECIAL')) problems.push(`secret ${s.id}: no valuable case inside`);
    else {
      const c = roomCenter(inside);
      if (start[at(c.x, c.y)]) problems.push(`secret ${s.id}: room is open from the start`);
    }
  }
  for (const sh of plan.shutters) {
    if (!plan.terminals.length) problems.push(`shutter ${sh.id}: no terminal on the floor`);
    for (const t of sh.tiles) if (map.get(t.x, t.y) !== 'SHUTTER') problems.push(`shutter ${sh.id}: tile is ${map.get(t.x, t.y)}`);
  }
  if (plan.hazards.some((h) => h.kind === 'LASER') && !plan.terminals.length) problems.push('tripwire without a terminal to disarm it');
  if (!plan.chests.some((c) => c.family === 'SUPPLY')) problems.push('floor has no supply cache');
  return problems;
}
