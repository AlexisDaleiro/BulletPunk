import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE_SIZE as T } from '../config.ts';
import { generateDungeon } from './DungeonGenerator.ts';
import { findPath, type Point } from './pathfinding.ts';
import { raycastTiles } from './raycast.ts';
import { TileMap } from './TileMap.ts';

/** 9x9 room split by a wall at x=4 with a single gap at y=7. */
function split() {
  const m = new TileMap(9, 9, 'WALL');
  for (let y = 1; y <= 7; y++) for (let x = 1; x <= 7; x++) m.set(x, y, 'FLOOR');
  for (let y = 1; y <= 6; y++) m.set(4, y, 'WALL');
  return m;
}

const legsClear = (m: TileMap, from: Point, path: Point[]): boolean => {
  let prev = from;
  for (const p of path) {
    if (raycastTiles((x, y) => m.isSolid(x, y), prev.x, prev.y, p.x, p.y)) return false;
    prev = p;
  }
  return true;
};

test('path detours through the gap, ends exactly at the target, never clips a wall', () => {
  const m = split();
  const from = { x: 1.5 * T, y: 1.5 * T };
  const to = { x: 7.5 * T, y: 1.5 * T };
  const path = findPath(m, from, to);
  assert.ok(path.length >= 2, 'needs a detour');
  assert.deepEqual(path[path.length - 1], to);
  assert.ok(legsClear(m, from, path)); // clear legs across a split room imply going through the gap
});

test('open ground collapses to a single leg; same tile returns the target', () => {
  const m = split();
  const to = { x: 3.5 * T, y: 5.5 * T };
  assert.equal(findPath(m, { x: 1.5 * T, y: 1.5 * T }, to).length, 1);
  assert.deepEqual(findPath(m, { x: 1.2 * T, y: 1.2 * T }, { x: 1.8 * T, y: 1.8 * T }), [{ x: 1.8 * T, y: 1.8 * T }]);
});

test('unreachable or solid targets give an empty path', () => {
  const m = split();
  m.set(4, 7, 'WALL'); // seal the gap
  assert.deepEqual(findPath(m, { x: 1.5 * T, y: 1.5 * T }, { x: 7.5 * T, y: 1.5 * T }), []);
  assert.deepEqual(findPath(m, { x: 1.5 * T, y: 1.5 * T }, { x: 4.5 * T, y: 3.5 * T }), []);
});

test('every room of 20 dungeons is reachable from the spawn room', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const d = generateDungeon(seed);
    for (const r of d.rooms) {
      if (r.type === 'CHEST' || r.type === 'SECRET') continue; // sealed until a key or a blast
      const to = { x: (r.x + Math.floor(r.width / 2) + 0.5) * T, y: (r.y + Math.floor(r.height / 2) + 0.5) * T };
      const path = findPath(d.map, d.spawn, to);
      assert.ok(path.length > 0 || Math.hypot(to.x - d.spawn.x, to.y - d.spawn.y) < T, `seed ${seed} ${r.id}`);
      assert.ok(legsClear(d.map, d.spawn, path), `seed ${seed} ${r.id}: clipped a wall`);
    }
  }
});
