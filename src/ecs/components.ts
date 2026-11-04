import type { Container } from 'pixi.js';
import type { CharacterDef } from '../characters/characters.ts';
import type { EnemyAppearance } from '../characters/enemyAppearances.ts';
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
  /** Expires separately, without changing maxShield or implant regeneration. */
  temporaryShield?: number;
  hitFlash?: number;
  damageTakenMult?: number;
  /** Brief visual burst when the final permanent or temporary shield point is lost. */
  shieldBreak?: number;
}

export interface CharacterComponent {
  upgrades?: string[];
  augments?: { activationHeal?: number; decoy?: boolean; ghostFire?: boolean; novaDamage?: number; scanJam?: boolean; repairShield?: number; pulseDamage?: number; refill?: boolean; damageMult?: number; maxHp?: number; maxShield?: number };
  def: CharacterDef;
  activeRemaining: number;
  cooldownRemaining: number;
  activationFlash: number;
  recoil: number;
  trailTimer: number;
}

export interface VisionComponent {
  effectiveRange?: number;
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
  disruptedTimer: number;
  state: AIState;
  /** Where the bot is heading: noise origin or last known player position. */
  targetX: number;
  targetY: number;
  /** Seconds left before an ALERT_ACQUIRE enemy opens fire. */
  reactionTimer: number;
  lastHeardSound: { x: number; y: number; time: number } | null;
  /** Highest noise sequence number already reacted to, so one ripple triggers once. */
  lastHeardSeq: number;
  homeRoomId: string;
  waypoints: { x: number; y: number }[];
  waypointIndex: number;
  path: { x: number; y: number }[];
  pathIndex: number;
  lastSeenX: number;
  lastSeenY: number;
  /** Seconds without line of sight to the player. */
  lostTimer: number;
  stateTimer: number;
  lookTimer: number;
  searchAngle: number;
  strafeDir: 1 | -1;
  strafeTimer: number;
  stuckTimer: number;
  burstTimer: number;
  coverSpot: { x: number; y: number } | null;
  coverTimer: number;
}

export type Team = 'PLAYER' | 'ENEMY';

export interface TeamComponent {
  team: Team;
}

/** Pooled bullet. Inactive projectiles keep their entity and node and are skipped by every system. */
export interface ProjectileComponent {
  active: boolean;
  team: Team;
  damage: number;
  piercing: boolean;
  /** Explosive rounds crack secret walls. */
  explosive: boolean;
  bounces: number;
  /** Seconds left before it despawns. */
  life: number;
  /** Entities already hit, so a piercing shot damages each only once. */
  hit: number[];
}

/** Walk-over loot. */
export interface PickupComponent {
  kind: 'WEAPON' | 'AMMO' | 'KEY' | 'CREDITS' | 'IMPLANT' | 'HEAL';
  /** WEAPON: weapon id. KEY: key color. IMPLANT: implant id. Unused otherwise. */
  id: string | null;
  /** WEAPON / AMMO: spare magazines granted. CREDITS: credits granted. */
  amount: number;
}

/** A chest's lifecycle: closed, lid lifting (rewards still in the case), looted. */
export interface ChestComponent {
  family: 'SUPPLY' | 'SPECIAL';
  category: 'AMMO' | 'MED' | 'CREDITS' | 'GEAR';
  tier: 1 | 2 | 3;
  seed: number;
  state: 'CLOSED' | 'OPENING' | 'LOOTED';
  /** Seconds since it started opening. */
  t: number;
}

/** A floor hazard. Shock plates cycle warn -> zap; toxic puddles hurt while you stand in them; tripwires raise the alarm. */
export interface HazardComponent {
  kind: 'SHOCK' | 'TOXIC' | 'LASER';
  /** World-px box. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Seconds into the current cycle (shock) or since the last alarm (laser). */
  clock: number;
  /** Shock plate mid-zap, or laser beam lit. */
  active: boolean;
  disabled: boolean;
  /** Entities already zapped this cycle. */
  hit: number[];
}

/** Press-to-use props: chests, shop pedestals, medical stations, terminals. */
export interface InteractableComponent {
  kind: 'CHEST' | 'SHOP_ITEM' | 'MEDIC' | 'TERMINAL';
  /** CHEST: tier 1-3. SHOP_ITEM: "WEAPON:<id>", "IMPLANT:<id>" or "AMMO". */
  payload: string;
  /** Credits. */
  cost: number;
  /** Shown in the prompt. */
  label: string;
  used: boolean;
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
  /** Mobile: fire only while a visible hostile is inside the weapon cone. */
  autoFire: boolean;
  wantsReload: boolean;
  wantsDash: boolean;
  wantsInteract: boolean;
  wantsSwap: boolean;
  wantsAbility: boolean;
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
  elite: { bonusCredits: number };
  enemyVisual: { appearance: EnemyAppearance; recoil: number };
  pickupVisual: { age: number; phase: number };
  particle: { drag: number; spin: number };
  character: CharacterComponent;
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
  team: TeamComponent;
  projectile: ProjectileComponent;
  pickup: PickupComponent;
  interactable: InteractableComponent;
  chest: ChestComponent;
  hazard: HazardComponent;
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
    autoFire: false,
    wantsReload: false,
    wantsDash: false,
    wantsInteract: false,
    wantsSwap: false,
    wantsAbility: false,
  };
}

export function createAIController(
  homeRoomId: string,
  waypoints: { x: number; y: number }[],
): AIControllerComponent {
  return {
    state: 'PATROL',
    disruptedTimer: 0,
    targetX: 0,
    targetY: 0,
    reactionTimer: 0,
    lastHeardSound: null,
    lastHeardSeq: -1,
    homeRoomId,
    waypoints,
    waypointIndex: 0,
    path: [],
    pathIndex: 0,
    lastSeenX: 0,
    lastSeenY: 0,
    lostTimer: 0,
    stateTimer: 0,
    lookTimer: 0,
    searchAngle: 0,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    strafeTimer: 0,
    stuckTimer: 0,
    burstTimer: Math.random() * 1.5,
    coverSpot: null,
    coverTimer: 0,
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
  return { hp, maxHp: hp, shield, maxShield: shield, invulnerableTimer: 0, temporaryShield: 0, hitFlash: 0 };
}

export function createVision(): VisionComponent {
  return { fov: VISION.fov, range: VISION.range, proximityRadius: VISION.proximity, polygon: [] };
}

export function createNoiseEmitter(): NoiseEmitterComponent {
  return { movementAccumulator: 0, weaponNoiseRadius: NOISE_PROFILES.SHOOT.maxRadius };
}

/** Multipliers 1, additives 0. */
export function neutralStats(): PassiveSynergyComponent['stats'] {
  return {
    moveSpeedMult: 1,
    visionRangeMult: 1,
    visionAngleBonus: 0,
    noiseDampingMult: 1,
    movementNoiseMult: 1,
    damageMult: 1,
    fireRateMult: 1,
    bulletBounces: 0,
    shieldRegenRate: 0,
  };
}

export function createPassiveSynergy(): PassiveSynergyComponent {
  return { passives: [], stats: neutralStats() };
}
