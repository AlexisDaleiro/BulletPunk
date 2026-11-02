// Spreads the three identities (military, urban, abandoned lab) over the floor and gives every room
// a function. Pure and seeded. `.ts` extensions: Node's test runner.
import type { Rng } from '../core/rng.ts';
import type { Room, RoomKind, Sector } from '../types';
import { roomCenter, shuffled } from './locks.ts';

const SECTORS: readonly Sector[] = ['MILITARY', 'URBAN', 'LAB'];

/** What each sector builds in its big and small rooms (repeats weight the pick). */
const KINDS: Record<Sector, { big: readonly RoomKind[]; small: readonly RoomKind[] }> = {
  MILITARY: { big: ['DEPOT', 'WORKSHOP', 'SECURITY'], small: ['SUPPLY', 'TECH', 'SECURITY'] },
  URBAN: { big: ['MARKET', 'MARKET', 'DEPOT'], small: ['SUPPLY', 'TECH', 'MEDICAL'] },
  LAB: { big: ['LAB', 'LAB', 'WORKSHOP'], small: ['MEDICAL', 'SUPPLY', 'TECH'] },
};

const area = (r: Room): number => r.width * r.height;
/** Narrow and long: a service passage rather than a room. */
export const isElongated = (r: Room): boolean => Math.min(r.width, r.height) <= 5 && Math.max(r.width, r.height) >= 9;

/**
 * Three anchor rooms, far apart, each seeds one sector; every room joins the nearest anchor. Zones
 * come out contiguous, so walking from one to the next changes the material language.
 */
export function assignSectors(rooms: Room[], rng: Rng): void {
  const centers = rooms.map(roomCenter);
  const dist = (a: number, b: number): number => Math.hypot(centers[a].x - centers[b].x, centers[a].y - centers[b].y);
  const anchors = [rng.int(0, rooms.length - 1)];
  while (anchors.length < Math.min(3, rooms.length)) {
    let best = -1;
    let bestD = -1;
    for (let i = 0; i < rooms.length; i++) {
      const d = Math.min(...anchors.map((a) => dist(i, a)));
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    anchors.push(best);
  }
  const sectors = shuffled(SECTORS, rng);
  rooms.forEach((room, i) => {
    let nearest = 0;
    for (let k = 1; k < anchors.length; k++) if (dist(i, anchors[k]) < dist(i, anchors[nearest])) nearest = k;
    room.sector = sectors[nearest];
  });
}

/**
 * Function of every room. Progression rooms keep their role (entry, extraction, shop, vault);
 * combat rooms follow the shape (long and thin = service passage; small = utility) and the sector.
 * Then the floor is topped up so supply, repairs and a terminal always exist.
 */
export function assignKinds(rooms: Room[], floor: number, rng: Rng): void {
  const combat: Room[] = [];
  for (const r of rooms) {
    if (r.type === 'SPAWN') r.kind = 'ENTRY';
    else if (r.type === 'EXIT') r.kind = 'EXTRACTION';
    else if (r.type === 'SHOP') r.kind = 'SHOP';
    else if (r.type === 'CHEST') r.kind = 'VAULT';
    else if (r.type === 'COMBAT') {
      combat.push(r);
      const pool = isElongated(r) ? (['SERVICE'] as const) : area(r) <= 64 ? KINDS[r.sector].small : KINDS[r.sector].big;
      r.kind = pool[rng.int(0, pool.length - 1)];
    }
  }

  const count = (k: RoomKind): number => combat.filter((r) => r.kind === k).length;
  const need: [RoomKind, number][] = [['SUPPLY', combat.length >= 7 ? 2 : 1], ['TECH', 1]];
  if (floor >= 2) need.push(['MEDICAL', 1]);
  for (const [kind, min] of need) {
    // Convert the smallest rooms that are not already something we need.
    const donors = combat
      .filter((r) => !isElongated(r) && !need.some(([k]) => k === r.kind))
      .sort((a, b) => area(a) - area(b));
    while (count(kind) < min && donors.length > 0) (donors.shift() as Room).kind = kind;
  }
}
