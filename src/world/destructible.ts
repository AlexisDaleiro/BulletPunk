// Hit points of the obstacles bullets and blasts can remove. Destroying only ever turns a solid
// tile into walkable rubble, so it can open routes but never close one. `.ts` extensions: Node.
import { DESTRUCTIBLE } from '../config.ts';
import type { TileType } from '../types';
import { isDestructibleTile, type TileMap } from './TileMap.ts';

export interface HitResult {
  /** The tile that was hit (what it was before any destruction). */
  tile: TileType;
  destroyed: boolean;
  /** Remaining health, 0..1. */
  health: number;
}

export class Destructibles {
  private readonly hp = new Map<number, number>();

  constructor(map: TileMap) {
    for (let i = 0; i < map.tiles.length; i++) {
      const tile = map.tiles[i];
      if (isDestructibleTile(tile)) this.hp.set(i, DESTRUCTIBLE[tile as keyof typeof DESTRUCTIBLE].hp);
    }
  }

  snapshot(): [number, number][] { return [...this.hp.entries()]; }
  restore(entries: [number, number][]): void { this.hp.clear(); for (const [index, hp] of entries) this.hp.set(index, hp); }

  /** Applies damage to the tile at (tx, ty); null when it is not destructible (or already gone). */
  damage(map: TileMap, tx: number, ty: number, amount: number): HitResult | null {
    const tile = map.get(tx, ty);
    const i = ty * map.width + tx;
    if (!isDestructibleTile(tile) || !this.hp.has(i)) return null;
    const max = DESTRUCTIBLE[tile as keyof typeof DESTRUCTIBLE].hp;
    const left = (this.hp.get(i) as number) - amount;
    if (left > 0) {
      this.hp.set(i, left);
      return { tile, destroyed: false, health: left / max };
    }
    this.hp.delete(i);
    return { tile, destroyed: true, health: 0 };
  }
}
