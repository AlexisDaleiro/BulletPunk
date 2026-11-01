import type { Container } from 'pixi.js';
// `.ts` extension: Node's test runner needs it for runtime imports (type imports are erased).
import { LOCOMOTION, NOISE_PROFILES, PLAYER_VITALS, VISION } from '../config.ts';
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

/** What an entity wants to do this step. Players fill it from input, AI from its state machine. */
export interface IntentComponent {
  /** Desired move direction, length 0..1. The length picks the gait: short = sneak, long = run. */
  moveX: number;
  moveY: number;
  aimAngle: number;
  wantsFire: boolean;
  wantsReload: boolean;
  wantsDash: boolean;
  wantsInteract: boolean;
}

/** Tag: this entity's intent is filled from the InputManager. */
export type PlayerControlledComponent = Record<string, never>;

export type Gait = 'IDLE' | 'SNEAK' | 'RUN';

export interface LocomotionComponent {
  runSpeed: number;
  accel: number;
  decel: number;
  turnRate: number;
  dashSpeed: number;
  dashDuration: number;
  dashCooldown: number;
  dashTrailInterval: number;
  dashTimer: number;
  dashCooldownTimer: number;
  dashDirX: number;
  dashDirY: number;
  trailTimer: number;
  /** Set every step from intent; the noise system emits ripples only while RUN. */
  gait: Gait;
}

/** Tag: the renderable is hidden whenever it lies outside the player's visibility polygon. */
export type FoggedComponent = Record<string, never>;

/** Square collision box against solid tiles, centered on the transform. */
export interface ColliderComponent {
  halfSize: number;
}

/** Entity is destroyed after `duration` seconds, fading from `startAlpha` if it has a node. */
export interface LifetimeComponent {
  age: number;
  duration: number;
  startAlpha: number;
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
  intent: IntentComponent;
  playerControlled: PlayerControlledComponent;
  locomotion: LocomotionComponent;
  lifetime: LifetimeComponent;
  collider: ColliderComponent;
  fogged: FoggedComponent;
}

export function createTransform(x: number, y: number, angle = 0): TransformComponent {
  return { x, y, angle, vx: 0, vy: 0, prevX: x, prevY: y, prevAngle: angle };
}

export function createIntent(aimAngle = 0): IntentComponent {
  return {
    moveX: 0,
    moveY: 0,
    aimAngle,
    wantsFire: false,
    wantsReload: false,
    wantsDash: false,
    wantsInteract: false,
  };
}

export function createLocomotion(): LocomotionComponent {
  return {
    ...LOCOMOTION,
    dashTimer: 0,
    dashCooldownTimer: 0,
    dashDirX: 1,
    dashDirY: 0,
    trailTimer: 0,
    gait: 'IDLE',
  };
}

export function createHealth(hp: number = PLAYER_VITALS.hp, shield: number = PLAYER_VITALS.shield): HealthComponent {
  return { hp, maxHp: hp, shield, maxShield: shield, invulnerableTimer: 0 };
}

export function createVision(): VisionComponent {
  return { fov: VISION.fov, range: VISION.range, proximityRadius: VISION.proximity, polygon: [] };
}

export function createNoiseEmitter(): NoiseEmitterComponent {
  return { movementAccumulator: 0, weaponNoiseRadius: NOISE_PROFILES.SHOOT.maxRadius };
}

/** Neutral passives: multipliers 1, additives 0. */
export function createPassiveSynergy(): PassiveSynergyComponent {
  return {
    passives: [],
    stats: {
      moveSpeedMult: 1,
      visionRangeMult: 1,
      visionAngleBonus: 0,
      noiseDampingMult: 1,
      damageMult: 1,
      fireRateMult: 1,
      bulletBounces: 0,
      shieldRegenRate: 0,
    },
  };
}
