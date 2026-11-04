import { DESTRUCTIBLE, TILE_SIZE } from '../config';
import type { TilemapView } from '../render/TilemapRenderer';
import type { TileType } from '../types';
import { Destructibles } from '../world/destructible';
import type { Dungeon } from '../world/DungeonGenerator';
import type { Door } from '../world/locks';
import type { SecretPlan } from '../world/plan';
import { isOpaqueTile, type TileMap } from '../world/TileMap';
import type { CombatSource } from '../render/LiveScenery';

export interface TileChange {
  x: number;
  y: number;
  tile: TileType;
}

/**
 * The current floor: its dungeon plus the one place tiles are allowed to change. A change redraws
 * only the tiles involved and notifies the owner when sight lines moved (to rebuild the wall
 * segments the vision uses). Every change turns a closed tile into an open one, so the floor can
 * never get harder to cross.
 */
export class Level {
  readonly dungeon: Dungeon;
  readonly map: TileMap;
  /** Bumped on every tile change; the minimap redraws when it moves. */
  version = 0;
  /** Secret walls already pushed open. */
  readonly found = new Set<string>();
  /** Set by the environment system: an obstacle was destroyed (barrels also blast entities). */
  onDestroyed: ((tx: number, ty: number, tile: TileType) => void) | null = null;
  /** An obstacle was hit but still stands. `health` is 0..1. */
  onHit: ((tx: number, ty: number, tile: TileType, health: number) => void) | null = null;
  /** A secret wall opened (by hand or by a blast). */
  onSecret: ((secret: SecretPlan) => void) | null = null;
  private readonly destructibles: Destructibles;
  private readonly view: TilemapView;
  private readonly onChanged: (level: Level) => void;

  constructor(dungeon: Dungeon, view: TilemapView, onChanged: (level: Level) => void) {
    this.dungeon = dungeon;
    this.map = dungeon.map;
    this.view = view;
    this.onChanged = onChanged;
    this.destructibles = new Destructibles(dungeon.map);
    this.view.build(dungeon);
    this.version++;
    this.onChanged(this);
  }

  /** Per-frame upkeep of the drawn floor (flickering lamps). */
  tick(dt: number, combat: readonly CombatSource[] = []): void {
    this.view.tick(dt, combat);
  }

  setTiles(changes: readonly TileChange[]): void {
    let sight = false;
    for (const c of changes) {
      if (isOpaqueTile(this.map.get(c.x, c.y)) !== isOpaqueTile(c.tile)) sight = true;
      this.map.setWithVariant(c.x, c.y, c.tile, 0);
    }
    this.version++;
    this.view.update(changes);
    if (sight) this.onChanged(this);
  }

  unlockDoor(door: Door): void {
    door.unlocked = true;
    this.setTiles(door.tiles.map((t) => ({ x: t.x, y: t.y, tile: 'DOOR_UNLOCKED' as const })));
    this.view.setDoorColors(this.dungeon.doors);
  }

  openShutters(): number {
    const tiles = this.dungeon.plan.shutters.flatMap((s) => s.tiles).filter((t) => this.map.get(t.x, t.y) === 'SHUTTER');
    if (tiles.length > 0) this.setTiles(tiles.map((t) => ({ x: t.x, y: t.y, tile: 'FLOOR' as const })));
    return tiles.length;
  }

  /** Pushes a secret wall open. False when it already was. */
  revealSecret(secret: SecretPlan): boolean {
    if (this.found.has(secret.id)) return false;
    this.found.add(secret.id);
    this.setTiles([{ x: secret.wall.x, y: secret.wall.y, tile: 'FLOOR' }]);
    this.onSecret?.(secret);
    return true;
  }

  secretAt(tx: number, ty: number): SecretPlan | undefined {
    return this.dungeon.plan.secrets.find((s) => s.wall.x === tx && s.wall.y === ty);
  }

  /** Damage to whatever stands on (tx, ty). Destroyed obstacles become rubble; barrels blast their surroundings. */
  hitTile(tx: number, ty: number, amount: number): boolean {
    const hit = this.destructibles.damage(this.map, tx, ty, amount);
    if (!hit) return false;
    if (!hit.destroyed) {
      this.view.setHealth(tx, ty, hit.health);
      this.onHit?.(tx, ty, hit.tile, hit.health);
      return true;
    }
    this.setTiles([{ x: tx, y: ty, tile: 'RUBBLE' }]);
    this.onDestroyed?.(tx, ty, hit.tile);
    if (hit.tile === 'BARREL') this.blast(tx, ty);
    return true;
  }

  /** A barrel went off: hurt neighbouring obstacles (chaining other barrels) and crack hidden walls. */
  private blast(tx: number, ty: number): void {
    const reach = Math.ceil(DESTRUCTIBLE.BARREL.radius / TILE_SIZE);
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        if ((dx === 0 && dy === 0) || Math.hypot(dx, dy) * TILE_SIZE > DESTRUCTIBLE.BARREL.radius) continue;
        const secret = this.secretAt(tx + dx, ty + dy);
        if (secret) this.revealSecret(secret);
        else this.hitTile(tx + dx, ty + dy, DESTRUCTIBLE.BARREL.wallDamage);
      }
    }
  }
}
