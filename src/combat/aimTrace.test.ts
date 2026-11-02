import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traceAim } from './aimTrace.ts';
import { TileMap } from '../world/TileMap.ts';
import { TILE_SIZE as T } from '../config.ts';
import { pulseReaches } from './pulse.ts';

test('aim uses the muzzle offset and stops on solid cover while sight can continue past it', () => {
  const map = new TileMap(20, 20, 'FLOOR');
  map.set(6, 5, 'COVER');
  const ray = traceAim(map, 3.5 * T, 5.5 * T, 0, 'RAILGUN', 700);
  assert.equal(ray.sx, 3.5 * T + 38);
  assert.equal(ray.sy, 5.5 * T + 8);
  assert.equal(ray.ex, 6 * T);
  assert.equal(ray.blocked, true);
  const free = traceAim(map, 3.5 * T, 5.5 * T, Math.PI / 2, 'PISTOL', 200);
  assert.equal(free.blocked, false);
  assert.ok(Math.abs(Math.hypot(free.ex - free.sx, free.ey - free.sy) - 200) < 1e-8);
});

test('a barrel crossing a nearby wall never draws the laser through that wall', () => {
  const map = new TileMap(10, 10, 'FLOOR');
  map.set(4, 4, 'WALL');
  const ray = traceAim(map, 4 * T - 12, 4.5 * T, 0, 'RAILGUN', 500);
  assert.equal(ray.ex, 4 * T);
  assert.equal(ray.blocked, true);
});

test('EMP only reaches nearby enemies with unobstructed sight', () => {
  const map = new TileMap(20, 20, 'FLOOR');
  const x = 4.5 * T, y = 5.5 * T;
  assert.ok(pulseReaches(map, x, y, x + 100, y, 170));
  assert.ok(!pulseReaches(map, x, y, x + 200, y, 170));
  map.set(5, 5, 'WALL');
  assert.ok(!pulseReaches(map, x, y, x + 100, y, 170));
});
