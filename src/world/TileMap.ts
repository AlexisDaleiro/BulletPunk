import type { TileType } from '../types';
// `.ts` extension: Node's test runner needs it for runtime imports (type imports are erased).
import { TILE_SIZE } from '../config.ts';

/** Tiles that stop movement. Out-of-bounds counts as VOID. */
const SOLID = new Set<TileType>([
  'VOID', 'WALL', 'COVER', 'DOOR_LOCKED', 'SECRET_WALL', 'CRATE', 'BARREL', 'CONTAINER', 'MACHINE', 'WEAK_WALL', 'SHUTTER',
]);
/** Tiles that stop sight. COVER is low enough to see over. */
const OPAQUE = new Set<TileType>(['VOID', 'WALL', 'DOOR_LOCKED', 'SECRET_WALL', 'CONTAINER', 'WEAK_WALL', 'SHUTTER']);
/** Tiles bullets and blasts can remove. Everything else is permanent until a door/terminal acts on it. */
const DESTRUCTIBLE = new Set<TileType>(['CRATE', 'BARREL', 'WEAK_WALL']);

export const isDestructibleTile = (tile: TileType): boolean => DESTRUCTIBLE.has(tile);
export const isSolidTile = (tile: TileType): boolean => SOLID.has(tile);
export const isOpaqueTile = (tile: TileType): boolean => OPAQUE.has(tile);

/** Tile grid, row-major. Mutable so doors and secret walls can change at runtime. */
export class TileMap {
  readonly width: number;
  readonly height: number;
  readonly tiles: TileType[];
  /** Per-tile look selector (paint color, machine model, orientation). Gameplay never reads it. */
  readonly variants: Uint8Array;

  constructor(width: number, height: number, fill: TileType = 'VOID') {
    this.width = width;
    this.height = height;
    this.tiles = new Array<TileType>(width * height).fill(fill);
    this.variants = new Uint8Array(width * height);
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

  variant(tx: number, ty: number): number {
    return this.inBounds(tx, ty) ? this.variants[ty * this.width + tx] : 0;
  }

  setWithVariant(tx: number, ty: number, tile: TileType, variant: number): void {
    if (!this.inBounds(tx, ty)) return;
    this.tiles[ty * this.width + tx] = tile;
    this.variants[ty * this.width + tx] = variant;
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
