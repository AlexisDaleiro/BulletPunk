import { KEY_INFO } from '../config';
import type { TilemapView } from '../render/TilemapRenderer';
import type { TileType } from '../types';
import type { Dungeon } from '../world/DungeonGenerator';
import type { Door } from '../world/locks';
import type { TileMap } from '../world/TileMap';

/**
 * The current floor: its dungeon plus the one place tiles are allowed to change. Every change
 * redraws the tilemap and notifies the owner (to rebuild the wall segments the vision uses).
 */
export class Level {
  readonly dungeon: Dungeon;
  readonly map: TileMap;
  /** Bumped on every tile change; the minimap redraws when it moves. */
  version = 0;
  private readonly view: TilemapView;
  private readonly onChanged: (level: Level) => void;

  constructor(dungeon: Dungeon, view: TilemapView, onChanged: (level: Level) => void) {
    this.dungeon = dungeon;
    this.map = dungeon.map;
    this.view = view;
    this.onChanged = onChanged;
    this.refresh();
  }

  setTiles(changes: readonly { x: number; y: number; tile: TileType }[]): void {
    for (const c of changes) this.map.set(c.x, c.y, c.tile);
    this.refresh();
  }

  unlockDoor(door: Door): void {
    door.unlocked = true;
    this.setTiles(door.tiles.map((t) => ({ x: t.x, y: t.y, tile: 'DOOR_UNLOCKED' as const })));
  }

  /** Turns every SECRET_WALL into open floor (rubble). Returns how many there were. */
  breakSecretWalls(): number {
    const broken: { x: number; y: number; tile: TileType }[] = [];
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) if (this.map.get(x, y) === 'SECRET_WALL') broken.push({ x, y, tile: 'FLOOR' });
    }
    if (broken.length > 0) this.setTiles(broken);
    return broken.length;
  }

  private refresh(): void {
    this.version++;
    const colors = new Map<number, number>();
    for (const door of this.dungeon.doors) {
      if (door.unlocked) continue;
      for (const t of door.tiles) colors.set(t.y * this.map.width + t.x, KEY_INFO[door.color].color);
    }
    this.view.rebuild(this.map, colors);
    this.onChanged(this);
  }
}
