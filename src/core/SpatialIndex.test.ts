import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpatialIndex } from './SpatialIndex.ts';
import { createRng } from './rng.ts';
import { segmentCircle } from '../world/raycast.ts';
import { computeVisibility } from '../vision/visibility.ts';

test('spatial queries include negative coordinates, border contacts, long objects and deduplicate cells', () => {
  const grid = new SpatialIndex(64);
  grid.insert(1, -65, -1, 128, 1);
  grid.insert(2, 64, 64);
  grid.insert(3, 500, 500);
  assert.deepEqual([...grid.query(-64, -1, 64, 64)].sort(), [1, 2]);
  grid.clear();
  assert.equal(grid.query(-500, -500, 1000, 1000).length, 0);
});
test('projectile broad phase preserves every exact hit on randomized swept segments', () => {
  const rng = createRng(789),
    grid = new SpatialIndex(),
    bodies = Array.from({ length: 250 }, (_, id) => ({
      id,
      x: rng.next() * 2400 - 1200,
      y: rng.next() * 2400 - 1200,
      r: 8 + rng.next() * 24,
    }));
  for (const b of bodies) grid.insert(b.id, b.x - b.r, b.y - b.r, b.x + b.r, b.y + b.r);
  let indexed = 0;
  for (let i = 0; i < 400; i++) {
    const x = rng.next() * 2400 - 1200,
      y = rng.next() * 2400 - 1200,
      ex = x + rng.next() * 400 - 200,
      ey = y + rng.next() * 400 - 200;
    const candidates = [...grid.query(Math.min(x, ex), Math.min(y, ey), Math.max(x, ex), Math.max(y, ey))];
    indexed += candidates.length;
    const exact = (id: number) => {
      const b = bodies[id];
      return segmentCircle(x, y, ex, ey, b.x, b.y, b.r) !== null;
    };
    assert.deepEqual(
      candidates.filter(exact).sort((a, b) => a - b),
      bodies.filter((b) => exact(b.id)).map((b) => b.id),
    );
  }
  assert.ok(indexed < 400 * bodies.length * 0.15);
});
test('indexed wall candidates produce the same visibility polygon as the complete geometry', () => {
  const rng = createRng(456),
    grid = new SpatialIndex(256),
    segments = Array.from({ length: 150 }, () => {
      const x = rng.next() * 2500,
        y = rng.next() * 2500;
      return { x1: x, y1: y, x2: x + (rng.next() > 0.5 ? 200 : 0), y2: y + (rng.next() > 0.5 ? 200 : 0) };
    });
  segments.forEach((s, i) => grid.insert(i, s.x1, s.y1, s.x2, s.y2));
  for (let i = 0; i < 25; i++) {
    const view = {
      x: rng.next() * 2500,
      y: rng.next() * 2500,
      angle: rng.next() * 6,
      fov: 1.4,
      range: 420,
      proximity: 65,
    };
    const subset = [...grid.query(view.x - 420, view.y - 420, view.x + 420, view.y + 420)].map((id) => segments[id]);
    assert.deepEqual(computeVisibility(subset, view), computeVisibility(segments, view));
  }
});
