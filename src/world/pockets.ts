// Small side spaces carved off an existing room: closets, shutter vaults and secret rooms all start
// as a "pocket" with one doorway. A pocket either fills unused map space next to a room (wall
// between), or is walled off a corner inside a big room. `.ts` extensions: Node's test runner.
import type { Room, RoomKind, TileType } from '../types';
import { findOpenings, idx } from './layoutKit.ts';
import type { Plan } from './plan.ts';
import type { TileMap } from './TileMap.ts';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const MIN_SIDE = 3;
const MAX_SIDE = 5;

export interface DoorSite {
  /** The wall tile that becomes the doorway. */
  wall: { x: number; y: number };
  /** Host floor tile in front of it. */
  approach: { x: number; y: number };
  /** Step from the approach tile into the wall. */
  dir: { dx: number; dy: number };
  hostId: string;
}

export interface Pocket {
  x: number;
  y: number;
  w: number;
  h: number;
  sites: DoorSite[];
  /** Walled off inside a room (true) or built in free map space (false). */
  corner: boolean;
  /** Corner pockets: the L-shaped wall that closes them off. */
  wallTiles: { x: number; y: number }[];
}

const insideRect = (x: number, y: number, p: { x: number; y: number; w: number; h: number }): boolean =>
  x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h;

/** Rectangle plus a 1-tile border holding only void and wall: nothing to collide with. */
function ringIsEmpty(map: TileMap, plan: Plan, x: number, y: number, w: number, h: number): boolean {
  for (let ty = y - 1; ty <= y + h; ty++) {
    for (let tx = x - 1; tx <= x + w; tx++) {
      const t = map.get(tx, ty);
      if ((t !== 'VOID' && t !== 'WALL') || plan.claimed.has(idx(map, tx, ty))) return false;
    }
  }
  return true;
}

function voidSites(map: TileMap, hosts: readonly Room[], p: Pocket): DoorSite[] {
  const byHost = new Map<string, DoorSite>();
  for (let sy = p.y; sy < p.y + p.h; sy++) {
    for (let sx = p.x; sx < p.x + p.w; sx++) {
      for (const [dx, dy] of DIRS) {
        const mx = sx + dx;
        const my = sy + dy;
        if (insideRect(mx, my, p) || map.get(mx, my) !== 'WALL') continue;
        const fx = sx + 2 * dx;
        const fy = sy + 2 * dy;
        if (map.get(fx, fy) !== 'FLOOR') continue;
        const host = hosts.find((r) => fx >= r.x && fx < r.x + r.width && fy >= r.y && fy < r.y + r.height);
        if (host && !byHost.has(host.id)) byHost.set(host.id, { wall: { x: mx, y: my }, approach: { x: fx, y: fy }, dir: { dx: -dx, dy: -dy }, hostId: host.id });
      }
    }
  }
  return [...byHost.values()];
}

/** Every free-space spot (3-5 tiles a side) that touches at least one host room through a single wall. */
export function findVoidPockets(map: TileMap, plan: Plan, hosts: readonly Room[]): Pocket[] {
  const found: Pocket[] = [];
  for (let w = MIN_SIDE; w <= MAX_SIDE; w++) {
    for (let h = MIN_SIDE; h <= MAX_SIDE; h++) {
      for (let y = 2; y <= map.height - h - 2; y++) {
        for (let x = 2; x <= map.width - w - 2; x++) {
          if (!ringIsEmpty(map, plan, x, y, w, h)) continue;
          const pocket: Pocket = { x, y, w, h, sites: [], corner: false, wallTiles: [] };
          pocket.sites = voidSites(map, hosts, pocket);
          if (pocket.sites.length > 0) found.push(pocket);
        }
      }
    }
  }
  return found;
}

/** 3x3 corners of big rooms that can be walled off without touching any doorway. */
export function findCornerPockets(map: TileMap, plan: Plan, hosts: readonly Room[]): Pocket[] {
  const found: Pocket[] = [];
  for (const room of hosts) {
    if (room.width < 9 || room.height < 9) continue;
    const openings = findOpenings(map, room);
    for (const cx of [0, 1]) {
      for (const cy of [0, 1]) {
        const x0 = cx === 0 ? room.x : room.x + room.width - 3;
        const y0 = cy === 0 ? room.y : room.y + room.height - 3;
        const xw = cx === 0 ? x0 + 3 : x0 - 1;
        const yw = cy === 0 ? y0 + 3 : y0 - 1;
        const wallTiles: { x: number; y: number }[] = [];
        for (let y = Math.min(y0, yw); y <= Math.max(y0 + 2, yw); y++) wallTiles.push({ x: xw, y });
        for (let x = Math.min(x0, xw); x <= Math.max(x0 + 2, xw); x++) if (x !== xw) wallTiles.push({ x, y: yw });
        const minX = Math.min(x0, xw) - 1;
        const maxX = Math.max(x0 + 2, xw) + 1;
        const minY = Math.min(y0, yw) - 1;
        const maxY = Math.max(y0 + 2, yw) + 1;
        if (openings.some((o) => o.x >= minX && o.x <= maxX && o.y >= minY && o.y <= maxY)) continue;
        const tiles = [...wallTiles];
        for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 3; x++) tiles.push({ x, y });
        if (tiles.some((t) => map.get(t.x, t.y) !== 'FLOOR' || plan.claimed.has(idx(map, t.x, t.y)))) continue;
        const sx = cx === 0 ? 1 : -1;
        const sy = cy === 0 ? 1 : -1;
        found.push({
          x: x0, y: y0, w: 3, h: 3, corner: true, wallTiles,
          sites: [
            { wall: { x: xw, y: y0 + 1 }, approach: { x: xw + sx, y: y0 + 1 }, dir: { dx: -sx, dy: 0 }, hostId: room.id },
            { wall: { x: x0 + 1, y: yw }, approach: { x: x0 + 1, y: yw + sy }, dir: { dx: 0, dy: -sy }, hostId: room.id },
          ],
        });
      }
    }
  }
  return found;
}

/**
 * Builds the pocket as a new room. `doorTile` is what stands in the doorway (open floor, a shutter
 * or a secret wall). Everything it touches is claimed so no other layout builds there.
 */
export function commitPocket(
  map: TileMap,
  rooms: Room[],
  plan: Plan,
  pocket: Pocket,
  site: DoorSite,
  doorTile: TileType,
  type: Room['type'],
  kind: RoomKind,
): Room {
  const claim = (x: number, y: number): void => void plan.claimed.add(idx(map, x, y));
  for (let y = pocket.y; y < pocket.y + pocket.h; y++) {
    for (let x = pocket.x; x < pocket.x + pocket.w; x++) {
      map.set(x, y, 'FLOOR');
      claim(x, y);
    }
  }
  if (pocket.corner) {
    for (const t of pocket.wallTiles) {
      map.set(t.x, t.y, 'WALL');
      claim(t.x, t.y);
    }
  } else {
    for (let y = pocket.y - 1; y <= pocket.y + pocket.h; y++) {
      for (let x = pocket.x - 1; x <= pocket.x + pocket.w; x++) {
        if (insideRect(x, y, pocket)) continue;
        if (map.get(x, y) === 'VOID') map.set(x, y, 'WALL');
        claim(x, y);
      }
    }
  }
  map.set(site.wall.x, site.wall.y, doorTile);
  claim(site.wall.x, site.wall.y);
  claim(site.approach.x, site.approach.y);
  const host = rooms.find((r) => r.id === site.hostId) as Room;
  const room: Room = {
    id: `room-${rooms.length}`,
    x: pocket.x,
    y: pocket.y,
    width: pocket.w,
    height: pocket.h,
    type,
    kind,
    sector: host.sector,
    connectedRoomIds: [host.id],
    cleared: false,
  };
  rooms.push(room);
  return room;
}
