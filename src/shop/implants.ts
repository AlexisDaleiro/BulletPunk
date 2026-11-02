// `.ts` extension: Node's test runner needs it for runtime imports (type imports are erased).
import { neutralStats, type PassiveSynergyComponent } from '../ecs/components.ts';
import type { CyberwarePassive } from '../types';

/** Cyberware implants. They stack: multipliers multiply, additive bonuses add. */
export const IMPLANTS = {
  SERVO_LEGS: {
    id: 'SERVO_LEGS',
    name: 'SERVO LEGS',
    description: '+12% move speed',
    cost: 40,
    modifiers: { moveSpeedMult: 1.12 },
  },
  GHOST_FIBERS: {
    id: 'GHOST_FIBERS',
    name: 'GHOST FIBERS',
    description: 'Your noise ripples are 25% smaller',
    cost: 45,
    modifiers: { noiseDampingMult: 0.75 },
  },
  TRIGGER_GOVERNOR: {
    id: 'TRIGGER_GOVERNOR',
    name: 'TRIGGER GOVERNOR',
    description: '+15% fire rate',
    cost: 50,
    modifiers: { fireRateMult: 1.15 },
  },
  OPTIC_BOOST: {
    id: 'OPTIC_BOOST',
    name: 'OPTIC BOOST',
    description: '+15% vision range, +8 degree cone',
    cost: 55,
    modifiers: { visionRangeMult: 1.15, visionAngleBonus: (8 * Math.PI) / 180 },
  },
  SHIELD_MATRIX: {
    id: 'SHIELD_MATRIX',
    name: 'SHIELD MATRIX',
    description: 'Shield regenerates 3/s',
    cost: 55,
    modifiers: { shieldRegenRate: 3 },
  },
  OVERCLOCK: {
    id: 'OVERCLOCK',
    name: 'OVERCLOCK',
    description: '+20% damage',
    cost: 65,
    modifiers: { damageMult: 1.2 },
  },
  RICOCHET_COATING: {
    id: 'RICOCHET_COATING',
    name: 'RICOCHET COATING',
    description: 'Bullets bounce once off walls',
    cost: 70,
    modifiers: { bulletBounces: 1 },
  },
} as const satisfies Record<string, CyberwarePassive>;

export type ImplantId = keyof typeof IMPLANTS;

/** Which chest tier (1-3) may roll each implant. */
export const IMPLANT_TIER: Record<ImplantId, 1 | 2 | 3> = {
  SERVO_LEGS: 1,
  GHOST_FIBERS: 1,
  TRIGGER_GOVERNOR: 2,
  OPTIC_BOOST: 2,
  SHIELD_MATRIX: 2,
  OVERCLOCK: 3,
  RICOCHET_COATING: 3,
};

export const isImplantId = (id: string): id is ImplantId => id in IMPLANTS;

/** Rebuilds `syn.stats` from scratch out of every installed implant. */
export function recomputeStats(syn: PassiveSynergyComponent): void {
  const s = neutralStats();
  for (const { modifiers: m } of syn.passives) {
    s.moveSpeedMult *= m.moveSpeedMult ?? 1;
    s.visionRangeMult *= m.visionRangeMult ?? 1;
    s.noiseDampingMult *= m.noiseDampingMult ?? 1;
    s.movementNoiseMult *= m.movementNoiseMult ?? 1;
    s.damageMult *= m.damageMult ?? 1;
    s.fireRateMult *= m.fireRateMult ?? 1;
    s.visionAngleBonus += m.visionAngleBonus ?? 0;
    s.bulletBounces += m.bulletBounces ?? 0;
    s.shieldRegenRate += m.shieldRegenRate ?? 0;
  }
  syn.stats = s;
}

export function addImplant(syn: PassiveSynergyComponent, implant: CyberwarePassive): void {
  syn.passives.push(implant);
  recomputeStats(syn);
}
