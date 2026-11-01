import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE_SIZE } from '../config.ts';
import { moveAndCollide } from './collision.ts';
import { generateDungeon } from './DungeonGenerator.ts';
import { TileMap } from './TileMap.ts';
import { extractWallEdges } from './wallEdges.ts';

/** Tiles reachable from (sx, sy) walking 4-connected over non-solid tiles. */
function reachable(map: TileMap, sx: number, sy: number): Set<number> {
  const seen = new Set<number>([sy * map.width + sx]);
  const stack = [[sx, sy]];
  for (let cur = stack.pop(); cur; cur = stack.pop()) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tx = cur[0] + dx;
      const ty = cur[1] + dy;
      const key = ty * map.width + tx;
      if (seen.has(key) || map.isSolid(tx, ty)) continue;
      seen.add(key);
      stack.push([tx, ty]);
    }
  }
  return seen;
}

test('200 seeds: sane rooms, one connected floor, spawn/exit assigned, border sealed', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const d = generateDungeon(seed);
    assert.ok(d.rooms.length >= 4, `seed ${seed}: ${d.rooms.length} rooms`);
    assert.equal(d.rooms.filter((r) => r.type === 'SPAWN').length, 1);
    assert.equal(d.rooms.filter((r) => r.type === 'EXIT').length, 1);

    for (const r of d.rooms) {
      assert.ok(r.width >= 6 && r.width <= 14 && r.height >= 6 && r.height <= 14, `seed ${seed}: room size`);
    }

    const sx = Math.floor(d.spawn.x / TILE_SIZE);
    const sy = Math.floor(d.spawn.y / TILE_SIZE);
    assert.ok(!d.map.isSolid(sx, sy), `seed ${seed}: spawn in a wall`);
    const reach = reachable(d.map, sx, sy);
    for (const r of d.rooms) {
      const cx = r.x + Math.floor(r.width / 2);
      const cy = r.y + Math.floor(r.height / 2);
      assert.ok(reach.has(cy * d.map.width + cx), `seed ${seed}: ${r.id} unreachable`);
    }

    for (let i = 0; i < d.map.width; i++) {
      for (const [x, y] of [[i, 0], [i, d.map.height - 1], [0, i], [d.map.width - 1, i]]) {
        assert.ok(d.map.isSolid(x, y), `seed ${seed}: open border tile ${x},${y}`);
      }
    }
  }
});

test('same seed, same dungeon; different seed, different dungeon', () => {
  assert.deepEqual(generateDungeon(7).map.tiles, generateDungeon(7).map.tiles);
  assert.notDeepEqual(generateDungeon(7).map.tiles, generateDungeon(8).map.tiles);
});

test('wall edges: lone floor tile gives 4 unit-tile segments; a 3-wide hall merges its sides', () => {
  const one = new TileMap(3, 3, 'WALL');
  one.set(1, 1, 'FLOOR');
  assert.equal(extractWallEdges(one).length, 4);

  const hall = new TileMap(5, 3, 'WALL');
  for (let x = 1; x <= 3; x++) hall.set(x, 1, 'FLOOR');
  const edges = extractWallEdges(hall);
  assert.equal(edges.length, 4); // top, bottom, left cap, right cap
  assert.ok(edges.some((s) => s.y1 === TILE_SIZE && s.y2 === TILE_SIZE && s.x2 - s.x1 === 3 * TILE_SIZE));
});

test('cover blocks movement but not sight', () => {
  const m = new TileMap(3, 3, 'FLOOR');
  m.set(1, 1, 'COVER');
  assert.ok(m.isSolid(1, 1));
  assert.ok(!m.blocksSight(1, 1));
});

test('collision: stops at a wall, slides along it, escapes from inside one', () => {
  const m = new TileMap(5, 5, 'WALL');
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) m.set(x, y, 'FLOOR');
  const half = 11;
  const T = TILE_SIZE;

  const b = { x: 2.5 * T, y: 2.5 * T, vx: 0, vy: 0 };
  for (let i = 0; i < 30; i++) {
    b.vx = 600; // collision zeroes the blocked axis, so push every step like a held key
    b.vy = 100;
    moveAndCollide(m, b, half, 1 / 60);
  }
  assert.ok(Math.abs(b.x - (4 * T - half)) < 1e-9, `x=${b.x}`); // flush against the east wall
  assert.ok(b.y > 2.5 * T); // kept sliding south meanwhile

  const stuck = { x: 0.5 * T, y: 2.5 * T, vx: 0, vy: 0 }; // spawned inside the west wall
  moveAndCollide(m, stuck, half, 1 / 60);
  assert.ok(stuck.x >= 1 * T + half - 1e-9);
});
