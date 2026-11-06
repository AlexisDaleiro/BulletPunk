import { Graphics } from 'pixi.js';
import { createEnemy } from '../entities/enemies';
import { createPickup } from '../entities/pickups';
import {
  createChest,
  createHazard,
  createMedic,
  createShopItem,
  createTerminal,
  createVendor,
} from '../entities/props';
import { createIntent } from '../ecs/components';
import type { ComponentMap } from '../ecs/components';
import type { World } from '../ecs/World';
import { WEAPONS, type WeaponId } from '../combat/weapons';
import { TILE_SIZE } from '../config';
import type { LevelManager } from '../game/LevelManager';
import type { GameState } from '../game/GameState';
import type { ProjectilePool } from '../entities/projectiles';
import type { RenderSystem } from '../systems/RenderSystem';
import type { FogSystem } from '../systems/FogSystem';
import type { EnvironmentSystem } from '../systems/EnvironmentSystem';
import type { NoiseField } from '../noise/NoiseField';
import type { VisionRaycastSystem } from '../systems/VisionRaycastSystem';
import { generateDungeon } from '../world/DungeonGenerator';
import {
  layoutHash,
  parseRunSnapshot,
  RUN_SAVE_VERSION,
  SAVED_COMPONENTS,
  WORLD_VERSION,
  type RunSnapshot,
  type SavedEntity,
  type SavedRunMeta,
} from './RunSnapshot';

export interface SnapshotDeps {
  world: World;
  levels: LevelManager;
  state: GameState;
  pool: ProjectilePool;
  renderer: RenderSystem;
  fog: FogSystem;
  environment: EnvironmentSystem;
  noise: NoiseField;
  vision: VisionRaycastSystem;
}

function kind(world: World, id: number): SavedEntity['kind'] | null {
  if (world.has(id, 'playerControlled')) return 'player';
  if (world.has(id, 'aiController')) return 'enemy';
  if (world.has(id, 'pickup')) return 'pickup';
  if (world.has(id, 'interactable')) return 'prop';
  if (world.has(id, 'hazard')) return 'hazard';
  if (world.get(id, 'projectile')?.active) return 'projectile';
  if (world.has(id, 'lifetime') && world.get(id, 'team')?.team === 'PLAYER') return 'decoy';
  if (
    world.has(id, 'renderable') &&
    world.has(id, 'transform') &&
    world.has(id, 'fogged') &&
    !world.has(id, 'lifetime') &&
    !world.has(id, 'projectile')
  )
    return 'vendor';
  return null;
}

export function captureWorld(deps: SnapshotDeps, run: SavedRunMeta): RunSnapshot {
  const { world, levels, state, fog, environment, noise } = deps,
    level = levels.level;
  if (!level || levels.player === null || (world.get(levels.player, 'health')?.hp ?? 0) <= 0)
    throw new Error('No hay una incursión viva para guardar.');
  const entities: SavedEntity[] = [],
    ids = new Map<number, number>();
  for (const id of world.entities()) {
    const type = kind(world, id);
    if (!type) continue;
    ids.set(id, entities.length);
    entities.push({ id: entities.length, kind: type, data: {} });
  }
  for (const [runtime, logical] of ids) {
    const saved = entities[logical];
    for (const key of SAVED_COMPONENTS) {
      const value = world.get(runtime, key);
      if (value) Object.assign(saved.data, { [key]: structuredClone(value) });
    }
    const weapons = world.get(runtime, 'weaponInventory');
    if (weapons)
      saved.weapons = {
        ...structuredClone(weapons),
        slots: weapons.slots.map((w) => w.id),
        reserve: weapons.reserve.map((n) => (Number.isFinite(n) ? n : null)),
      };
    const vision = world.get(runtime, 'vision');
    if (vision) {
      const { polygon: _polygon, ...data } = vision;
      saved.vision = structuredClone(data);
    }
    const aim = world.get(runtime, 'intent')?.aimAngle;
    if (aim !== undefined) saved.aim = aim;
    if (saved.data.hazard)
      saved.data.hazard.hit = saved.data.hazard.hit.flatMap((id) => (ids.has(id) ? [ids.get(id)!] : []));
    const bullet = world.get(runtime, 'projectile');
    if (bullet?.active)
      saved.projectile = {
        ...structuredClone(bullet),
        hit: bullet.hit.flatMap((id) => (ids.has(id) ? [ids.get(id)!] : [])),
      };
  }
  const events = noise.events.map((e) => ({ ...e, sourceEntityId: String(ids.get(Number(e.sourceEntityId)) ?? -1) }));
  return {
    version: RUN_SAVE_VERSION,
    worldVersion: WORLD_VERSION,
    savedAt: new Date().toISOString(),
    run,
    level: {
      floor: state.floor,
      credits: state.credits,
      kills: state.kills,
      experience: structuredClone(state.experience),
      keys: { ...state.keys },
      layoutHash: level.layoutHash,
      width: level.map.width,
      height: level.map.height,
      pendingFloor: levels.pendingFloor,
      ...level.snapshot(),
    },
    entities,
    fog: fog.snapshot(),
    noise: { nextId: noise.sequence(), events },
    environment: environment.snapshot(ids),
  };
}

export function restoreWorld(deps: SnapshotDeps, raw: unknown): RunSnapshot {
  const s = parseRunSnapshot(raw),
    { world, levels, state, renderer, pool, environment, noise, fog, vision } = deps;
  const floorSeed = s.level.floor === 1 ? s.run.seed : (s.run.seed + (s.level.floor - 1) * 7919) >>> 0;
  const dungeon = generateDungeon(floorSeed, { floor: s.level.floor });
  if (
    dungeon.map.width !== s.level.width ||
    dungeon.map.height !== s.level.height ||
    layoutHash(dungeon.map.tiles) !== s.level.layoutHash ||
    dungeon.doors.length !== s.level.doors.length
  ) {
    throw new Error(
      'El mapa de este guardado pertenece a otra versión. Se conservó la copia para recuperarla con una versión compatible.',
    );
  }
  const player = s.entities.find((e) => e.kind === 'player')!;
  levels.reset();
  levels.restoreFloor(player.data.character!.def, s.run.seed, s.level.floor, s.level.pendingFloor);
  const level = levels.level!;
  level.restore(s.level);
  state.credits = s.level.credits;
  state.kills = s.level.kills;
  state.experience = structuredClone(s.level.experience);
  Object.assign(state.keys, s.level.keys);
  const ids = new Map<number, number>();
  for (const saved of s.entities) {
    const t = saved.data.transform!,
      d = saved.data;
    let id: number;
    switch (saved.kind) {
      case 'player':
        id = levels.player!;
        break;
      case 'enemy':
        id = createEnemy(
          world,
          renderer,
          t.x,
          t.y,
          d.aiController!.homeRoomId,
          d.aiController!.waypoints,
          saved.weapons!.slots[0] as WeaponId,
          s.level.floor,
          !!d.elite,
        );
        break;
      case 'pickup':
        id = createPickup(world, renderer, t.x, t.y, structuredClone(d.pickup!));
        break;
      case 'hazard': {
        const h = d.hazard!;
        id = createHazard(world, renderer, {
          id: `saved-${saved.id}`,
          roomId: '',
          kind: h.kind,
          tx: h.x / TILE_SIZE,
          ty: h.y / TILE_SIZE,
          w: h.w / TILE_SIZE,
          h: h.h / TILE_SIZE,
        });
        break;
      }
      case 'vendor':
        id = createVendor(world, renderer, t.x, t.y);
        break;
      case 'prop': {
        const item = d.interactable!;
        if (item.kind === 'CHEST') {
          const c = d.chest!;
          id = createChest(world, renderer, {
            id: item.payload,
            roomId: '',
            tx: Math.floor(t.x / TILE_SIZE),
            ty: Math.floor(t.y / TILE_SIZE),
            ...c,
          });
        } else if (item.kind === 'MEDIC') id = createMedic(world, renderer, t.x, t.y, item.cost);
        else if (item.kind === 'TERMINAL')
          id = createTerminal(world, renderer, Math.floor(t.x / TILE_SIZE), Math.floor(t.y / TILE_SIZE));
        else {
          const [type, weapon] = item.payload.split(':');
          id = createShopItem(world, renderer, t.x, t.y, {
            kind: type as 'WEAPON' | 'IMPLANT' | 'AMMO',
            id: weapon || null,
            cost: item.cost,
            label: item.label,
          });
        }
        break;
      }
      case 'projectile': {
        const p = saved.projectile!,
          speed = Math.hypot(t.vx, t.vy);
        id = pool.spawn({
          x: t.x,
          y: t.y,
          angle: t.angle,
          speed: Math.max(0.001, speed),
          range: Math.max(0.001, speed * p.life),
          team: p.team,
          damage: p.damage,
          piercing: p.piercing,
          explosive: p.explosive,
          bounces: p.bounces,
          color: p.team === 'PLAYER' ? player.data.character!.def.color : 0xf47680,
        });
        break;
      }
      case 'decoy': {
        id = world.create();
        renderer.attach(
          world,
          id,
          'shadows',
          new Graphics().roundRect(-15, -10, 28, 20, 4).fill({ color: player.data.character!.def.color, alpha: 0.4 }),
        );
        break;
      }
    }
    ids.set(saved.id, id);
    for (const key of SAVED_COMPONENTS) {
      const value = saved.data[key];
      if (value) world.add(id, key, structuredClone(value) as ComponentMap[typeof key]);
    }
    if (saved.weapons) {
      const w = saved.weapons;
      world.add(id, 'weaponInventory', {
        ...structuredClone(w),
        slots: w.slots.map((key) => WEAPONS[key as WeaponId]),
        reserve: w.reserve.map((n) => (n === null ? Infinity : n)),
      });
    }
    if (saved.vision) world.add(id, 'vision', { ...structuredClone(saved.vision), polygon: [] });
    if (saved.aim !== undefined) world.add(id, 'intent', createIntent(saved.aim));
    if (saved.projectile) world.add(id, 'projectile', structuredClone(saved.projectile));
    const node = world.get(id, 'renderable')?.node;
    if (node && saved.data.interactable?.used && saved.data.interactable.kind !== 'CHEST') node.alpha = 0.3;
  }
  for (const id of ids.values()) {
    const hazard = world.get(id, 'hazard');
    if (hazard) hazard.hit = hazard.hit.flatMap((logical) => (ids.has(logical) ? [ids.get(logical)!] : []));
    const projectile = world.get(id, 'projectile');
    if (projectile) projectile.hit = projectile.hit.flatMap((logical) => (ids.has(logical) ? [ids.get(logical)!] : []));
  }
  noise.restore(
    s.noise.events.map((e) => ({ ...e, sourceEntityId: String(ids.get(Number(e.sourceEntityId)) ?? -1) })),
    s.noise.nextId,
  );
  fog.restore(s.fog);
  environment.restore(level, world, s.environment, ids);
  vision.update(world);
  fog.update(world);
  return s;
}
