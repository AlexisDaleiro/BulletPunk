import type { Room } from '../types.ts';
import { TILE_SIZE } from '../config.ts';
import type { Dungeon } from '../world/DungeonGenerator.ts';

export const ELITE = {
  hp: 90, shield: 20, damageMult: 1.15, speedMult: 0.88, bonusCredits: 25,
  weapon: 'AUTO_SMG' as const,
};

/** Replace one regular guard per floor, in an encounter away from the arrival point. */
export function eliteRoom(rooms: readonly Room[], spawn: { x: number; y: number }): Room | undefined {
  const eligible = rooms.filter(r => (r.type === 'COMBAT' || r.type === 'EXIT') && Math.hypot((r.x + r.width / 2) * TILE_SIZE - spawn.x, (r.y + r.height / 2) * TILE_SIZE - spawn.y) >= TILE_SIZE * 8);
  return eligible.find(r => r.kind === 'SECURITY') ?? eligible.find(r => r.kind === 'DEPOT') ?? eligible.find(r => r.type === 'EXIT') ?? eligible[0];
}

/** The elite waits on safe ground, rather than spawning inside a shock plate or toxic pool. */
export function elitePosition(dungeon: Dungeon, room: Room): { x: number; y: number } | undefined {
  const candidates: { x: number; y: number; distance: number }[] = [];
  for (let ty = room.y + 1; ty < room.y + room.height - 1; ty++) for (let tx = room.x + 1; tx < room.x + room.width - 1; tx++) {
    if (dungeon.map.get(tx, ty) !== 'FLOOR') continue;
    const x = (tx + 0.5) * TILE_SIZE, y = (ty + 0.5) * TILE_SIZE;
    if (Math.hypot(x - dungeon.spawn.x, y - dungeon.spawn.y) < TILE_SIZE * 8) continue;
    if (dungeon.plan.hazards.some(h => tx >= h.tx && tx < h.tx + h.w && ty >= h.ty && ty < h.ty + h.h)) continue;
    if (dungeon.plan.chests.some(c => tx === c.tx && ty === c.ty)) continue;
    if (dungeon.plan.terminals.some(c => tx === c.tx && ty === c.ty)) continue;
    candidates.push({ x, y, distance: Math.hypot(tx + 0.5 - room.x - room.width / 2, ty + 0.5 - room.y - room.height / 2) });
  }
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0];
}
