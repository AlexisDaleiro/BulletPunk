import { Graphics } from 'pixi.js';
import { abilityModifiers, tickAbility } from '../characters/abilities';
import { pulseReaches } from '../combat/pulse';
import type { TileMap } from '../world/TileMap';
import { spawnDebris } from '../entities/effects';
import { OperativeGraphic } from '../characters/OperativeGraphic';
import { createTransform } from '../ecs/components';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { RenderSystem } from './RenderSystem';

export class CharacterSystem implements System {
  map: TileMap | null = null;
  private readonly renderer: RenderSystem;
  constructor(renderer: RenderSystem) { this.renderer = renderer; }

  update(world: World, dt: number): void {
    world.each(['character', 'health', 'intent', 'transform'], (_entity, c, h, intent, t) => {
      const activated = tickAbility(c, h, intent.wantsAbility, dt);
      h.damageTakenMult = abilityModifiers(c).damageTakenMult;
      if (activated && c.def.ability.kind === 'EMP_PULSE' && this.map) {
        world.each(['aiController', 'transform', 'intent', 'health'], (_e, ai, enemy, enemyIntent, health) => {
          if (health.hp <= 0 || !pulseReaches(this.map!, t.x, t.y, enemy.x, enemy.y, c.def.ability.pulseRadius ?? 170)) return;
          ai.disruptedTimer = Math.max(ai.disruptedTimer, c.def.ability.duration);
          enemyIntent.moveX = enemyIntent.moveY = 0;
          enemyIntent.wantsFire = false;
          spawnDebris(world, this.renderer, enemy.x, enemy.y, c.def.color, 4);
        });
      }
      c.recoil = Math.max(0, c.recoil - dt * 8);
      c.trailTimer -= dt;
      if (c.def.id !== 'NIX' || c.activeRemaining <= 0 || h.hp <= 0 || Math.hypot(t.vx, t.vy) < 30 || c.trailTimer > 0) return;
      c.trailTimer = 0.1;
      const ghost = world.create();
      world.add(ghost, 'transform', createTransform(t.x, t.y, t.angle))
        .add(ghost, 'lifetime', { age: 0, duration: 0.22, startAlpha: 0.2 });
      const node = new Graphics().ellipse(-3, 0, 10, 12).fill(c.def.color);
      this.renderer.attach(world, ghost, 'shadows', node);
    });
  }

  render(world: World, _alpha: number, dt: number): void {
    world.each(['character', 'renderable', 'health', 'transform', 'weaponInventory'], (_entity, c, r, h, t, inv) => {
      if (!(r.node instanceof OperativeGraphic)) return;
      r.node.setWeapon(inv.slots[inv.activeSlot].type);
      const weapon = inv.slots[inv.activeSlot];
      r.node.animate(dt, Math.hypot(t.vx, t.vy), c, h, inv.reloadTimer > 0 ? 1 - inv.reloadTimer / weapon.reloadTime : 0);
    });
  }
}
