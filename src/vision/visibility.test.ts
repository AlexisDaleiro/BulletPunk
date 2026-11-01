import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE_SIZE as T } from '../config.ts';
import { TileMap } from '../world/TileMap.ts';
import { extractWallEdges } from '../world/wallEdges.ts';
import { computeVisibility, pointInPolygon } from './visibility.ts';

const FOV = (80 * Math.PI) / 180;

/** 30x30 walled hall with a single pillar at tile (18, 15). Eye at the center of tile (15, 15). */
function hall() {
  const map = new TileMap(30, 30, 'WALL');
  for (let y = 1; y < 29; y++) for (let x = 1; x < 29; x++) map.set(x, y, 'FLOOR');
  map.set(18, 15, 'WALL');
  return { segments: extractWallEdges(map), eye: { x: 15.5 * T, y: 15.5 * T } };
}

const view = (eye: { x: number; y: number }, angle: number) => ({
  ...eye,
  angle,
  fov: FOV,
  range: 420,
  proximity: 65,
});

test('pointInPolygon: square', () => {
  const sq = [0, 0, 10, 0, 10, 10, 0, 10];
  assert.ok(pointInPolygon(sq, 5, 5));
  assert.ok(!pointInPolygon(sq, 15, 5));
  assert.ok(!pointInPolygon(sq, 5, -1));
});

test('cone sees ahead, ring sees close behind, nothing else', () => {
  const { segments, eye } = hall();
  const poly = computeVisibility(segments, view(eye, Math.PI / 2)); // facing south, nothing in the way
  const at = (dx: number, dy: number) => pointInPolygon(poly, eye.x + dx, eye.y + dy);

  assert.ok(at(0, 300), 'ahead, in cone');
  assert.ok(at(0, 400), 'ahead, near max range');
  assert.ok(!at(0, 440), 'ahead, beyond range');
  assert.ok(at(30, 200), 'ahead, slightly off-axis inside 40 degrees');
  assert.ok(!at(300, 100), 'to the side, outside the cone');
  assert.ok(at(0, -50), 'behind but inside the proximity ring');
  assert.ok(!at(0, -150), 'behind and outside the ring');
});

test('walls block sight: nothing behind a pillar, still lit beside it', () => {
  const { segments, eye } = hall();
  const poly = computeVisibility(segments, view(eye, 0)); // facing east into the pillar
  const at = (dx: number, dy: number) => pointInPolygon(poly, eye.x + dx, eye.y + dy);

  assert.ok(at(2.2 * T, 0), 'just before the pillar');
  assert.ok(!at(4.5 * T, 0), 'in the pillar shadow');
  assert.ok(at(4.5 * T, -1.5 * T), 'beside the pillar: inside the cone, outside its shadow');
});

test('polygon never leaves the hall, even from a corner', () => {
  const { segments } = hall();
  const poly = computeVisibility(segments, view({ x: 2.5 * T, y: 2.5 * T }, Math.PI * 1.25)); // facing the corner
  for (let i = 0; i < poly.length; i += 2) {
    assert.ok(poly[i] >= T - 3 && poly[i] <= 29 * T + 3, `x ${poly[i]}`);
    assert.ok(poly[i + 1] >= T - 3 && poly[i + 1] <= 29 * T + 3, `y ${poly[i + 1]}`);
  }
});

test('output buffer is reused and cleared', () => {
  const { segments, eye } = hall();
  const out: number[] = [1, 2, 3];
  assert.equal(computeVisibility(segments, view(eye, 0), out), out);
  assert.ok(out.length > 6 && out[0] !== 1);
});
