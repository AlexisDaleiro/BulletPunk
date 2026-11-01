import { createWeaponInventory, type WeaponId } from '../combat/weapons';
import { COLORS, ENEMY, PLAYER_COLLIDER_HALF, TILE_SIZE } from '../config';
import { createRng, type Rng } from '../core/rng';
import {
  createAIController,
  createHealth,
  createIntent,
  createLocomotion,
  createNoiseEmitter,
  createPassiveSynergy,
  createTransform,
} from '../ecs/components';
import type { Entity, World } from '../ecs/World';
import type { RenderSystem } from '../systems/RenderSystem';
import type { Room } from '../types';
import type { Dungeon } from '../world/DungeonGenerator';
import type { Point } from '../world/pathfinding';
import type { TileMap } from '../world/TileMap';
import { createOperativeGraphic } from './player';

/** Bots keep clear of the spawn room by this many tiles so the player is not shot on arrival. */
const SAFE_TILES = 6;

export function createEnemy(
  world: World,
  renderer: RenderSystem,
  x: number,
  y: number,
  roomId: string,
  waypoints: Point[],
  weapon: WeaponId,
): Entity {
  const enemy = world.create();
  // Softer damage and fire rate come from the same passives mechanism the player's implants use.
  const passives = createPassiveSynergy();
  passives.stats.damageMult = ENEMY.damageMult;
  passives.stats.fireRateMult = ENEMY.fireRateMult;

  world
    .add(enemy, 'transform', createTransform(x, y, Math.random() * Math.PI * 2))
    .add(enemy, 'intent', createIntent())
    .add(enemy, 'locomotion', { ...createLocomotion(), runSpeed: ENEMY.runSpeed, turnRate: ENEMY.turnRate })
    .add(enemy, 'health', createHealth(ENEMY.hp, 0))
    .add(enemy, 'noiseEmitter', createNoiseEmitter())
    .add(enemy, 'passiveSynergy', passives)
    .add(enemy, 'weaponInventory', createWeaponInventory([weapon]))
    .add(enemy, 'vision', { fov: ENEMY.fov, range: ENEMY.range, proximityRadius: 0, polygon: [] })
    .add(enemy, 'collider', { halfSize: PLAYER_COLLIDER_HALF })
    .add(enemy, 'team', { team: 'ENEMY' })
    .add(enemy, 'fogged', {})
    .add(enemy, 'aiController', createAIController(roomId, waypoints));
  renderer.attach(world, enemy, 'entities', createOperativeGraphic(COLORS.red));
  return enemy;
}

/** 1-3 bots in every room but the spawn room (3 guard the exit). Deterministic per dungeon seed. */
export function populateEnemies(world: World, renderer: RenderSystem, dungeon: Dungeon): number {
  const rng = createRng(dungeon.seed ^ 0x9e3779b9);
  let count = 0;
  for (const room of dungeon.rooms) {
    if (room.type === 'SPAWN') continue;
    const n = room.type === 'EXIT' ? 3 : rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      const spot = randomFloor(dungeon.map, room, rng, dungeon.spawn);
      const waypoints = [spot, randomFloor(dungeon.map, room, rng), randomFloor(dungeon.map, room, rng)];
      const roll = rng.next();
      const weapon: WeaponId = roll < 0.65 ? 'PLASMA_PISTOL' : roll < 0.9 ? 'AUTO_SMG' : 'NEON_SHOTGUN';
      createEnemy(world, renderer, spot.x, spot.y, room.id, waypoints, weapon);
      count++;
    }
  }
  return count;
}

/** A random open floor tile of `room` (never cover), as a world-px point; optionally far from `avoid`. */
function randomFloor(map: TileMap, room: Room, rng: Rng, avoid?: Point): Point {
  const T = TILE_SIZE;
  for (let tries = 0; tries < 40; tries++) {
    const tx = rng.int(room.x + 1, room.x + room.width - 2);
    const ty = rng.int(room.y + 1, room.y + room.height - 2);
    if (map.get(tx, ty) !== 'FLOOR') continue;
    const p = { x: (tx + 0.5) * T, y: (ty + 0.5) * T };
    if (avoid && Math.hypot(p.x - avoid.x, p.y - avoid.y) < SAFE_TILES * T) continue;
    return p;
  }
  return { x: (room.x + Math.floor(room.width / 2) + 0.5) * T, y: (room.y + Math.floor(room.height / 2) + 0.5) * T };
}
