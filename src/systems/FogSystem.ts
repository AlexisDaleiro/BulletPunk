import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { FOG_MEMORY_ALPHA, TILE_SIZE } from '../config';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { pointInPolygon } from '../vision/visibility';
import type { TileMap } from '../world/TileMap';
import type { RenderSystem } from './RenderSystem';

const T = TILE_SIZE;

/**
 * Fog of war for the player's vision polygon.
 * - Everything outside the polygon is darkened to FOG_MEMORY_ALPHA; tiles never seen stay black.
 * - Entities tagged `fogged` are hidden unless they stand inside the polygon.
 * - A faint tint over the lit area stands in for the flashlight beam.
 */
export class FogSystem implements System {
  private readonly renderer: RenderSystem;
  /** Black cover per unexplored tile, plus the dark overlay. Both are cut open by `mask`. */
  private readonly fog = new Container();
  private shroud = new Container();
  private readonly dark = new Graphics();
  private readonly mask = new Graphics();
  private readonly beam = new Graphics();
  private map: TileMap | null = null;
  private cover: (Sprite | undefined)[] = [];
  private explored = new Uint8Array(0);
  /** The player's polygon from the latest step; null when there is no player. */
  private polygon: number[] | null = null;
  /** Bumped whenever a tile becomes explored; the minimap redraws when it moves. */
  version = 0;

  constructor(renderer: RenderSystem) {
    this.renderer = renderer;
  }

  init(): void {
    this.beam.blendMode = 'add';
    this.fog.addChild(this.shroud, this.dark);
    this.fog.setMask({ mask: this.mask, inverse: true });
    this.renderer.layers.vision.addChild(this.fog, this.mask, this.beam);
  }

  /** Has the player seen this tile? */
  isExplored(tx: number, ty: number): boolean {
    const map = this.map;
    return map !== null && map.inBounds(tx, ty) && this.explored[ty * map.width + tx] === 1;
  }

  /** Starts a fresh fog for `map`: every tile unexplored. */
  setMap(map: TileMap): void {
    this.map = map;
    this.version++;
    for (const c of this.shroud.removeChildren()) c.destroy();
    this.cover = new Array<Sprite | undefined>(map.width * map.height);
    this.explored = new Uint8Array(map.width * map.height);
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        if (map.get(tx, ty) === 'VOID') continue;
        const sprite = new Sprite(Texture.WHITE);
        sprite.tint = 0x000000;
        sprite.position.set(tx * T, ty * T);
        sprite.width = T;
        sprite.height = T;
        this.shroud.addChild(sprite);
        this.cover[ty * map.width + tx] = sprite;
      }
    }
    this.dark.clear().rect(0, 0, map.width * T, map.height * T).fill({ color: 0x000000, alpha: 1 - FOG_MEMORY_ALPHA });
  }

  update(world: World): void {
    this.polygon = null;
    world.each(['playerControlled', 'vision', 'transform'], (_entity, _tag, vision, t) => {
      this.polygon = vision.polygon;
      this.reveal(vision.polygon, t.x, t.y, vision.range);
    });

    const polygon = this.polygon as number[] | null;
    world.each(['fogged', 'renderable', 'transform'], (_entity, _tag, r, t) => {
      r.node.visible = polygon !== null && pointInPolygon(polygon, t.x, t.y);
    });
  }

  render(): void {
    const polygon = this.polygon;
    this.mask.clear();
    this.beam.clear();
    if (!polygon || polygon.length < 6) return;
    this.mask.poly(polygon).fill(0xffffff);
    this.beam.poly(polygon).fill({ color: 0x7fe9ff, alpha: 0.06 });
  }

  /** Marks tiles whose center is lit as explored, along with their 8 neighbours (the walls around them). */
  private reveal(polygon: number[], x: number, y: number, range: number): void {
    const map = this.map;
    if (!map || polygon.length < 6) return;
    const reach = Math.ceil(range / T) + 1;
    const cx = Math.floor(x / T);
    const cy = Math.floor(y / T);
    for (let ty = Math.max(0, cy - reach); ty <= Math.min(map.height - 1, cy + reach); ty++) {
      for (let tx = Math.max(0, cx - reach); tx <= Math.min(map.width - 1, cx + reach); tx++) {
        const i = ty * map.width + tx;
        if (this.explored[i] || map.get(tx, ty) === 'VOID') continue;
        if (!pointInPolygon(polygon, (tx + 0.5) * T, (ty + 0.5) * T)) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) this.explore(map, tx + dx, ty + dy);
        }
      }
    }
  }

  private explore(map: TileMap, tx: number, ty: number): void {
    if (!map.inBounds(tx, ty)) return;
    const i = ty * map.width + tx;
    if (!this.explored[i]) this.version++;
    this.explored[i] = 1;
    const sprite = this.cover[i];
    if (sprite) sprite.visible = false;
  }
}
