import type { HealthComponent } from '../ecs/components';

/**
 * Applies `amount` damage: shield soaks first, the rest hits HP. Ignored during i-frames and on
 * the dead. Returns the damage actually taken.
 */
export function applyDamage(health: HealthComponent, amount: number): number {
  if (amount <= 0 || health.hp <= 0 || health.invulnerableTimer > 0) return 0;
  const soaked = Math.min(health.shield, amount);
  health.shield -= soaked;
  const through = Math.min(health.hp, amount - soaked);
  health.hp -= through;
  return soaked + through;
}
