import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE_SIZE } from '../config.ts';
import { moveAndCollide } from './collision.ts';
import { generateDungeon } from './DungeonGenerator.ts';
import { Destructibles } from './destructible.ts';
import { validateDungeon } from './validate.ts';
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
      if (r.type === 'SECRET' || r.type === 'ANNEX') continue; // small by design
      const long = Math.max(r.width, r.height);
      const short = Math.min(r.width, r.height);
      assert.ok(short >= 4 && long <= 16 && (short >= 6 || long >= 10), `seed ${seed}: room size ${r.width}x${r.height}`);
    }

    const sx = Math.floor(d.spawn.x / TILE_SIZE);
    const sy = Math.floor(d.spawn.y / TILE_SIZE);
    assert.ok(!d.map.isSolid(sx, sy), `seed ${seed}: spawn in a wall`);
    const reach = reachable(d.map, sx, sy);
    for (const r of d.rooms) {
      if (r.type === 'CHEST' || r.type === 'SECRET') continue; // behind a locked door / a hidden wall
      if (r.type === 'ANNEX' && d.plan.shutters.some((x) => x.roomId === r.id)) continue; // behind a shutter
      let any = false;
      for (let y = r.y; y < r.y + r.height; y++) for (let x = r.x; x < r.x + r.width; x++) if (reach.has(y * d.map.width + x)) any = true;
      assert.ok(any, `seed ${seed}: ${r.id} unreachable`);
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

test('floors 1-6, 80 seeds each: every layout is playable (reach, chests, secrets, hazards, terminals)', () => {
  const bad: string[] = [];
  for (let floor = 1; floor <= 6; floor++) {
    for (let seed = 1; seed <= 80; seed++) {
      for (const problem of validateDungeon(generateDungeon(seed, { floor }))) bad.push(`floor ${floor} seed ${seed}: ${problem}`);
    }
  }
  assert.deepEqual(bad.slice(0, 12), []);
});

test('destructibles: crates break after enough hits, barrels explode, walls and cover are ignored', () => {
  const m = new TileMap(5, 1, 'FLOOR');
  m.set(0, 0, 'CRATE');
  m.set(1, 0, 'BARREL');
  m.set(2, 0, 'WEAK_WALL');
  m.set(3, 0, 'COVER');
  m.set(4, 0, 'WALL');
  const d = new Destructibles(m);
  const first = d.damage(m, 0, 0, 20);
  assert.ok(first && !first.destroyed && first.health > 0 && first.health < 1);
  assert.equal(d.damage(m, 0, 0, 50)?.destroyed, true);
  m.set(0, 0, 'RUBBLE');
  assert.equal(d.damage(m, 0, 0, 50), null, 'rubble can not be hit again');
  assert.deepEqual([d.damage(m, 1, 0, 100)?.tile, d.damage(m, 2, 0, 20)?.destroyed], ['BARREL', false]);
  assert.equal(d.damage(m, 3, 0, 999), null, 'cover is permanent');
  assert.equal(d.damage(m, 4, 0, 999), null, 'walls are permanent');
});

test('destroying an obstacle never makes a floor less walkable', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const d = generateDungeon(seed, { floor: 3 });
    const sx = Math.floor(d.spawn.x / TILE_SIZE);
    const sy = Math.floor(d.spawn.y / TILE_SIZE);
    const before = reachable(d.map, sx, sy).size;
    for (let i = 0; i < d.map.tiles.length; i++) if (['CRATE', 'BARREL', 'WEAK_WALL'].includes(d.map.tiles[i])) d.map.tiles[i] = 'RUBBLE';
    assert.ok(reachable(d.map, sx, sy).size >= before, `seed ${seed}`);
  }
});
