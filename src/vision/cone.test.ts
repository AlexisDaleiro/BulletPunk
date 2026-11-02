import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visionFan } from './cone.ts';
import { computeVisibility, pointInPolygon } from './visibility.ts';

test('the visible cone follows aim across the angle seam and excludes the proximity ring', () => {
  for (const facing of [0, Math.PI / 2, Math.PI - 0.01, -Math.PI + 0.01]) {
    const view = { x: 100, y: 100, angle: facing, fov: Math.PI / 2, range: 400, proximity: 65 };
    const sight = computeVisibility([], view);
    const fan = visionFan(sight, view.x, view.y, facing, view.fov);
    assert.ok(pointInPolygon(fan, 100 + Math.cos(facing) * 200, 100 + Math.sin(facing) * 200));
    assert.ok(!pointInPolygon(fan, 100 - Math.cos(facing) * 30, 100 - Math.sin(facing) * 30));
    assert.ok(!pointInPolygon(fan, 100 + Math.cos(facing) * 410, 100 + Math.sin(facing) * 410));
  }
});

test('the flashlight contour stays clipped to walls, including with extended vision', () => {
  const walls = [{ x1: 120, y1: -300, x2: 120, y2: 300 }];
  const view = { x: 0, y: 0, angle: 0, fov: Math.PI / 2, range: 700, proximity: 65 };
  const sight = computeVisibility(walls, view);
  const out: number[] = [999];
  const fan = visionFan(sight, 0, 0, 0, view.fov, out);
  assert.equal(fan, out);
  assert.ok(pointInPolygon(fan, 100, 0));
  assert.ok(!pointInPolygon(fan, 140, 0));
  for (let i = 0; i < fan.length; i += 2) assert.ok(fan[i] <= 122.01);
  assert.equal(visionFan([], 0, 0, 0, view.fov, out).length, 0);
});
