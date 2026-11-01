import { TILE_SIZE } from '../config';
import { createRng } from '../core/rng';
import type { World } from '../ecs/World';
import { populateEnemies } from '../entities/enemies';
import { createPickup } from '../entities/pickups';
import { createBreaker, createChest, createMedic, createShopItem, createVendor, type ShopOffer } from '../entities/props';
import type { RenderSystem } from '../systems/RenderSystem';
import { IMPLANTS } from '../shop/implants';
import type { KeyColor, Room } from '../types';
import type { Dungeon } from '../world/DungeonGenerator';
import { roomCenter, shuffled } from '../world/locks';
import type { Point } from '../world/pathfinding';

const T = TILE_SIZE;
const MEDIC_COST = 12;

const tileCenter = (tx: number, ty: number): Point => ({ x: (tx + 0.5) * T, y: (ty + 0.5) * T });

/**
 * Fills a freshly generated floor: bots, keycards, chests, the shop, the secret room's reward and
 * the Access Breaker node. Returns the number of bots. Deterministic per dungeon seed.
 */
export function populateFloor(world: World, renderer: RenderSystem, dungeon: Dungeon): number {
  const { map, rooms, floor } = dungeon;
  const rng = createRng(dungeon.seed ^ 0x51ed270b);
  const taken = new Set<string>();
  const key = (tx: number, ty: number): string => `${tx},${ty}`;
  const roomById = (id: string): Room => rooms.find((r) => r.id === id) as Room;

  /** A free floor tile of `room` (never cover, never one already used), as a world-px point. */
  const spot = (room: Room): Point => {
    for (let tries = 0; tries < 60; tries++) {
      const tx = rng.int(room.x + 1, room.x + room.width - 2);
      const ty = rng.int(room.y + 1, room.y + room.height - 2);
      if (map.get(tx, ty) === 'FLOOR' && !taken.has(key(tx, ty))) {
        taken.add(key(tx, ty));
        return tileCenter(tx, ty);
      }
    }
    const c = roomCenter(room);
    return tileCenter(c.x, c.y);
  };
  const claimCenter = (room: Room): Point => {
    const c = roomCenter(room);
    taken.add(key(c.x, c.y));
    return tileCenter(c.x, c.y);
  };

  const bots = populateEnemies(world, renderer, dungeon);

  // Chests first, so a keycard never lands on the chest's tile.
  for (const room of rooms.filter((r) => r.type === 'CHEST')) {
    const roll = rng.next();
    const tier = roll < 0.55 - 0.05 * floor ? 1 : roll < 0.9 ? 2 : 3;
    const c = claimCenter(room);
    createChest(world, renderer, c.x, c.y, tier);
  }
  for (const [color, roomId] of Object.entries(dungeon.keyRooms) as [KeyColor, string][]) {
    const p = spot(roomById(roomId));
    createPickup(world, renderer, p.x, p.y, { kind: 'KEY', id: color, amount: 1 });
  }

  const secret = rooms.find((r) => r.type === 'SECRET');
  if (secret) {
    const c = claimCenter(secret);
    const prize = rng.chance(0.5) ? IMPLANTS.OVERCLOCK.id : IMPLANTS.RICOCHET_COATING.id;
    createPickup(world, renderer, c.x - 14, c.y, { kind: 'IMPLANT', id: prize, amount: 1 });
    createPickup(world, renderer, c.x + 14, c.y, { kind: 'CREDITS', id: null, amount: 30 + 10 * floor });
  }
  if (dungeon.breakerRoomId) {
    const p = spot(roomById(dungeon.breakerRoomId));
    createBreaker(world, renderer, p.x, p.y);
  }

  const shop = rooms.find((r) => r.type === 'SHOP');
  if (shop) buildShop(world, renderer, shop, shopOffers(rng));
  return bots;
}

/** One implant plus two more picks from implants, weapons and ammo. */
function shopOffers(rng: ReturnType<typeof createRng>): ShopOffer[] {
  const implants: ShopOffer[] = Object.values(IMPLANTS).map((i) => ({ kind: 'IMPLANT', id: i.id, cost: i.cost, label: i.name }));
  const others: ShopOffer[] = [
    { kind: 'WEAPON', id: 'AUTO_SMG', cost: 60, label: 'AUTO-SMG' },
    { kind: 'WEAPON', id: 'NEON_SHOTGUN', cost: 70, label: 'NEON SHOTGUN' },
    { kind: 'WEAPON', id: 'HEAVY_RAILGUN', cost: 110, label: 'HEAVY RAILGUN' },
    { kind: 'AMMO', id: null, cost: 20, label: 'AMMO PACK' },
  ];
  const first = shuffled(implants, rng)[0];
  const rest = shuffled([...others, ...implants.filter((i) => i.id !== first.id)], rng).slice(0, 2);
  return [first, ...rest];
}

/** Vendor kiosk on the back wall, three priced pedestals in a row, a medical station in front. */
function buildShop(world: World, renderer: RenderSystem, room: Room, offers: ShopOffer[]): void {
  const c = roomCenter(room);
  const v = tileCenter(c.x, c.y - 2);
  createVendor(world, renderer, v.x, v.y);
  offers.forEach((offer, i) => {
    const p = tileCenter(c.x + (i - 1) * 2, c.y);
    createShopItem(world, renderer, p.x, p.y, offer);
  });
  const m = tileCenter(c.x, c.y + 2);
  createMedic(world, renderer, m.x, m.y, MEDIC_COST);
}
