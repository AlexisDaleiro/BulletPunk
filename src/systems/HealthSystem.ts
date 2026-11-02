import type { SoundManager } from '../audio/SoundManager';
import { WEAPONS, type WeaponId } from '../combat/weapons';
import { COLORS } from '../config';
import type { System } from '../ecs/System';
import type { Entity, World } from '../ecs/World';
import { createTransform } from '../ecs/components';
import { OperativeGraphic } from '../characters/OperativeGraphic';
import { spawnDebris, spawnFlash } from '../entities/effects';
import { createPickup } from '../entities/pickups';
import type { RenderSystem } from './RenderSystem';

/** Weighted by repetition: what a bot may drop besides the pistol. */
const LOOT_WEAPONS: readonly WeaponId[] = ['AUTO_SMG', 'AUTO_SMG', 'AUTO_SMG', 'NEON_SHOTGUN', 'NEON_SHOTGUN', 'HEAVY_RAILGUN'];
const WEAPON_DROP_CHANCE = 0.2;
const AMMO_DROP_CHANCE = 0.2;

/** Ticks i-frames and shield regen, and handles deaths: bots drop loot and vanish, the player goes down. */
export class HealthSystem implements System {
  /** Called once per bot killed. */
  onKill: (() => void) | null = null;
  private readonly renderer: RenderSystem;
  private readonly audio: SoundManager;

  constructor(renderer: RenderSystem, audio: SoundManager) {
    this.renderer = renderer;
    this.audio = audio;
  }

  update(world: World, dt: number): void {
    world.each(['health'], (entity, h) => {
      h.invulnerableTimer = Math.max(0, h.invulnerableTimer - dt);
      h.hitFlash = Math.max(0, (h.hitFlash ?? 0) - dt);
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
      intent.wantsAbility = false;
    }
    const r = world.get(entity, 'renderable');
    if (r) r.node.alpha = 0.35;
    const t = world.get(entity, 'transform');
    if (t) spawnFlash(world, this.renderer, t.x, t.y, COLORS.cyan, 26, 0.5);
    this.audio.playDeath();
  }

  private killEnemy(world: World, entity: Entity): void {
    const t = world.get(entity, 'transform');
    if (t) {
      spawnFlash(world, this.renderer, t.x, t.y, COLORS.red, 22, 0.35);
      spawnDebris(world, this.renderer, t.x, t.y, 0xf5c3a3, 6);
      const visual = world.get(entity, 'enemyVisual');
      const weapon = world.get(entity, 'weaponInventory')?.slots[0];
      if (visual && weapon) {
        const fallen = world.create();
        const pose = createTransform(t.x, t.y, t.angle + 0.35);
        pose.vx = -Math.cos(t.angle) * 24;
        pose.vy = -Math.sin(t.angle) * 24;
        world.add(fallen, 'transform', pose).add(fallen, 'fogged', {})
          .add(fallen, 'particle', { drag: 5, spin: 0.15 })
          .add(fallen, 'lifetime', { age: 0, duration: 3, startAlpha: 0.65 });
        const node = new OperativeGraphic(visual.appearance, weapon.type, this.renderer.renderer);
        node.scale.set(1, 0.75);
        node.tint = 0x7c8080;
        this.renderer.attach(world, fallen, 'shadows', node);
      }
      this.audio.playBulletImpact(t);
      this.dropLoot(world, t.x, t.y);
    }
    world.destroy(entity);
    this.onKill?.();
  }

  /** Every bot drops a few credits; sometimes a weapon or a magazine as well. */
  private dropLoot(world: World, x: number, y: number): void {
    createPickup(world, this.renderer, x, y, { kind: 'CREDITS', id: null, amount: 4 + Math.floor(Math.random() * 7) });
    const roll = Math.random();
    if (roll < WEAPON_DROP_CHANCE) {
      const id = LOOT_WEAPONS[Math.floor(Math.random() * LOOT_WEAPONS.length)];
      createPickup(world, this.renderer, x + 22, y, { kind: 'WEAPON', id: WEAPONS[id].id, amount: 2 });
    } else if (roll < WEAPON_DROP_CHANCE + AMMO_DROP_CHANCE) {
      createPickup(world, this.renderer, x + 22, y, { kind: 'AMMO', id: null, amount: 1 });
    }
  }
}
