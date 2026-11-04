import type { HealthComponent } from '../ecs/components';

/**
 * Applies `amount` damage: shield soaks first, the rest hits HP. Ignored during i-frames and on
 * the dead. Returns the damage actually taken.
 */
export function applyDamage(health: HealthComponent, amount: number): number {
  if (amount <= 0 || health.hp <= 0 || health.invulnerableTimer > 0) return 0;
  amount *= health.damageTakenMult ?? 1;
  if (amount <= 0) return 0;
  const previousShield = health.shield + (health.temporaryShield ?? 0);
  const temporary = Math.min(health.temporaryShield ?? 0, amount);
  health.temporaryShield = (health.temporaryShield ?? 0) - temporary;
  amount -= temporary;
  const soaked = Math.min(health.shield, amount);
  health.shield -= soaked;
  const through = Math.min(health.hp, amount - soaked);
  health.hp -= through;
  health.hitFlash = 0.18;
  if (previousShield > 0 && health.shield + (health.temporaryShield ?? 0) <= 0 && (health.shieldBreak ?? 0) <= 0) health.shieldBreak = .48;
  return temporary + soaked + through;
}
