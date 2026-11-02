import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELITE, elitePosition, eliteRoom } from './elite.ts';
import { generateDungeon } from '../world/DungeonGenerator.ts';
import { ENEMY, TILE_SIZE } from '../config.ts';

test('elite encounters have safe walkable positions away from arrival, across seeds and floors', () => {
  for (let seed = 1; seed <= 25; seed++) for (const floor of [1, 2, 4]) {
    const d = generateDungeon(seed, { floor });
    const room = eliteRoom(d.rooms, d.spawn);
    assert.ok(room, `${seed}/${floor}`);
    assert.ok(room.type === 'COMBAT' || room.type === 'EXIT');
    const point = elitePosition(d, room);
    assert.ok(point, `${seed}/${floor} safe spot`);
    const tx = Math.floor(point.x / TILE_SIZE), ty = Math.floor(point.y / TILE_SIZE);
    assert.equal(d.map.get(tx, ty), 'FLOOR');
    assert.ok(Math.hypot(point.x - d.spawn.x, point.y - d.spawn.y) >= 8 * TILE_SIZE);
    assert.ok(!d.plan.hazards.some(h => tx >= h.tx && tx < h.tx + h.w && ty >= h.ty && ty < h.ty + h.h));
  }
  assert.ok(ELITE.hp > ENEMY.hp && ELITE.hp < ENEMY.hp * 3);
  assert.ok(ELITE.damageMult < 1.3 && ELITE.speedMult < 1);
});
