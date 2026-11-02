import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SwipeAim } from './SwipeAim.ts';

test('horizontal swipes accumulate once per step, independent of event frequency', () => {
  const aim = new SwipeAim();
  aim.begin(1, 500);
  aim.move(600, 1000);
  aim.move(750, 1000);
  assert.ok(Math.abs(aim.takeTurn() - Math.PI / 2) < 1e-10);
  assert.equal(aim.takeTurn(), 0);
  aim.move(500, 1000);
  assert.ok(Math.abs(aim.takeTurn() + Math.PI / 2) < 1e-10);
});

test('lifting keeps a short swipe; touching again does not jump; cancellation drops queued rotation', () => {
  const aim = new SwipeAim();
  aim.begin(1, 500);
  aim.move(600, 1000);
  aim.end();
  assert.notEqual(aim.takeTurn(), 0);
  aim.begin(2, 900);
  assert.equal(aim.takeTurn(), 0);
  aim.move(950, 1000);
  aim.reset();
  assert.equal(aim.pointerId, null);
  assert.equal(aim.takeTurn(), 0);
});
