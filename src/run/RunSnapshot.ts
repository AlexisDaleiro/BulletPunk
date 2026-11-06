import type { ComponentMap } from '../ecs/components.ts';
import type { CharacterId } from '../characters/characters.ts';
import { isWeaponId } from '../combat/weapons.ts';
import { ABILITY_UPGRADES } from '../characters/upgrades.ts';
import type { TileChange } from '../game/Level.ts';
import type { RunExperience } from './experience.ts';
import type { KeyColor, NoiseEvent } from '../types.ts';

export const RUN_SAVE_VERSION = 1;
export const WORLD_VERSION = 1;
export const MAX_SAVE_BYTES = 2_000_000;
export const SAVED_COMPONENTS = [
  'transform',
  'health',
  'character',
  'locomotion',
  'noiseEmitter',
  'passiveSynergy',
  'aiController',
  'team',
  'collider',
  'playerControlled',
  'elite',
  'enemyVisual',
  'pickup',
  'interactable',
  'chest',
  'hazard',
  'lifetime',
] as const;
type SavedKey = (typeof SAVED_COMPONENTS)[number];
export interface SavedInventory {
  slots: string[];
  activeSlot: number;
  magazine: number[];
  reserve: (number | null)[];
  reloadTimer: number;
  fireCooldown: number;
}
export interface SavedEntity {
  id: number;
  kind: 'player' | 'enemy' | 'pickup' | 'prop' | 'hazard' | 'vendor' | 'projectile' | 'decoy';
  data: Partial<Pick<ComponentMap, SavedKey>>;
  weapons?: SavedInventory;
  vision?: Omit<ComponentMap['vision'], 'polygon'>;
  aim?: number;
  projectile?: ComponentMap['projectile'];
}
export interface SavedRunMeta {
  runId: string;
  seed: number;
  elapsed: number;
  reportSeq: number;
  generation: number;
  characterId: CharacterId;
  upgradeOptions: string[];
}
export interface RunSnapshot {
  version: number;
  worldVersion: number;
  savedAt: string;
  run: SavedRunMeta;
  level: {
    floor: number;
    credits: number;
    kills: number;
    experience: RunExperience;
    keys: Record<KeyColor, boolean>;
    layoutHash: number;
    width: number;
    height: number;
    pendingFloor: number | null;
    tiles: TileChange[];
    found: string[];
    doors: boolean[];
    obstacleHp: [number, number][];
  };
  entities: SavedEntity[];
  fog: number[];
  noise: { nextId: number; events: NoiseEvent[] };
  environment: { hint: number; alarms: [number, { left: number; pulse: number }][] };
}

export function layoutHash(tiles: readonly string[]): number {
  let hash = 2166136261;
  for (const tile of tiles) for (let i = 0; i < tile.length; i++) hash = Math.imul(hash ^ tile.charCodeAt(i), 16777619);
  return hash >>> 0;
}

/** Validate before allocating any sprites or replacing the live world. Corrupt/old saves stay intact. */
export function parseRunSnapshot(raw: unknown): RunSnapshot {
  const fail = (): never => {
    throw new Error('El guardado está dañado o no es compatible con esta versión del juego.');
  };
  const object = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);
  const number = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 1e12;
  let count = 0;
  const walk = (value: unknown, depth = 0): void => {
    if (++count > 250000 || depth > 22) fail();
    if (typeof value === 'number' && !number(value)) fail();
    if (typeof value === 'string' && value.length > 1024) fail();
    if (Array.isArray(value)) {
      if (value.length > 40000) fail();
      for (const v of value) walk(v, depth + 1);
    } else if (object(value))
      for (const [key, v] of Object.entries(value)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) fail();
        walk(v, depth + 1);
      }
    else if (value !== null && !['number', 'string', 'boolean'].includes(typeof value)) fail();
  };
  walk(raw);
  if (
    !object(raw) ||
    raw.version !== RUN_SAVE_VERSION ||
    raw.worldVersion !== WORLD_VERSION ||
    !object(raw.run) ||
    !object(raw.level) ||
    !Array.isArray(raw.entities)
  )
    fail();
  if (JSON.stringify(raw).length > MAX_SAVE_BYTES) fail();
  const s = raw as unknown as RunSnapshot,
    r = s.run,
    l = s.level;
  const upgrades = new Set(
    ABILITY_UPGRADES.filter((u) => !u.character || u.character === r.characterId).map((u) => u.id),
  );
  if (
    typeof r.runId !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(r.runId) ||
    !['NIX', 'BRASA', 'VECTOR', 'SUTURA', 'VOLT', 'MORSA'].includes(r.characterId) ||
    !number(r.seed) ||
    !Number.isInteger(r.seed) ||
    r.seed < 0 ||
    r.seed > 4294967295 ||
    !number(r.elapsed) ||
    r.elapsed < 0 ||
    !Number.isSafeInteger(r.reportSeq) ||
    r.reportSeq < 0 ||
    !Number.isSafeInteger(r.generation) ||
    r.generation < 0 ||
    !Array.isArray(r.upgradeOptions) ||
    r.upgradeOptions.length > 3 ||
    new Set(r.upgradeOptions).size !== r.upgradeOptions.length ||
    r.upgradeOptions.some((id) => !upgrades.has(id)) ||
    typeof s.savedAt !== 'string' ||
    !Number.isFinite(Date.parse(s.savedAt))
  )
    fail();
  if (
    !Number.isInteger(l.floor) ||
    l.floor < 1 ||
    !number(l.credits) ||
    l.credits < 0 ||
    !Number.isInteger(l.kills) ||
    l.kills < 0 ||
    !object(l.keys) ||
    !['red', 'blue', 'gold'].every((k) => typeof (l.keys as unknown as Record<string, unknown>)[k] === 'boolean') ||
    !object(l.experience) ||
    !['level', 'xp', 'total', 'pending'].every(
      (k) =>
        Number.isSafeInteger((l.experience as unknown as Record<string, number>)[k]) &&
        (l.experience as unknown as Record<string, number>)[k] >= 0,
    ) ||
    l.experience.level < 1 ||
    l.experience.pending >= l.experience.level ||
    !Number.isInteger(l.width) ||
    !Number.isInteger(l.height) ||
    l.width < 8 ||
    l.height < 8 ||
    l.width * l.height > 40000 ||
    !number(l.layoutHash) ||
    !Array.isArray(l.tiles) ||
    !Array.isArray(l.doors) ||
    !Array.isArray(l.found) ||
    !Array.isArray(l.obstacleHp) ||
    !(l.pendingFloor === null || l.pendingFloor === l.floor + 1)
  )
    fail();
  const validTiles = new Set([
    'VOID',
    'FLOOR',
    'WALL',
    'COVER',
    'DOOR_LOCKED',
    'DOOR_UNLOCKED',
    'SECRET_WALL',
    'EXIT_ELEVATOR',
    'RUBBLE',
    'CRATE',
    'BARREL',
    'CONTAINER',
    'MACHINE',
    'WEAK_WALL',
    'SHUTTER',
  ]);
  for (const tile of l.tiles)
    if (
      !object(tile) ||
      !Number.isInteger(tile.x) ||
      !Number.isInteger(tile.y) ||
      tile.x < 0 ||
      tile.y < 0 ||
      tile.x >= l.width ||
      tile.y >= l.height ||
      !validTiles.has(tile.tile)
    )
      fail();
  if (
    l.doors.some((v) => typeof v !== 'boolean') ||
    l.found.some((v) => typeof v !== 'string') ||
    l.obstacleHp.some(
      (v) =>
        !Array.isArray(v) ||
        v.length !== 2 ||
        !Number.isInteger(v[0]) ||
        v[0] < 0 ||
        v[0] >= l.width * l.height ||
        !number(v[1]) ||
        v[1] <= 0,
    )
  )
    fail();
  if (
    !Array.isArray(s.fog) ||
    s.fog.some((i) => !Number.isInteger(i) || i < 0 || i >= l.width * l.height) ||
    !object(s.noise) ||
    !Array.isArray(s.noise.events) ||
    !number(s.noise.nextId) ||
    !object(s.environment) ||
    !number(s.environment.hint) ||
    !Array.isArray(s.environment.alarms)
  )
    fail();
  const ids = new Set<number>();
  let players = 0;
  for (const entity of s.entities) {
    if (
      !object(entity) ||
      !Number.isInteger(entity.id) ||
      entity.id < 0 ||
      ids.has(entity.id) ||
      !object(entity.data) ||
      !['player', 'enemy', 'pickup', 'prop', 'hazard', 'vendor', 'projectile', 'decoy'].includes(entity.kind)
    )
      fail();
    ids.add(entity.id);
    const d = entity.data,
      t = d.transform;
    if (
      !t ||
      !['x', 'y', 'angle', 'vx', 'vy', 'prevX', 'prevY', 'prevAngle'].every((k) => number(t[k as keyof typeof t]))
    )
      fail();
    if (entity.kind === 'player' || entity.kind === 'enemy') {
      if (
        !d.health ||
        !d.locomotion ||
        !d.passiveSynergy ||
        !d.team ||
        !entity.weapons ||
        !entity.vision ||
        !number(d.health.hp) ||
        d.health.hp <= 0 ||
        !number(d.health.maxHp) ||
        d.health.maxHp < d.health.hp ||
        !number(d.health.shield) ||
        !number(d.health.maxShield) ||
        !Array.isArray(d.passiveSynergy.passives) ||
        !object(d.passiveSynergy.stats) ||
        !number(d.locomotion.runSpeed)
      )
        fail();
      if (entity.kind === 'player') {
        players++;
        const c = d.character,
          def = c?.def;
        if (
          !c ||
          !def ||
          def.id !== r.characterId ||
          !isWeaponId(def.weapon) ||
          !object(def.palette) ||
          !object(def.passive?.modifiers) ||
          !object(def.ability) ||
          ![
            def.hp,
            def.shield,
            def.moveSpeed,
            def.color,
            def.ability.duration,
            def.ability.cooldown,
            c.activeRemaining,
            c.cooldownRemaining,
          ].every(number) ||
          !Array.isArray(c.upgrades ?? []) ||
          (c.upgrades ?? []).some((id) => !upgrades.has(id))
        )
          fail();
      } else if (
        !d.aiController ||
        !Array.isArray(d.aiController.path) ||
        !Array.isArray(d.aiController.waypoints) ||
        !d.enemyVisual
      )
        fail();
    }
    if (entity.weapons) {
      const w = entity.weapons;
      if (
        !Array.isArray(w.slots) ||
        !w.slots.length ||
        w.slots.length > 10 ||
        w.slots.some((id) => !isWeaponId(id)) ||
        !Array.isArray(w.magazine) ||
        !Array.isArray(w.reserve) ||
        w.magazine.length !== w.slots.length ||
        w.reserve.length !== w.slots.length ||
        !Number.isInteger(w.activeSlot) ||
        w.activeSlot < 0 ||
        w.activeSlot >= w.slots.length ||
        w.magazine.some((n) => !Number.isInteger(n) || n < 0) ||
        w.reserve.some((n, i) => (n === null ? w.slots[i] !== 'PLASMA_PISTOL' : !number(n) || n < 0)) ||
        !number(w.reloadTimer) ||
        !number(w.fireCooldown)
      )
        fail();
    }
    if (entity.kind === 'pickup' && !d.pickup) fail();
    if (
      entity.kind === 'prop' &&
      (!d.interactable ||
        typeof d.interactable.payload !== 'string' ||
        !['CHEST', 'MEDIC', 'TERMINAL', 'SHOP_ITEM'].includes(d.interactable.kind) ||
        (d.interactable.kind === 'CHEST' && (!d.chest || !number(d.chest.t) || !number(d.chest.seed))))
    )
      fail();
    if (entity.kind === 'hazard' && (!d.hazard || !Array.isArray(d.hazard.hit))) fail();
    if (entity.kind === 'projectile' && (!entity.projectile?.active || !Array.isArray(entity.projectile.hit))) fail();
    if (entity.kind === 'decoy' && !d.lifetime) fail();
  }
  if (players !== 1 || s.entities.length > 2000) fail();
  for (const entity of s.entities) {
    const references = [...(entity.data.hazard?.hit ?? []), ...(entity.projectile?.hit ?? [])];
    if (references.some((id) => !ids.has(id))) fail();
  }
  if (
    s.environment.alarms.some(
      (v) =>
        !Array.isArray(v) ||
        v.length !== 2 ||
        !ids.has(v[0]) ||
        !object(v[1]) ||
        !number(v[1].left) ||
        !number(v[1].pulse),
    )
  )
    fail();
  return structuredClone(s);
}
