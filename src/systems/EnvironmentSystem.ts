import type { SoundManager } from '../audio/SoundManager';
import { applyDamage } from '../combat/damage';
import { COLORS, DESTRUCTIBLE, HAZARDS, TILE_SIZE } from '../config';
import type { HazardComponent } from '../ecs/components';
import type { System } from '../ecs/System';
import type { Entity, World } from '../ecs/World';
import { spawnDebris, spawnFlash } from '../entities/effects';
import { createPickup } from '../entities/pickups';
import type { Level } from '../game/Level';
import type { GameState } from '../game/GameState';
import type { NoiseField } from '../noise/NoiseField';
import type { ChestGraphic } from '../render/chestGraphic';
import type { TileType } from '../types';
import type { RenderSystem } from './RenderSystem';

const T = TILE_SIZE;
/** Seconds the chest lid takes to finish lifting before the case counts as looted. */
const OPEN_TIME = 0.5;
/** Hidden rooms announce themselves from this far (tiles), no farther. */
const HINT_RANGE = 6 * T;
const HINT_EVERY = 2.8;
/** Chance a smashed crate spills a few credits. */
const CRATE_LOOT = 0.22;

interface Alarm {
  left: number;
  pulse: number;
}

/**
 * Everything on the floor that reacts: chests lifting their lids, destroyed obstacles (crates spill,
 * barrels blow up and hurt whoever stands near), shock plates, toxic puddles, tripwires and the
 * soft sounds that give hidden rooms away. Obstacles only ever disappear, so pathfinding, collision
 * and sight lines all follow the map and nothing needs repair afterwards.
 */
export class EnvironmentSystem implements System {
  /** Current floor; set by the LevelManager. */
  level: Level | null = null;
  private hooked: Level | null = null;
  private world: World | null = null;
  private hint = 0;
  private readonly alarms = new Map<Entity, Alarm>();
  private readonly renderer: RenderSystem;
  private readonly field: NoiseField;
  private readonly audio: SoundManager;
  private readonly state: GameState;

  constructor(renderer: RenderSystem, field: NoiseField, audio: SoundManager, state: GameState) {
    this.renderer = renderer;
    this.field = field;
    this.audio = audio;
    this.state = state;
  }

  update(world: World, dt: number): void {
    this.world = world;
    const level = this.level;
    if (!level) return;
    if (level !== this.hooked) this.hook(level);
    level.tick(dt);

    world.each(['chest', 'renderable'], (_e, c, r) => {
      if (c.state === 'OPENING') {
        c.t += dt;
        if (c.t >= OPEN_TIME) c.state = 'LOOTED';
      }
      (r.node as ChestGraphic).animate(c.state, c.t, dt);
    });

    let player: { entity: Entity; x: number; y: number } | null = null;
    world.each(['playerControlled', 'transform', 'health'], (entity, _tag, t, h) => {
      if (h.hp > 0) player = { entity, x: t.x, y: t.y };
    });
    world.each(['hazard', 'renderable'], (entity, h, r) => this.hazard(world, entity, h, r.node, dt, player));
    if (player) this.hints(level, player, dt);
  }

  private hook(level: Level): void {
    this.hooked = level;
    this.alarms.clear();
    level.onHit = (_tx, _ty, tile) => {
      if (tile === 'CRATE') this.audio.playBulletImpact({ x: (_tx + 0.5) * T, y: (_ty + 0.5) * T });
    };
    level.onSecret = (s) => {
      const at = { x: (s.wall.x + 0.5) * T, y: (s.wall.y + 0.5) * T };
      this.audio.playSecret(at);
      if (this.world) spawnFlash(this.world, this.renderer, at.x, at.y, 0xffc66b, 34, 0.5);
      this.state.toast('HIDDEN PASSAGE', 2.6);
    };
    level.onDestroyed = (tx, ty, tile) => this.destroyed(level, tx, ty, tile);
  }

  private destroyed(level: Level, tx: number, ty: number, tile: TileType): void {
    const world = this.world;
    if (!world) return;
    const x = (tx + 0.5) * T;
    const y = (ty + 0.5) * T;
    if (tile === 'BARREL') {
      this.audio.playExplosion({ x, y });
      spawnFlash(world, this.renderer, x, y, 0xff8a2a, 74, 0.45);
      spawnFlash(world, this.renderer, x, y, COLORS.amber, 38, 0.3);
      spawnDebris(world, this.renderer, x, y, 0xffbb68, 12);
      this.field.emit('SHOOT', x, y, 0, 1.4);
      world.each(['health', 'transform'], (_e, h, t) => {
        const d = Math.hypot(t.x - x, t.y - y);
        if (d <= DESTRUCTIBLE.BARREL.radius) applyDamage(h, DESTRUCTIBLE.BARREL.damage * (1 - 0.5 * (d / DESTRUCTIBLE.BARREL.radius)));
      });
      return;
    }
    this.audio.playCrateBreak({ x, y });
    spawnFlash(world, this.renderer, x, y, 0xb9a678, 20, 0.25);
    spawnDebris(world, this.renderer, x, y, 0xd9c092, 7);
    const roll = (Math.imul(level.dungeon.seed ^ (tx * 73856093), 19349663) ^ (ty * 83492791)) >>> 0;
    if (tile === 'CRATE' && roll % 100 < CRATE_LOOT * 100) {
      createPickup(world, this.renderer, x, y, { kind: 'CREDITS', id: null, amount: 5 + 2 * level.dungeon.floor });
    }
  }

  private hazard(world: World, entity: Entity, h: HazardComponent, node: { alpha: number }, dt: number, player: { entity: Entity; x: number; y: number } | null): void {
    h.clock += dt;
    const at = { x: h.x + h.w / 2, y: h.y + h.h / 2 };
    const inside = (tx: number, ty: number, pad: number): boolean => tx > h.x - pad && tx < h.x + h.w + pad && ty > h.y - pad && ty < h.y + h.h + pad;

    if (h.kind === 'SHOCK') {
      const { cycle, warn, active, damage } = HAZARDS.shock;
      const ph = h.clock % cycle;
      const charging = ph >= cycle - warn - active && ph < cycle - active;
      const zapping = ph >= cycle - active;
      if (zapping && !h.active) {
        h.active = true;
        h.hit.length = 0;
        this.audio.playShock(at);
        spawnFlash(world, this.renderer, at.x, at.y, 0xfff2a0, 26, 0.18);
        spawnDebris(world, this.renderer, at.x, at.y, 0xb5e6ff, 5);
      } else if (!zapping) {
        h.active = false;
      }
      node.alpha = zapping ? 1 : charging ? 0.55 + 0.45 * Math.sin(ph * 36) ** 2 : 0.5;
      if (charging && Math.floor(ph * 8) !== Math.floor((ph - dt) * 8)) this.audio.playCharge(at);
      if (zapping) {
        world.each(['health', 'transform', 'collider'], (e, hp, t, col) => {
          if (h.hit.includes(e) || !inside(t.x, t.y, col.halfSize)) return;
          h.hit.push(e);
          applyDamage(hp, damage);
        });
      }
    } else if (h.kind === 'TOXIC') {
      node.alpha = 0.75 + 0.2 * Math.sin(h.clock * 3);
      world.each(['health', 'transform'], (_e, hp, t) => {
        if (inside(t.x, t.y, 0)) applyDamage(hp, HAZARDS.toxic.dps * dt);
      });
    } else {
      this.tripwire(entity, h, node, dt, at, player);
    }
  }

  /** The beam is lit until a terminal cuts it. Crossing it raises an alarm that keeps sounding for a few seconds. */
  private tripwire(entity: Entity, h: HazardComponent, node: { alpha: number }, dt: number, at: { x: number; y: number }, player: { entity: Entity; x: number; y: number } | null): void {
    if (h.disabled) {
      node.alpha = 0.18;
      this.alarms.delete(entity);
      return;
    }
    const alarm = this.alarms.get(entity);
    node.alpha = alarm ? 0.55 + 0.45 * Math.sin(h.clock * 24) ** 2 : 0.9;
    if (alarm) {
      alarm.left -= dt;
      alarm.pulse -= dt;
      if (alarm.pulse <= 0 && player) {
        alarm.pulse = HAZARDS.laser.pulse;
        this.audio.playAlarm(at);
        this.field.emit('SHOOT', at.x, at.y, player.entity, HAZARDS.laser.hearing / 220);
      }
      if (alarm.left <= 0) this.alarms.delete(entity);
      return;
    }
    if (!player || h.clock < HAZARDS.laser.cooldown) return;
    if (player.x > h.x - 6 && player.x < h.x + h.w + 6 && player.y > h.y - 6 && player.y < h.y + h.h + 6) {
      h.clock = 0;
      this.alarms.set(entity, { left: HAZARDS.laser.alarmSeconds, pulse: 0 });
      this.state.toast('TRIPWIRE - ALARM RAISED', 2.4);
    }
  }

  /** Vents hiss and seams buzz when the player is near a hidden room; panels and cabinets rely on the art alone. */
  private hints(level: Level, player: { x: number; y: number }, dt: number): void {
    this.hint -= dt;
    if (this.hint > 0) return;
    this.hint = HINT_EVERY;
    for (const s of level.dungeon.plan.secrets) {
      if (level.found.has(s.id)) continue;
      const at = { x: (s.wall.x + 0.5) * T, y: (s.wall.y + 0.5) * T };
      if (Math.hypot(at.x - player.x, at.y - player.y) > HINT_RANGE) continue;
      if (s.variant === 'VENT') this.audio.playHiss(at);
      else if (s.variant === 'SEAM') this.audio.playBuzz(at);
    }
  }
}
