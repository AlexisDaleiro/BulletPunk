import type { AbilityDef } from './characters.ts';
import type { CharacterComponent, HealthComponent } from '../ecs/components.ts';

export const isAbilityActive = (c: CharacterComponent | undefined): boolean => !!c && c.activeRemaining > 0;
export function endAbility(c: CharacterComponent, health: HealthComponent): void {
  c.activeRemaining = 0;
  if (c.def.ability.kind === 'OVERLOAD') health.temporaryShield = 0;
}

/** Simulation time only: pause cannot consume a duration or cooldown. */
export function tickAbility(c: CharacterComponent, health: HealthComponent, activate: boolean, dt: number): void {
  c.cooldownRemaining = Math.max(0, c.cooldownRemaining - dt);
  c.activationFlash = Math.max(0, c.activationFlash - dt);
  if (health.hp <= 0) { endAbility(c, health); return; }
  if (c.activeRemaining > 0) {
    c.activeRemaining = Math.max(0, c.activeRemaining - dt);
    if (c.activeRemaining === 0 || (c.def.ability.kind === 'OVERLOAD' && !health.temporaryShield)) endAbility(c, health);
  }
  if (!activate || c.cooldownRemaining > 0 || c.activeRemaining > 0) return;
  const a = c.def.ability;
  c.activeRemaining = a.duration;
  c.cooldownRemaining = a.cooldown;
  c.activationFlash = 0.5;
  if (a.kind === 'OVERLOAD') health.temporaryShield = a.shieldAmount ?? 0;
}

const INACTIVE_MODIFIERS = { speedMult: 1, movementNoiseMult: 1, visionMult: 1 };
export function abilityModifiers(c: CharacterComponent | undefined): Pick<Required<AbilityDef>, 'speedMult' | 'movementNoiseMult' | 'visionMult'> {
  if (!isAbilityActive(c)) return INACTIVE_MODIFIERS;
  const a = c!.def.ability;
  return { speedMult: a.speedMult ?? 1, movementNoiseMult: a.movementNoiseMult ?? 1, visionMult: a.visionMult ?? 1 };
}
