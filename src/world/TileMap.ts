import type { TileType } from '../types';
// `.ts` extension: Node's test runner needs it for runtime imports (type imports are erased).
import { TILE_SIZE } from '../config.ts';

/** Tiles that stop movement. Out-of-bounds counts as VOID. */
const SOLID = new Set<TileType>(['VOID', 'WALL', 'COVER', 'DOOR_LOCKED', 'SECRET_WALL']);
/** Tiles that stop sight. COVER is low enough to see over. */
const OPAQUE = new Set<TileType>(['VOID', 'WALL', 'DOOR_LOCKED', 'SECRET_WALL']);

/** Tile grid, row-major. Mutable so doors and secret walls can change at runtime. */
export class TileMap {
  readonly width: number;
  readonly height: number;
  readonly tiles: TileType[];

  constructor(width: number, height: number, fill: TileType = 'VOID') {
    this.width = width;
    this.height = height;
    this.tiles = new Array<TileType>(width * height).fill(fill);
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  get(tx: number, ty: number): TileType {
    return this.inBounds(tx, ty) ? this.tiles[ty * this.width + tx] : 'VOID';
  }

  set(tx: number, ty: number, tile: TileType): void {
    if (this.inBounds(tx, ty)) this.tiles[ty * this.width + tx] = tile;
  }

  isSolid(tx: number, ty: number): boolean {
    return SOLID.has(this.get(tx, ty));
  }

  blocksSight(tx: number, ty: number): boolean {
    return OPAQUE.has(this.get(tx, ty));
  }

  /** Tile coordinate containing a world-pixel coordinate. */
  static toTile(px: number): number {
    return Math.floor(px / TILE_SIZE);
  }
}
