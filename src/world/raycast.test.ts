import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE_SIZE as T } from '../config.ts';
import { canSee, lineOfSight, raycastTiles, segmentCircle } from './raycast.ts';
import { TileMap } from './TileMap.ts';

/** 9x5 hall: floor on rows 1-3, one wall column at x=4 (rows 1-3), cover at (6,2). */
function hall() {
  const m = new TileMap(9, 5, 'WALL');
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 7; x++) m.set(x, y, 'FLOOR');
  for (let y = 1; y <= 3; y++) m.set(4, y, 'WALL');
  m.set(6, 2, 'COVER');
  return m;
}

test('raycastTiles reports the entry point and face normal', () => {
  const m = hall();
  const solid = (x: number, y: number) => m.isSolid(x, y);
  const hit = raycastTiles(solid, 2.5 * T, 2.5 * T, 6.5 * T, 2.5 * T);
  assert.ok(hit);
  assert.ok(Math.abs(hit.t - 1.5 / 4) < 1e-9); // enters tile 4 at x = 4*T, 1.5T into a 4T segment
  assert.equal(hit.nx, -1); // moving +x hits the wall's west face
  assert.equal(hit.ny, 0);
  assert.equal(raycastTiles(solid, 1.5 * T, 2.5 * T, 3.5 * T, 2.5 * T), null);
  assert.deepEqual(raycastTiles(solid, 4.5 * T, 2.5 * T, 5.5 * T, 2.5 * T), { t: 0, nx: 0, ny: 0 }); // starts inside
});

test('raycastTiles handles diagonals and the zero-length segment', () => {
  const m = hall();
  const solid = (x: number, y: number) => m.isSolid(x, y);
  const hit = raycastTiles(solid, 1.5 * T, 1.5 * T, 1.5 * T + 100, 1.5 * T - 100); // up-right into the top wall
  assert.ok(hit && hit.ny === 1);
  assert.equal(raycastTiles(solid, 2.5 * T, 2.5 * T, 2.5 * T, 2.5 * T), null);
});

test('cover stops bullets but not sight', () => {
  const m = hall();
  const solid = (x: number, y: number) => m.isSolid(x, y);
  assert.ok(raycastTiles(solid, 5.5 * T, 2.5 * T, 7.5 * T, 2.5 * T)); // bullet blocked by cover
  assert.ok(lineOfSight(m, 5.5 * T, 2.5 * T, 7.5 * T, 2.5 * T)); // sight is not
  assert.ok(!lineOfSight(m, 2.5 * T, 2.5 * T, 6.5 * T, 2.5 * T)); // wall column blocks sight
});

test('canSee: range, cone and walls', () => {
  const m = hall();
  const fov = (65 * Math.PI) / 180;
  assert.ok(canSee(m, 1.5 * T, 2.5 * T, 0, fov, 350, 3.5 * T, 2.5 * T)); // ahead, clear
  assert.ok(!canSee(m, 1.5 * T, 2.5 * T, Math.PI, fov, 350, 3.5 * T, 2.5 * T)); // facing away
  assert.ok(!canSee(m, 1.5 * T, 2.5 * T, 0, fov, 350, 6.5 * T, 2.5 * T)); // wall in between
  assert.ok(!canSee(m, 1.5 * T, 2.5 * T, 0, fov, 50, 3.5 * T, 2.5 * T)); // too far
});

test('segmentCircle: hit, miss, start inside, tunnelling guard', () => {
  assert.ok(Math.abs((segmentCircle(0, 0, 100, 0, 50, 0, 10) as number) - 0.4) < 1e-9);
  assert.equal(segmentCircle(0, 0, 100, 0, 50, 30, 10), null);
  assert.equal(segmentCircle(50, 0, 100, 0, 50, 0, 10), 0);
  assert.ok(segmentCircle(0, 0, 1800 / 60, 0, 20, 0, 12) !== null); // railgun step vs a body 20 px away
  assert.equal(segmentCircle(0, 0, 10, 0, 50, 0, 10), null); // short of the target
});
