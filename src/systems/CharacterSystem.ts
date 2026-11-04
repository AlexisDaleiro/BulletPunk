import { Graphics } from 'pixi.js';
import { abilityModifiers, tickAbility } from '../characters/abilities';
import { pulseReaches } from '../combat/pulse';
import type { TileMap } from '../world/TileMap';
import { spawnDebris } from '../entities/effects';
import { spawnImpactBurst, spawnShieldBreak } from '../entities/effects';
import { applyDamage } from '../combat/damage';
import type { NoiseField } from '../noise/NoiseField';
import type { SoundManager } from '../audio/SoundManager';
import { canSee } from '../world/raycast';
import { OperativeGraphic } from '../characters/OperativeGraphic';
import { createTransform } from '../ecs/components';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { RenderSystem } from './RenderSystem';

export class CharacterSystem implements System {
  map: TileMap | null = null;
  private readonly renderer: RenderSystem;
  private readonly noise: NoiseField;
  private readonly audio: SoundManager;
  constructor(renderer: RenderSystem, noise: NoiseField, audio: SoundManager) { this.renderer = renderer; this.noise = noise; this.audio = audio; }

  update(world: World, dt: number): void {
    world.each(['character', 'health', 'intent', 'transform'], (_entity, c, h, intent, t) => {
      const activated = tickAbility(c, h, intent.wantsAbility, dt);
      h.damageTakenMult = abilityModifiers(c).damageTakenMult;
      if (activated && c.augments?.refill) {
        const inv = world.get(_entity, 'weaponInventory');
        if (inv) {
          const slot = inv.activeSlot, take = Math.min(inv.slots[slot].magazineSize - inv.magazine[slot], inv.reserve[slot]);
          inv.magazine[slot] += take; inv.reserve[slot] -= take; inv.reloadTimer = 0;
        }
      }
      if (activated && c.augments?.decoy) {
        const echo = this.fragment(world, t.x, t.y, t.angle, c.def.color, 1.6);
        world.add(echo, 'team', { team: 'PLAYER' });
        this.noise.emit('SHOOT', t.x, t.y, echo, 1.25);
        this.audio.playCharge(t);
      }
      if (activated && this.map && (c.def.ability.kind === 'EMP_PULSE' || c.augments?.novaDamage || c.augments?.scanJam)) {
        world.each(['aiController', 'transform', 'intent', 'health'], (_e, ai, enemy, enemyIntent, health) => {
          const emp = c.def.ability.kind === 'EMP_PULSE';
          const radius = emp ? c.def.ability.pulseRadius ?? 170 : c.augments?.scanJam ? 230 : 145;
          if (health.hp <= 0 || !pulseReaches(this.map!, t.x, t.y, enemy.x, enemy.y, radius)) return;
          if (c.augments?.scanJam && !canSee(this.map!, t.x, t.y, t.angle, world.get(_entity, 'vision')?.fov ?? 1.4, radius, enemy.x, enemy.y)) return;
          if (emp || c.augments?.scanJam) {
            ai.disruptedTimer = Math.max(ai.disruptedTimer, emp ? c.def.ability.duration : 1);
            enemyIntent.moveX = enemyIntent.moveY = 0;
            enemyIntent.wantsFire = false;
          }
          const shield = health.shield + (health.temporaryShield ?? 0);
          const damage = c.augments?.novaDamage ?? (emp ? c.augments?.pulseDamage ?? 0 : 0);
          if (applyDamage(health, damage) > 0) {
            spawnImpactBurst(world, this.renderer, enemy.x, enemy.y, shield > 0 ? 'SHIELD' : 'ARMOR', Math.atan2(enemy.y - t.y, enemy.x - t.x));
            if (shield > 0 && health.shield + (health.temporaryShield ?? 0) <= 0) spawnShieldBreak(world, this.renderer, enemy.x, enemy.y);
          }
          spawnDebris(world, this.renderer, enemy.x, enemy.y, c.def.color, 4);
        });
      }
      c.recoil = Math.max(0, c.recoil - dt * 8);
      c.trailTimer -= dt;
      if (c.def.id !== 'NIX' || c.activeRemaining <= 0 || h.hp <= 0 || Math.hypot(t.vx, t.vy) < 30 || c.trailTimer > 0) return;
      c.trailTimer = 0.1;
      this.fragment(world, t.x, t.y, t.angle, c.def.color, .28);
    });
  }

  private fragment(world: World, x: number, y: number, angle: number, color: number, duration: number): number {
    const ghost = world.create();
    world.add(ghost, 'transform', createTransform(x, y, angle)).add(ghost, 'lifetime', { age: 0, duration, startAlpha: .45 });
    const node = new Graphics().poly([-14, -10, -5, -12, 2, -8, -8, -4]).fill({ color, alpha: .7 })
      .roundRect(0, -6, 10, 10, 2).fill({ color, alpha: .65 })
      .poly([-12, 0, -3, -2, 1, 7, -11, 10, -19, 6]).fill({ color, alpha: .5 })
      .rect(-19, -12, 8, 1.5).rect(-25, 3, 12, 1.5).rect(-16, 13, 9, 1.5).fill(color);
    node.blendMode = 'add';
    this.renderer.attach(world, ghost, 'shadows', node);
    return ghost;
  }

  render(world: World, _alpha: number, dt: number): void {
    world.each(['character', 'renderable', 'health', 'transform', 'weaponInventory'], (_entity, c, r, h, t, inv) => {
      if (!(r.node instanceof OperativeGraphic)) return;
      r.node.setWeapon(inv.slots[inv.activeSlot]);
      const weapon = inv.slots[inv.activeSlot];
      r.node.animate(dt, Math.hypot(t.vx, t.vy), c, h, inv.reloadTimer > 0 ? 1 - inv.reloadTimer / weapon.reloadTime : 0);
    });
  }
}
