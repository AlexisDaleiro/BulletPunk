import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostileVisible } from './hostileVisibility.ts';
import { computeVisibility } from './visibility.ts';

test('close enemies behind the player stay hidden even inside the old proximity ring', () => {
  const view = { x: 0, y: 0, angle: 0, fov: Math.PI / 2, range: 420, proximity: 65 };
  const polygon = computeVisibility([], view);
  assert.ok(hostileVisible(view, polygon, 100, 0));
  assert.ok(!hostileVisible(view, polygon, -20, 0));
  assert.ok(!hostileVisible(view, polygon, 0, 30));
  assert.ok(!hostileVisible(view, polygon, 450, 0));
});

test('an enemy is hidden by a wall and becomes visible only after rotating the cone toward it', () => {
  const view = { x: 0, y: 0, angle: 0, fov: Math.PI / 2, range: 420, proximity: 65 };
  const walls = [{ x1: 80, y1: -100, x2: 80, y2: 100 }];
  assert.ok(!hostileVisible(view, computeVisibility(walls, view), 150, 0));
  const turned = { ...view, angle: Math.PI };
  assert.ok(hostileVisible(turned, computeVisibility([], turned), -150, 0));
});
