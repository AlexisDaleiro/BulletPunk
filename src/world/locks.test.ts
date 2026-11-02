import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeon } from './DungeonGenerator.ts';
import { floodRooms, isSolvable, roomCenter, topoOrder, type Door } from './locks.ts';

const door = (color: Door['color'], sealedRoomId: string): Door => ({ color, tiles: [], sealedRoomId, unlocked: false });

test('topoOrder: chain order, cycle detection, missing keys', () => {
  const chain = topoOrder([door('red', 'A'), door('blue', 'B')], { red: 'open', blue: 'A', gold: 'B' });
  assert.ok(chain);
  const at = (n: string) => chain.indexOf(n);
  assert.ok(at('key:red') < at('door:red') && at('door:red') < at('key:blue'));
  assert.ok(at('key:blue') < at('door:blue') && at('door:blue') < at('key:gold') && at('key:gold') < at('exit'));

  // The red key sits inside the room the red door seals: it can never be fetched.
  assert.equal(topoOrder([door('red', 'A')], { red: 'A', gold: 'open' }), null);
  // Two doors that each hold the other's key.
  assert.equal(topoOrder([door('red', 'A'), door('blue', 'B')], { red: 'B', blue: 'A', gold: 'open' }), null);
  assert.equal(topoOrder([door('red', 'A')], { gold: 'A' }), null, 'lock without a key');
  assert.equal(topoOrder([], {}), null, 'no Core Key');
  assert.deepEqual(topoOrder([], { gold: 'open' }), ['key:gold', 'exit']);
});

test('every generated floor (floors 1-4, 100 seeds each) is solvable and its lock graph is acyclic', () => {
  let twoDoors = 0;
  let oneDoor = 0;
  for (let floor = 1; floor <= 4; floor++) {
    for (let seed = 1; seed <= 100; seed++) {
      const d = generateDungeon(seed, { floor });
      const label = `floor ${floor} seed ${seed}`;
      assert.ok(isSolvable(d.map, d.rooms, d.doors, d.keyRooms), `${label}: unsolvable`);
      assert.ok(topoOrder(d.doors, d.keyRooms), `${label}: cyclic locks`);
      if (d.doors.length === 2) twoDoors++;
      if (d.doors.length === 1) oneDoor++;

      for (const door of d.doors) {
        const sealed = d.rooms.find((r) => r.id === door.sealedRoomId);
        assert.equal(sealed?.type, 'CHEST', `${label}: sealed room type`);
        for (const t of door.tiles) assert.equal(d.map.get(t.x, t.y), 'DOOR_LOCKED');
        // Closed doors really do cut the room off from the spawn.
        const spawnRoom = d.rooms.find((r) => r.type === 'SPAWN');
        assert.ok(spawnRoom && !floodRooms(d.map, d.rooms, roomCenter(spawnRoom)).has(door.sealedRoomId));
      }
    }
  }
  assert.ok(twoDoors > 40, `only ${twoDoors} floors had two doors`);
  assert.ok(oneDoor + twoDoors > 300, 'most floors should have locks');
});

test('a key that is unreachable makes the floor unsolvable (the validator can fail)', () => {
  const d = generateDungeon(3, { floor: 1 });
  const broken = { ...d.keyRooms, gold: d.rooms.find((r) => r.type === 'SECRET')?.id ?? 'room-nowhere' };
  assert.equal(isSolvable(d.map, d.rooms, d.doors, broken), false);
});

test('shops only on even floors, at most one, never holding a key', () => {
  for (let floor = 1; floor <= 4; floor++) {
    for (let seed = 1; seed <= 60; seed++) {
      const d = generateDungeon(seed, { floor });
      const shops = d.rooms.filter((r) => r.type === 'SHOP');
      assert.ok(shops.length <= (floor % 2 === 0 ? 1 : 0), `floor ${floor} seed ${seed}: ${shops.length} shops`);
      for (const s of shops) assert.ok(!Object.values(d.keyRooms).includes(s.id));
    }
  }
});

test('secret rooms: one hidden wall each, sealed until it is pushed, reachable afterwards', () => {
  let withSecret = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const d = generateDungeon(seed, { floor: 1 + (seed % 4) });
    const walls: { x: number; y: number }[] = [];
    for (let y = 0; y < d.map.height; y++) for (let x = 0; x < d.map.width; x++) if (d.map.get(x, y) === 'SECRET_WALL') walls.push({ x, y });
    assert.equal(walls.length, d.plan.secrets.length, `seed ${seed}: wall count`);
    const spawnRoom = d.rooms.find((r) => r.type === 'SPAWN');
    assert.ok(spawnRoom);
    for (const s of d.plan.secrets) {
      withSecret++;
      const room = d.rooms.find((r) => r.id === s.roomId);
      assert.ok(room);
      assert.ok(!floodRooms(d.map, d.rooms, roomCenter(spawnRoom)).has(room.id), `seed ${seed}: secret room is open`);
      d.map.set(s.wall.x, s.wall.y, 'FLOOR');
      assert.ok(floodRooms(d.map, d.rooms, roomCenter(spawnRoom)).has(room.id), `seed ${seed}: the wall does not lead in`);
    }
  }
  assert.ok(withSecret >= 150, `only ${withSecret} secret rooms in 150 floors`);
});
