import { abilityModifiers } from '../characters/abilities.ts';
import { weaponMuzzle } from '../characters/weaponPose.ts';
import { BULLET_RANGE } from '../config.ts';
import type { Entity, World } from '../ecs/World.ts';
import type { WeaponDefinition } from '../types.ts';
import type { TileMap } from '../world/TileMap.ts';
import { canSee, raycastTiles } from '../world/raycast.ts';

export interface AttackCone {
  x: number;
  y: number;
  sx: number;
  sy: number;
  angle: number;
  spread: number;
  range: number;
  visionRange: number;
  fov: number;
}

/** One definition shared by the red guide, target detection and mobile bullet dispersion. */
export function mobileAttackCone(world: World, entity: Entity, weapon: WeaponDefinition): AttackCone | null {
  const t = world.get(entity, 'transform');
  const vision = world.get(entity, 'vision');
  if (!t || !vision) return null;
  const stats = world.get(entity, 'passiveSynergy')?.stats;
  const abilities = abilityModifiers(world.get(entity, 'character'));
  const loc = world.get(entity, 'locomotion');
  const speed = Math.hypot(t.vx, t.vy);
  const runSpeed = (loc?.runSpeed ?? 240) * (stats?.moveSpeedMult ?? 1) * abilities.speedMult;
  const movement = Math.min(1, speed / Math.max(1, runSpeed));
  const fov = vision.fov + (stats?.visionAngleBonus ?? 0);
  const visionRange = vision.range * (stats?.visionRangeMult ?? 1) * abilities.visionMult;
  const local = weaponMuzzle(weapon.type);
  const cos = Math.cos(t.angle), sin = Math.sin(t.angle);
  return {
    x: t.x, y: t.y,
    sx: t.x + cos * local.x - sin * local.y,
    sy: t.y + sin * local.x + cos * local.y,
    angle: t.angle,
    spread: Math.min(fov, Math.max(0.1, weapon.spreadAngle) + 0.18 * movement),
    range: Math.min(weapon.range ?? BULLET_RANGE, visionRange),
    visionRange, fov,
  };
}

/** Requires both visibility from the body and an unobstructed shot from the actual muzzle. */
export function inAttackCone(map: TileMap, cone: AttackCone, x: number, y: number): boolean {
  const dx = x - cone.sx, dy = y - cone.sy;
  if (dx * dx + dy * dy > cone.range * cone.range) return false;
  const offset = Math.atan2(dy, dx) - cone.angle;
  if (Math.abs(Math.atan2(Math.sin(offset), Math.cos(offset))) > cone.spread / 2) return false;
  if (!canSee(map, cone.x, cone.y, cone.angle, cone.fov, cone.visionRange, x, y)) return false;
  const solid = (tx: number, ty: number) => map.isSolid(tx, ty);
  return raycastTiles(solid, cone.x, cone.y, cone.sx, cone.sy) === null
    && raycastTiles(solid, cone.sx, cone.sy, x, y) === null;
}

export function hasMobileTarget(world: World, map: TileMap, entity: Entity, cone: AttackCone): boolean {
  if ((world.get(entity, 'health')?.hp ?? 0) <= 0) return false;
  let found = false;
  world.each(['team', 'transform', 'health'], (_enemy, team, t, health) => {
    if (!found && team.team === 'ENEMY' && health.hp > 0 && inAttackCone(map, cone, t.x, t.y)) found = true;
  });
  return found;
}
