import type { SoundManager } from '../audio/SoundManager';
import { ENEMY, TILE_SIZE } from '../config';
import type {
  AIControllerComponent,
  HealthComponent,
  IntentComponent,
  TransformComponent,
  VisionComponent,
  WeaponInventoryComponent,
} from '../ecs/components';
import type { System } from '../ecs/System';
import type { Entity, World } from '../ecs/World';
import { spawnAlertMark } from '../entities/effects';
import type { NoiseField } from '../noise/NoiseField';
import { findPath, type Point } from '../world/pathfinding';
import { canSee, lineOfSight, raycastTiles } from '../world/raycast';
import type { TileMap } from '../world/TileMap';
import type { RenderSystem } from './RenderSystem';

/** Closer than this to a waypoint counts as arrived. */
const ARRIVE = 14;
/** Seconds a bot scans around the last known position before going back on patrol. */
const SEARCH_SCAN = 3;
/** Cover candidates are looked up within this many tiles of the bot. */
const COVER_RADIUS = 9;

interface Target {
  valid: boolean;
  x: number;
  y: number;
}

/**
 * Bot brain: a five-state machine (PATROL, INVESTIGATE_NOISE, ALERT_ACQUIRE, COMBAT_ENGAGE,
 * SEARCH_LOST_TARGET). It only writes `intent`; LocomotionSystem and WeaponSystem do the rest.
 */
export class AISystem implements System {
  /** Current floor's tiles. */
  map: TileMap | null = null;
  private readonly renderer: RenderSystem;
  private readonly field: NoiseField;
  private readonly audio: SoundManager;
  private time = 0;

  constructor(renderer: RenderSystem, field: NoiseField, audio: SoundManager) {
    this.renderer = renderer;
    this.field = field;
    this.audio = audio;
  }

  update(world: World, dt: number): void {
    const map = this.map;
    if (!map) return;
    this.time += dt;

    const target: Target = { valid: false, x: 0, y: 0 };
    world.each(['playerControlled', 'transform', 'health'], (_entity, _tag, t, h) => {
      if (h.hp <= 0) return;
      target.valid = true;
      target.x = t.x;
      target.y = t.y;
    });

    world.each(
      ['aiController', 'transform', 'intent', 'weaponInventory', 'vision', 'health'],
      (entity, ai, t, intent, inv, vision, hp) => this.think(world, map, entity, ai, t, intent, inv, vision, hp, target, dt),
    );
  }

  private think(
    world: World,
    map: TileMap,
    entity: Entity,
    ai: AIControllerComponent,
    t: TransformComponent,
    intent: IntentComponent,
    inv: WeaponInventoryComponent,
    vision: VisionComponent,
    hp: HealthComponent,
    target: Target,
    dt: number,
  ): void {
    intent.moveX = 0;
    intent.moveY = 0;
    intent.wantsFire = intent.wantsReload = intent.wantsSwap = intent.wantsDash = intent.wantsInteract = false;
    if (ai.disruptedTimer > 0) {
      ai.disruptedTimer = Math.max(0, ai.disruptedTimer - dt);
      return;
    }
    ai.stateTimer += dt;

    // Once engaged a bot tracks the player all-round (it is looking right at them); otherwise it needs the cone.
    const engaged = ai.state === 'ALERT_ACQUIRE' || ai.state === 'COMBAT_ENGAGE';
    const dist = target.valid ? Math.hypot(target.x - t.x, target.y - t.y) : Infinity;
    const sees =
      target.valid &&
      (engaged
        ? dist <= vision.range * 1.3 && lineOfSight(map, t.x, t.y, target.x, target.y)
        : canSee(map, t.x, t.y, t.angle, vision.fov, vision.range, target.x, target.y));
    if (sees) {
      ai.lastSeenX = target.x;
      ai.lastSeenY = target.y;
    }
    const heard = !engaged && this.listen(world, entity, ai, t);

    switch (ai.state) {
      case 'PATROL':
        if (sees) this.enterAlert(world, ai, t);
        else if (heard) this.enterInvestigate(map, ai, t);
        else this.patrol(map, ai, t, intent);
        break;

      case 'INVESTIGATE_NOISE':
        if (sees) this.enterAlert(world, ai, t);
        else if (heard) this.enterInvestigate(map, ai, t);
        else if (this.follow(ai, t, intent, ENEMY.investigateInput) || ai.stateTimer > 8) {
          this.enterSearch(map, ai, t, ai.targetX, ai.targetY);
        }
        break;

      case 'ALERT_ACQUIRE':
        intent.aimAngle = Math.atan2(ai.lastSeenY - t.y, ai.lastSeenX - t.x);
        ai.reactionTimer -= dt;
        ai.lostTimer = sees ? 0 : ai.lostTimer + dt;
        if (ai.lostTimer > 0.4) {
          this.enterSearch(map, ai, t, ai.lastSeenX, ai.lastSeenY);
        } else if (ai.reactionTimer <= 0) {
          ai.state = 'COMBAT_ENGAGE';
          ai.stateTimer = 0;
          ai.lostTimer = 0;
        }
        break;

      case 'COMBAT_ENGAGE':
        ai.lostTimer = sees ? 0 : ai.lostTimer + dt;
        if (ai.lostTimer > 0.6) this.enterSearch(map, ai, t, ai.lastSeenX, ai.lastSeenY);
        else this.combat(map, ai, t, intent, inv, hp, sees, vision, dt);
        break;

      case 'SEARCH_LOST_TARGET':
        if (sees) {
          this.enterAlert(world, ai, t);
        } else if (this.follow(ai, t, intent, ENEMY.investigateInput)) {
          ai.lookTimer += dt;
          intent.aimAngle = ai.searchAngle + Math.sin(ai.lookTimer * 2.5) * 1.3; // sweep left and right
          if (ai.lookTimer > SEARCH_SCAN) this.enterPatrol(ai);
        } else {
          ai.lookTimer = 0;
        }
        if (ai.stateTimer > 20) this.enterPatrol(ai);
        break;
    }
  }

  /** Reacts once to every new ripple from the player's side that reaches the bot's hearing radius. */
  private listen(world: World, entity: Entity, ai: AIControllerComponent, t: TransformComponent): boolean {
    let heard = false;
    for (const e of this.field.events) {
      const seq = Number(e.id.slice(e.id.lastIndexOf('-') + 1));
      if (seq <= ai.lastHeardSeq || e.sourceEntityId === String(entity)) continue;
      if (world.get(Number(e.sourceEntityId), 'team')?.team !== 'PLAYER') continue;
      if (Math.hypot(e.x - t.x, e.y - t.y) > ENEMY.hearing + e.currentRadius) continue;
      ai.lastHeardSeq = seq;
      ai.lastHeardSound = { x: e.x, y: e.y, time: this.time };
      heard = true;
    }
    return heard;
  }

  private enterPatrol(ai: AIControllerComponent): void {
    ai.state = 'PATROL';
    ai.stateTimer = 0;
    ai.path = [];
    ai.pathIndex = 0;
    ai.coverSpot = null;
  }

  private enterAlert(world: World, ai: AIControllerComponent, t: TransformComponent): void {
    ai.state = 'ALERT_ACQUIRE';
    ai.stateTimer = 0;
    ai.lostTimer = 0;
    ai.path = [];
    ai.pathIndex = 0;
    ai.coverSpot = null;
    ai.coverTimer = 0;
    ai.reactionTimer = ENEMY.reaction[0] + Math.random() * (ENEMY.reaction[1] - ENEMY.reaction[0]);
    spawnAlertMark(world, this.renderer, t.x, t.y - 26);
    this.audio.playAlert(t);
  }

  private enterInvestigate(map: TileMap, ai: AIControllerComponent, t: TransformComponent): void {
    const sound = ai.lastHeardSound;
    if (!sound) return;
    ai.state = 'INVESTIGATE_NOISE';
    ai.stateTimer = 0;
    ai.targetX = sound.x;
    ai.targetY = sound.y;
    this.setGoal(map, ai, t, sound.x, sound.y);
  }

  private enterSearch(map: TileMap, ai: AIControllerComponent, t: TransformComponent, x: number, y: number): void {
    ai.state = 'SEARCH_LOST_TARGET';
    ai.stateTimer = 0;
    ai.lookTimer = 0;
    ai.searchAngle = t.angle;
    ai.targetX = x;
    ai.targetY = y;
    ai.coverSpot = null;
    this.setGoal(map, ai, t, x, y);
  }

  private setGoal(map: TileMap, ai: AIControllerComponent, from: Point, x: number, y: number): void {
    ai.path = findPath(map, from, { x, y });
    ai.pathIndex = 0;
  }

  /** Walks the current path at `input` strength. Returns true once there is nothing left to walk. */
  private follow(ai: AIControllerComponent, t: TransformComponent, intent: IntentComponent, input: number): boolean {
    while (ai.pathIndex < ai.path.length) {
      const wp = ai.path[ai.pathIndex];
      const dx = wp.x - t.x;
      const dy = wp.y - t.y;
      const d = Math.hypot(dx, dy);
      if (d < ARRIVE) {
        ai.pathIndex++;
        continue;
      }
      intent.moveX = (dx / d) * input;
      intent.moveY = (dy / d) * input;
      intent.aimAngle = Math.atan2(dy, dx);
      return false;
    }
    return true;
  }

  private patrol(map: TileMap, ai: AIControllerComponent, t: TransformComponent, intent: IntentComponent): void {
    if (ai.waypoints.length === 0) return;
    if (ai.pathIndex >= ai.path.length) {
      ai.waypointIndex = (ai.waypointIndex + 1) % ai.waypoints.length;
      const wp = ai.waypoints[ai.waypointIndex];
      this.setGoal(map, ai, t, wp.x, wp.y);
    }
    this.follow(ai, t, intent, ENEMY.patrolInput);
  }

  /** Strafe while firing in bursts, hold a fighting distance, and duck behind cover to reload or when hurt. */
  private combat(
    map: TileMap,
    ai: AIControllerComponent,
    t: TransformComponent,
    intent: IntentComponent,
    inv: WeaponInventoryComponent,
    hp: HealthComponent,
    sees: boolean,
    vision: VisionComponent,
    dt: number,
  ): void {
    const weapon = inv.slots[inv.activeSlot];
    const mag = inv.magazine[inv.activeSlot];
    const reloading = inv.reloadTimer > 0;
    const toTarget = Math.atan2(ai.lastSeenY - t.y, ai.lastSeenX - t.x);
    const dist = Math.hypot(ai.lastSeenX - t.x, ai.lastSeenY - t.y);
    const lowHp = hp.hp < hp.maxHp * ENEMY.coverHpFraction;

    // coverTimer < 0 is a cooldown after leaving cover, so a hurt bot peeks out instead of hiding forever.
    if (ai.coverTimer < 0) ai.coverTimer = Math.min(0, ai.coverTimer + dt);
    if (!ai.coverSpot && ai.coverTimer >= 0 && (mag === 0 || lowHp)) {
      const spot = findCoverSpot(map, t, { x: ai.lastSeenX, y: ai.lastSeenY });
      if (spot) {
        ai.coverSpot = spot;
        ai.coverTimer = 0;
        this.setGoal(map, ai, t, spot.x, spot.y);
      }
    }

    if (ai.coverSpot) {
      if (!this.follow(ai, t, intent, 1)) return; // still running to cover
      intent.aimAngle = toTarget;
      ai.coverTimer += dt;
      intent.wantsReload = mag < weapon.magazineSize;
      if (!reloading && mag > 0 && (!lowHp || ai.coverTimer > 3)) {
        ai.coverSpot = null;
        ai.coverTimer = -5;
      }
      return;
    }

    intent.aimAngle = toTarget;
    if (mag === 0) intent.wantsReload = true;

    // Strafe sideways, flipping on a timer or when blocked, and drift to the preferred distance.
    ai.strafeTimer -= dt;
    ai.stuckTimer = Math.hypot(t.vx, t.vy) < 25 && ai.stateTimer > 0.3 ? ai.stuckTimer + dt : 0;
    if (ai.strafeTimer <= 0 || ai.stuckTimer > 0.25) {
      ai.strafeDir = ai.strafeDir === 1 ? -1 : 1;
      ai.strafeTimer = 0.8 + Math.random() * 0.8;
      ai.stuckTimer = 0;
    }
    const radial = dist > ENEMY.engageDistance + 60 ? 1 : dist < ENEMY.engageDistance - 60 ? -1 : 0;
    const mx = -Math.sin(toTarget) * ai.strafeDir * 0.8 + Math.cos(toTarget) * radial * 0.7;
    const my = Math.cos(toTarget) * ai.strafeDir * 0.8 + Math.sin(toTarget) * radial * 0.7;
    const len = Math.hypot(mx, my);
    if (len > 1e-3) {
      intent.moveX = (mx / len) * ENEMY.combatInput;
      intent.moveY = (my / len) * ENEMY.combatInput;
    }

    const aimed = Math.abs(Math.atan2(Math.sin(toTarget - t.angle), Math.cos(toTarget - t.angle))) < 0.2;
    ai.burstTimer += dt;
    const bursting = ai.burstTimer % (ENEMY.burstOn + ENEMY.burstOff) < ENEMY.burstOn;
    intent.wantsFire = sees && aimed && bursting && !reloading && mag > 0 && dist <= vision.range;
  }
}

/**
 * Nearest barricade tile within COVER_RADIUS whose far side (away from `threat`) is open and
 * really shielded: a bullet from the threat to that spot must hit a solid tile on the way.
 */
function findCoverSpot(map: TileMap, from: Point, threat: Point): Point | null {
  const T = TILE_SIZE;
  const cx = Math.floor(from.x / T);
  const cy = Math.floor(from.y / T);
  const solid = (tx: number, ty: number): boolean => map.isSolid(tx, ty);
  let best: Point | null = null;
  let bestDist = Infinity;
  for (let ty = cy - COVER_RADIUS; ty <= cy + COVER_RADIUS; ty++) {
    for (let tx = cx - COVER_RADIUS; tx <= cx + COVER_RADIUS; tx++) {
      if (map.get(tx, ty) !== 'COVER') continue;
      const awayX = (tx + 0.5) * T - threat.x;
      const awayY = (ty + 0.5) * T - threat.y;
      const alongX = Math.abs(awayX) > Math.abs(awayY);
      const sx = tx + (alongX ? Math.sign(awayX) : 0);
      const sy = ty + (alongX ? 0 : Math.sign(awayY));
      if (map.isSolid(sx, sy)) continue;
      const spot = { x: (sx + 0.5) * T, y: (sy + 0.5) * T };
      if (raycastTiles(solid, threat.x, threat.y, spot.x, spot.y) === null) continue;
      const d = Math.hypot(spot.x - from.x, spot.y - from.y);
      if (d < bestDist) {
        bestDist = d;
        best = spot;
      }
    }
  }
  return best;
}
