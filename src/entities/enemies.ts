import { createWeaponInventory, WEAPONS, type WeaponId } from '../combat/weapons';
import { DIFFICULTY, ENEMY, PLAYER_COLLIDER_HALF, ROOM_ENEMIES, TILE_SIZE } from '../config';
import { enemyAppearance, ENEMY_APPEARANCES } from '../characters/enemyAppearances';
import { ELITE, eliteRoom, elitePosition } from '../characters/elite';
import { HostileGraphic } from '../characters/HostileGraphic';
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
  floor = 1,
  elite = false,
): Entity {
  const enemy = world.create();
  const appearance = elite ? ENEMY_APPEARANCES.BASTION : enemyAppearance(WEAPONS[weapon].type);
  // Softer damage and fire rate come from the same passives mechanism the player's implants use.
  // Deeper floors harden both, and give bots more HP.
  const passives = createPassiveSynergy();
  passives.stats.damageMult = Math.min(0.9, ENEMY.damageMult + DIFFICULTY.damagePerFloor * (floor - 1));
  passives.stats.fireRateMult = ENEMY.fireRateMult;
  if (elite) passives.stats.damageMult *= ELITE.damageMult;
  const hp = elite ? ELITE.hp : ENEMY.hp;

  world
    .add(enemy, 'transform', createTransform(x, y, Math.random() * Math.PI * 2))
    .add(enemy, 'enemyVisual', { appearance, recoil: 0 })
    .add(enemy, 'intent', createIntent())
    .add(enemy, 'locomotion', { ...createLocomotion(), runSpeed: ENEMY.runSpeed * (elite ? ELITE.speedMult : 1), turnRate: ENEMY.turnRate })
    .add(enemy, 'health', createHealth(Math.round(hp * (1 + DIFFICULTY.hpPerFloor * (floor - 1))), elite ? ELITE.shield : 0))
    .add(enemy, 'noiseEmitter', createNoiseEmitter())
    .add(enemy, 'passiveSynergy', passives)
    .add(enemy, 'weaponInventory', createWeaponInventory([weapon]))
    .add(enemy, 'vision', { fov: ENEMY.fov, range: ENEMY.range, proximityRadius: 0, polygon: [] })
    .add(enemy, 'collider', { halfSize: PLAYER_COLLIDER_HALF })
    .add(enemy, 'team', { team: 'ENEMY' })
    .add(enemy, 'fogged', {})
    .add(enemy, 'aiController', createAIController(roomId, waypoints));
  if (elite) world.add(enemy, 'elite', { bonusCredits: ELITE.bonusCredits });
  renderer.attach(world, enemy, 'entities', new HostileGraphic(appearance, WEAPONS[weapon], renderer.renderer));
  return enemy;
}

/**
 * Bots per room follow its function (security posts and the extraction zone are the busiest, medical
 * bays and utility rooms the quietest), plus one more per room from floor 3. Spawn, shop, vault and
 * secret rooms stay empty. Defensive posts planned by the layout are filled first. Deterministic per seed.
 */
export function populateEnemies(world: World, renderer: RenderSystem, dungeon: Dungeon): number {
  const rng = createRng(dungeon.seed ^ 0x9e3779b9);
  const extra = dungeon.floor >= DIFFICULTY.extraBotsFromFloor ? 1 : 0;
  let count = 0;
  const championRoom = eliteRoom(dungeon.rooms, dungeon.spawn);
  for (const room of dungeon.rooms) {
    if (room.type !== 'COMBAT' && room.type !== 'EXIT') continue;
    const [lo, hi] = ROOM_ENEMIES[room.kind];
    const n = rng.int(lo, hi) + (hi > 0 ? extra : 0);
    const posts = (dungeon.plan.posts[room.id] ?? []).map((p) => ({ x: (p.tx + 0.5) * TILE_SIZE, y: (p.ty + 0.5) * TILE_SIZE }));
    for (let i = 0; i < n; i++) {
      const elite = i === 0 && room.id === championRoom?.id;
      const spot = (elite ? elitePosition(dungeon, room) : undefined) ?? posts[i] ?? randomFloor(dungeon.map, room, rng, dungeon.spawn);
      const waypoints = elite || posts[i] ? [spot, spot] : [spot, randomFloor(dungeon.map, room, rng), randomFloor(dungeon.map, room, rng)];
      const roll = rng.next();
      const smg = DIFFICULTY.smgChance(dungeon.floor);
      const shotgun = DIFFICULTY.shotgunChance(dungeon.floor);
      const weapon: WeaponId = elite ? ELITE.weapon : roll < 1 - smg - shotgun ? 'PLASMA_PISTOL' : roll < 1 - shotgun ? 'AUTO_SMG' : 'NEON_SHOTGUN';
      createEnemy(world, renderer, spot.x, spot.y, room.id, waypoints, weapon, dungeon.floor, elite);
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
