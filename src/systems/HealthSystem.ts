import { WEAPONS, type WeaponId } from '../combat/weapons';
import { COLORS } from '../config';
import type { System } from '../ecs/System';
import type { Entity, World } from '../ecs/World';
import { spawnFlash } from '../entities/effects';
import { createPickup } from '../entities/pickups';
import type { RenderSystem } from './RenderSystem';

/** Weighted by repetition: what a bot may drop besides the pistol. */
const LOOT_WEAPONS: readonly WeaponId[] = ['AUTO_SMG', 'AUTO_SMG', 'AUTO_SMG', 'NEON_SHOTGUN', 'NEON_SHOTGUN', 'HEAVY_RAILGUN'];
const WEAPON_DROP_CHANCE = 0.3;
const AMMO_DROP_CHANCE = 0.2;

/** Ticks i-frames and shield regen, and handles deaths: bots drop loot and vanish, the player goes down. */
export class HealthSystem implements System {
  private readonly renderer: RenderSystem;

  constructor(renderer: RenderSystem) {
    this.renderer = renderer;
  }

  update(world: World, dt: number): void {
    world.each(['health'], (entity, h) => {
      h.invulnerableTimer = Math.max(0, h.invulnerableTimer - dt);
      if (h.hp > 0) {
        const regen = world.get(entity, 'passiveSynergy')?.stats.shieldRegenRate ?? 0;
        if (regen > 0) h.shield = Math.min(h.maxShield, h.shield + regen * dt);
        return;
      }
      if (world.get(entity, 'team')?.team === 'PLAYER') {
        if (world.has(entity, 'playerControlled')) this.killPlayer(world, entity);
      } else {
        this.killEnemy(world, entity);
      }
    });
  }

  /** The player stays in the world (camera, HUD) but loses control, so the bots stand down. */
  private killPlayer(world: World, entity: Entity): void {
    world.remove(entity, 'playerControlled');
    const intent = world.get(entity, 'intent');
    if (intent) {
      intent.moveX = intent.moveY = 0;
      intent.wantsFire = intent.wantsReload = intent.wantsDash = intent.wantsInteract = intent.wantsSwap = false;
    }
    const r = world.get(entity, 'renderable');
    if (r) r.node.alpha = 0.35;
    const t = world.get(entity, 'transform');
    if (t) spawnFlash(world, this.renderer, t.x, t.y, COLORS.cyan, 26, 0.5);
  }

  private killEnemy(world: World, entity: Entity): void {
    const t = world.get(entity, 'transform');
    if (t) {
      spawnFlash(world, this.renderer, t.x, t.y, COLORS.red, 22, 0.35);
      this.dropLoot(world, t.x, t.y);
    }
    world.destroy(entity);
  }

  private dropLoot(world: World, x: number, y: number): void {
    const roll = Math.random();
    if (roll < WEAPON_DROP_CHANCE) {
      const id = LOOT_WEAPONS[Math.floor(Math.random() * LOOT_WEAPONS.length)];
      createPickup(world, this.renderer, x, y, { kind: 'WEAPON', weaponId: WEAPONS[id].id, ammo: 2 });
    } else if (roll < WEAPON_DROP_CHANCE + AMMO_DROP_CHANCE) {
      createPickup(world, this.renderer, x, y, { kind: 'AMMO', weaponId: null, ammo: 1 });
    }
  }
}
