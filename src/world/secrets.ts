// Secret rooms found by looking: four kinds of hidden entrance, each leaving its own tells in the art
// (the renderer draws the wall side, `addTells` the floor side) and four interiors that tell a small
// story. No code, no ability: anyone can push the panel once they spot it. `.ts` extensions: Node.
import { REWARDS, TILE_SIZE } from '../config.ts';
import type { Rng } from '../core/rng.ts';
import type { Room } from '../types';
import { centerOf, decorPx, freeTiles, light, makeCtx, MV, put, reserve, tileCenterPx, type Ctx } from './layoutKit.ts';
import { addChest, cacheSpot } from './layouts.ts';
import type { DecorKind, Plan, SecretPlan, SecretStory, SecretVariant } from './plan.ts';
import type { DoorSite } from './pockets.ts';
import type { TileMap } from './TileMap.ts';

const T = TILE_SIZE;
/** Index in this list is the variant stored on the SECRET_WALL tile. */
export const SECRET_VARIANTS: readonly SecretVariant[] = ['PANEL', 'VENT', 'CABINET', 'SEAM'];
const STORIES: readonly SecretStory[] = ['CAMP', 'CACHE', 'MARKET', 'ARCHIVE'];

/** Turns the pocket's doorway into a secret wall of a random look and records it. */
export function createSecret(plan: Plan, map: TileMap, site: DoorSite, room: Room, rng: Rng): SecretPlan {
  const variant = SECRET_VARIANTS[rng.int(0, SECRET_VARIANTS.length - 1)];
  const story = STORIES[rng.int(0, STORIES.length - 1)];
  map.setWithVariant(site.wall.x, site.wall.y, 'SECRET_WALL', SECRET_VARIANTS.indexOf(variant));
  const secret: SecretPlan = {
    id: plan.nextId('secret'),
    variant,
    story,
    wall: site.wall,
    approach: site.approach,
    dir: site.dir,
    roomId: room.id,
    hostRoomId: site.hostId,
  };
  plan.secrets.push(secret);
  return secret;
}

/**
 * Floor-side tells, placed at the foot of the wall. They repeat across floors with the same
 * vocabulary: scuff arcs where something slides (panel, cabinet), a slit of light under a seam,
 * rust and loose screws below a vent. The wall face itself is drawn by the tilemap renderer.
 */
export function addTells(plan: Plan, s: SecretPlan): void {
  const a = tileCenterPx(s.approach.x, s.approach.y);
  const ang = Math.atan2(s.dir.dy, s.dir.dx);
  const edge = (k: number): { x: number; y: number } => ({ x: a.x + s.dir.dx * T * k, y: a.y + s.dir.dy * T * k });
  const add = (kind: DecorKind, at: { x: number; y: number }, w: number, h: number, variant = 0): void =>
    void plan.decor.push({ kind, x: at.x, y: at.y, w, h, rot: ang, variant });
  switch (s.variant) {
    case 'PANEL':
      add('DRAG', edge(0.18), T * 0.95, T * 0.55, 0);
      add('MARKS', edge(0.34), T * 0.5, T * 0.2, 1);
      break;
    case 'CABINET':
      add('DRAG', edge(0.3), T * 0.9, T * 0.4, 1);
      add('MARKS', edge(0.1), T * 0.7, T * 0.22, 2);
      break;
    case 'VENT':
      add('STAIN', edge(0.3), T * 0.7, T * 0.5, 3);
      add('DEBRIS', edge(0.05), T * 0.5, T * 0.5, 2);
      break;
    case 'SEAM':
      add('LEAK', edge(0.46), T * 0.86, 4);
      plan.lights.push({ x: edge(0.3).x, y: edge(0.3).y, r: 78, color: 0xffc66b, alpha: 0.11, flicker: false });
      break;
  }
}

function pickTier(rng: Rng, floor: number): 2 | 3 {
  return rng.next() < REWARDS.specialTier(floor)[1] ? 2 : 3;
}

/** Furnishes a secret room: a valuable case, a few props that explain who left it, a warm lamp. */
export function furnishSecret(map: TileMap, plan: Plan, room: Room, s: SecretPlan, rng: Rng): void {
  const c: Ctx = makeCtx(map, room, rng, plan);
  const door = tileCenterPx(s.wall.x, s.wall.y);
  const far = freeTiles(c).sort((p, q) => {
    const dp = Math.hypot((p.x + 0.5) * T - door.x, (p.y + 0.5) * T - door.y);
    const dq = Math.hypot((q.x + 0.5) * T - door.x, (q.y + 0.5) * T - door.y);
    return dq - dp;
  });
  const chest = far[0] ?? centerOf(room);
  addChest(c, chest, 'SPECIAL', pickTier(rng, plan.floor));

  const spot = (): { x: number; y: number } | undefined => freeTiles(c)[0];
  const ctr = centerOf(room);
  const centerPx = tileCenterPx(ctr.x, ctr.y);
  switch (s.story) {
    case 'CAMP': {
      const p = spot();
      if (p) decorPx(c, 'BEDROLL', (p.x + 0.5) * T, (p.y + 0.5) * T, T * 1.5, T * 0.8, 0, rng.int(0, 1) * (Math.PI / 2));
      const q = spot();
      if (q) put(c, q.x, q.y, 'CRATE');
      light(c, ctr.x, ctr.y, 130, 0xffb870, 0.26);
      const cache = cacheSpot(c);
      if (cache) addChest(c, cache, 'SUPPLY', 1, 'CREDITS');
      break;
    }
    case 'CACHE': {
      const p = spot();
      if (p) decorPx(c, 'WRECK', (p.x + 0.5) * T, (p.y + 0.5) * T, T * 1.2, T * 1.2, 0, rng.next() * Math.PI);
      const q = spot();
      if (q) put(c, q.x, q.y, 'MACHINE', MV.BENCH);
      light(c, ctr.x, ctr.y, 120, 0xffd9a0, 0.2, true);
      break;
    }
    case 'MARKET': {
      const p = spot();
      if (p) put(c, p.x, p.y, 'MACHINE', MV.SHELF);
      decorPx(c, 'SIGN', centerPx.x, (room.y - 0.5) * T, T * 1.4, 14, 1, 0, 0xff4fa3);
      light(c, ctr.x, ctr.y, 130, 0xff4fa3, 0.16);
      const cache = cacheSpot(c);
      if (cache) addChest(c, cache, 'SUPPLY', 1, 'AMMO');
      break;
    }
    case 'ARCHIVE': {
      const p = spot();
      if (p) put(c, p.x, p.y, 'MACHINE', MV.RACK);
      decorPx(c, 'LOG', centerPx.x, centerPx.y, T * 0.8, T * 0.5, 0);
      light(c, ctr.x, ctr.y, 120, 0x6fb4ff, 0.22);
      break;
    }
  }
  reserve(c, chest.x, chest.y);
}
