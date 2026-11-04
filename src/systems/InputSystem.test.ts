import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputSystem } from './InputSystem.ts';
import type { InputManager, InputState } from '../input/InputManager.ts';
import type { RenderSystem } from './RenderSystem.ts';
import { World } from '../ecs/World.ts';
import { createIntent, createTransform } from '../ecs/components.ts';
import { GameState } from '../game/GameState.ts';

test('mobile can strafe without changing aim and uses automatic targeting even with no finger held', () => {
  const world = new World();
  const player = world.create();
  world.add(player, 'playerControlled', {}).add(player, 'transform', createTransform(100, 100))
    .add(player, 'intent', createIntent(0.7));
  const sample: InputState = { mode: 'touch', moveX: -1, moveY: 0, hasPointer: false, pointerX: 0, pointerY: 0,
    aimDirection: null, fire: false, ability: false, dash: false, reload: false, interact: false, swap: false };
  const system = new InputSystem({ poll: () => sample } as InputManager, {} as RenderSystem, new GameState());
  system.update(world);
  const intent = world.get(player, 'intent')!;
  assert.ok(Math.abs(intent.aimAngle - 0.7) < 1e-10);
  assert.equal(intent.moveX, -1);
  assert.equal(intent.autoFire, true);
  assert.equal(intent.wantsFire, false);
  sample.aimDirection = { x: 0, y: -1 };
  system.update(world);
  assert.equal(intent.aimAngle, -Math.PI / 2);
  sample.aimDirection = null;
  sample.moveX = 0;
  system.update(world);
  assert.equal(intent.aimAngle, -Math.PI / 2);
  assert.equal(intent.autoFire, true);
  sample.mode = 'desktop';
  sample.fire = true;
  system.update(world);
  assert.equal(intent.autoFire, false);
  assert.equal(intent.wantsFire, true);
});
