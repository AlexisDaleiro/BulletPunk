import type { Container } from 'pixi.js';
import type { CyberwarePassive, WeaponDefinition } from '../types';

export interface TransformComponent {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  /** State at the previous fixed step; render interpolates prev -> current. */
  prevX: number;
  prevY: number;
  prevAngle: number;
}

export interface HealthComponent {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  /** Seconds of damage immunity left. */
  invulnerableTimer: number;
}

export interface VisionComponent {
  /** Cone full angle, radians. */
  fov: number;
  /** Cone range, px. */
  range: number;
  /** 360-degree awareness radius, px. */
  proximityRadius: number;
  /** Cached visibility polygon, flat [x0, y0, x1, y1, ...] in world px. */
  polygon: number[];
}

export interface NoiseEmitterComponent {
  /** Seconds accumulated toward the next movement ripple. */
  movementAccumulator: number;
  /** Radius of the ripple emitted when this entity fires, px. */
  weaponNoiseRadius: number;
}

export interface WeaponInventoryComponent {
  slots: WeaponDefinition[];
  activeSlot: number;
  /** Rounds in the magazine, per slot. */
  magazine: number[];
  /** Spare rounds, per slot. */
  reserve: number[];
  reloadTimer: number;
  fireCooldown: number;
}

export interface PassiveSynergyComponent {
  passives: CyberwarePassive[];
  /** Folded result of every passive's modifiers; multipliers start at 1, additives at 0. */
  stats: Required<CyberwarePassive['modifiers']>;
}

export type AIState =
  | 'PATROL'
  | 'INVESTIGATE_NOISE'
  | 'ALERT_ACQUIRE'
  | 'COMBAT_ENGAGE'
  | 'SEARCH_LOST_TARGET';

export interface AIControllerComponent {
  state: AIState;
  targetX: number;
  targetY: number;
  /** Seconds left before an ALERT_ACQUIRE enemy opens fire. */
  reactionTimer: number;
  lastHeardSound: { x: number; y: number; time: number } | null;
}

export interface RenderableComponent {
  node: Container;
}

export interface ComponentMap {
  transform: TransformComponent;
  health: HealthComponent;
  vision: VisionComponent;
  noiseEmitter: NoiseEmitterComponent;
  weaponInventory: WeaponInventoryComponent;
  passiveSynergy: PassiveSynergyComponent;
  aiController: AIControllerComponent;
  renderable: RenderableComponent;
}

export function createTransform(x: number, y: number, angle = 0): TransformComponent {
  return { x, y, angle, vx: 0, vy: 0, prevX: x, prevY: y, prevAngle: angle };
}
