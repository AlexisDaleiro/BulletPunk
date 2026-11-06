import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { RunController } from '../run/RunController';
import type { HealthSystem } from './HealthSystem';
/** Range targets use real hit detection and shield reactions, with no rewards or server writes. */
export class TrainingSystem implements System {
  private readonly run: RunController;
  private readonly health: HealthSystem;
  constructor(run: RunController, health: HealthSystem) {
    this.run = run;
    this.health = health;
  }
  update(world: World): void {
    this.health.training = this.run.practice;
    if (!this.run.practice || !this.run.active) return;
    world.each(['aiController'], (_id, ai) => {
      ai.disruptedTimer = 0;
    });
    world.each(['playerControlled', 'health', 'character', 'weaponInventory'], (_id, _tag, h, c, inv) => {
      h.hp = h.maxHp;
      h.shield = h.maxShield;
      h.invulnerableTimer = 999;
      c.cooldownRemaining = Math.min(c.cooldownRemaining, 2);
      for (let i = 0; i < inv.reserve.length; i++)
        if (Number.isFinite(inv.reserve[i])) inv.reserve[i] = Math.max(inv.reserve[i], inv.slots[i].magazineSize * 20);
    });
  }
}
