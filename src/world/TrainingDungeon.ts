import { TILE_SIZE as T } from '../config';
import type { Dungeon } from './DungeonGenerator';
import { TileMap } from './TileMap';
import { Plan } from './plan';

export function trainingDungeon(): Dungeon {
  const map = new TileMap(28, 22),
    plan = new Plan();
  for (let y = 2; y < 20; y++)
    for (let x = 2; x < 26; x++) {
      map.set(x, y, x === 2 || x === 25 || y === 2 || y === 19 ? 'WALL' : 'FLOOR');
      map.variants[y * map.width + x] = (x + y) % 4;
    }
  for (const [x, y] of [
    [12, 8],
    [12, 9],
    [12, 15],
    [12, 16],
  ])
    map.set(x, y, 'COVER');
  plan.lights = [
    { x: 6 * T, y: 5 * T, r: 210, color: 0x8bd5c5, alpha: 0.24, flicker: false },
    { x: 20 * T, y: 6 * T, r: 220, color: 0xe8b776, alpha: 0.25, flicker: false },
  ];
  return {
    seed: 0x50524143,
    floor: 1,
    map,
    plan,
    rooms: [
      {
        id: 'range',
        x: 2,
        y: 2,
        width: 24,
        height: 18,
        type: 'SPAWN',
        kind: 'WORKSHOP',
        sector: 'MILITARY',
        connectedRoomIds: [],
        cleared: true,
      },
    ],
    spawn: { x: 7.5 * T, y: 12.5 * T },
    doors: [],
    keyRooms: {},
    elevator: { x: 0, y: 0 },
  };
}
