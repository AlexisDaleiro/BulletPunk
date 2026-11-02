import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasMobileTarget, inAttackCone, mobileAttackCone } from './mobileAim.ts';
import { WEAPONS } from './weapons.ts';
import { World } from '../ecs/World.ts';
import { createHealth, createLocomotion, createTransform, createVision } from '../ecs/components.ts';
import { TileMap } from '../world/TileMap.ts';

function scene() {
  const map = new TileMap(30, 30, 'FLOOR');
  const world = new World();
  const player = world.create();
  world.add(player, 'transform', createTransform(168, 264)).add(player, 'health', createHealth())
    .add(player, 'vision', createVision()).add(player, 'locomotion', createLocomotion());
  return { map, world, player, cone: mobileAttackCone(world, player, WEAPONS.PULSE_CARBINE)! };
}

test('auto fire requires a live enemy in front, inside weapon and vision range', () => {
  const { map, world, player, cone } = scene();
  assert.equal(hasMobileTarget(world, map, player, cone), false);
  const enemy = world.create();
  world.add(enemy, 'team', { team: 'ENEMY' }).add(enemy, 'transform', createTransform(cone.sx + 180, cone.sy))
    .add(enemy, 'health', createHealth());
  assert.equal(hasMobileTarget(world, map, player, cone), true);
  const t = world.get(enemy, 'transform')!;
  for (const [x, y] of [[cone.sx - 100, cone.sy], [cone.sx + 180, cone.sy + 100], [cone.x + 430, cone.sy]]) {
    t.x = x; t.y = y;
    assert.equal(hasMobileTarget(world, map, player, cone), false);
  }
  t.x = cone.sx + 180; t.y = cone.sy;
  world.get(enemy, 'health')!.hp = 0;
  assert.equal(hasMobileTarget(world, map, player, cone), false);
  world.get(enemy, 'health')!.hp = 100;
  world.get(enemy, 'team')!.team = 'PLAYER';
  assert.equal(hasMobileTarget(world, map, player, cone), false);
  world.get(enemy, 'team')!.team = 'ENEMY';
  world.get(player, 'health')!.hp = 0;
  assert.equal(hasMobileTarget(world, map, player, cone), false);
});

test('walls, low cover and an obstructed barrel prevent automatic fire; opening the path restores it', () => {
  const { map, cone } = scene();
  const x = cone.sx + 200, y = cone.sy;
  assert.equal(inAttackCone(map, cone, x, y), true);
  for (const tile of ['WALL', 'COVER', 'CRATE', 'DOOR_LOCKED'] as const) {
    map.set(6, 5, tile);
    assert.equal(inAttackCone(map, cone, x, y), false);
  }
  map.set(6, 5, 'DOOR_UNLOCKED');
  assert.equal(inAttackCone(map, cone, x, y), true);
  map.set(4, 5, 'WALL');
  assert.equal(inAttackCone(map, cone, x, y), false);
});

test('moving widens the same cone used by targeting; stopping restores precision, and weapons keep their reach', () => {
  const { map, world, player, cone } = scene();
  const t = world.get(player, 'transform')!;
  t.vx = world.get(player, 'locomotion')!.runSpeed;
  const moving = mobileAttackCone(world, player, WEAPONS.PULSE_CARBINE)!;
  assert.ok(moving.spread > cone.spread);
  const angle = (moving.spread + cone.spread) / 4;
  const x = cone.sx + Math.cos(angle) * 200, y = cone.sy + Math.sin(angle) * 200;
  assert.equal(inAttackCone(map, cone, x, y), false);
  assert.equal(inAttackCone(map, moving, x, y), true);
  t.vx = 0;
  assert.equal(mobileAttackCone(world, player, WEAPONS.PULSE_CARBINE)!.spread, cone.spread);
  const shotgun = mobileAttackCone(world, player, WEAPONS.BREACH_SHOTGUN)!;
  assert.equal(shotgun.range, WEAPONS.BREACH_SHOTGUN.range);
  assert.ok(shotgun.spread > cone.spread);
});
