import { Container, Graphics } from 'pixi.js';
import { FOG_MEMORY_ALPHA, TILE_SIZE } from '../config';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { pointInPolygon } from '../vision/visibility';
import type { ViewParams } from '../vision/visibility';
import { hostileVisible } from '../vision/hostileVisibility';
import { visionFan } from '../vision/cone';
import type { TileMap } from '../world/TileMap';
import type { RenderSystem } from './RenderSystem';
import { VisionConeGraphic } from '../render/VisionConeGraphic';

const T = TILE_SIZE;

/**
 * Fog of war for the player's vision polygon.
 * - All terrain is visible at ambient brightness, without revealing hidden enemies.
 * - Living hostiles require the forward cone, range and unblocked line of sight.
 * - A faint tint over the lit area stands in for the flashlight beam.
 */
export class FogSystem implements System {
  private readonly renderer: RenderSystem;
  /** Dark ambient overlay, cut open only by the actual flashlight fan. */
  private readonly fog = new Container();
  private readonly dark = new Graphics();
  private readonly mask = new Graphics();
  private readonly beam = new Graphics();
  private readonly cone = new VisionConeGraphic();
  private map: TileMap | null = null;
  private view: ViewParams | null = null;
  private readonly fan: number[] = [];
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
    this.fog.addChild(this.dark);
    this.fog.setMask({ mask: this.mask, inverse: true });
    this.renderer.layers.vision.addChild(this.fog, this.mask, this.beam);
    this.renderer.layers.vision.addChild(this.cone);
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
    this.explored = new Uint8Array(map.width * map.height);
    this.dark.clear().rect(0, 0, map.width * T, map.height * T).fill({ color: 0x000000, alpha: 1 - FOG_MEMORY_ALPHA });
  }

  update(world: World): void {
    this.polygon = null;
    this.view = null;
    world.each(['playerControlled', 'vision', 'transform'], (_entity, _tag, vision, t) => {
      this.polygon = vision.polygon;
      this.reveal(vision.polygon, t.x, t.y, vision.effectiveRange ?? vision.range);
      const stats = world.get(_entity, 'passiveSynergy')?.stats;
      this.view = { x: t.x, y: t.y, angle: t.angle, fov: vision.fov + (stats?.visionAngleBonus ?? 0), range: vision.effectiveRange ?? vision.range, proximity: vision.proximityRadius };
      visionFan(vision.polygon, t.x, t.y, t.angle, this.view.fov, this.fan);
      this.cone.update(vision.polygon, t.x, t.y, t.angle, this.view.fov, this.view.range);
    });

    const polygon = this.polygon as number[] | null;
    if (!polygon) this.cone.visible = false;
    world.each(['fogged', 'renderable', 'transform'], (entity, _tag, r, t) => {
      if (world.get(entity, 'team')?.team === 'ENEMY') {
        r.node.visible = !!this.view && !!polygon && (world.get(entity, 'health')?.hp ?? 0) > 0 && hostileVisible(this.view, polygon, t.x, t.y);
      } else if (world.has(entity, 'pickup') || world.has(entity, 'interactable') || world.has(entity, 'hazard')) {
        r.node.visible = true;
      } else r.node.visible = !!this.view && !!polygon && hostileVisible(this.view, polygon, t.x, t.y);
    });
  }

  render(): void {
    const polygon = this.polygon;
    this.mask.clear();
    this.beam.clear();
    if (!polygon || polygon.length < 6) return;
    this.mask.poly(this.fan).fill(0xffffff);
    if (this.view) this.mask.circle(this.view.x, this.view.y, 20).fill(0xffffff);
    this.beam.poly(this.fan).fill({ color: 0xc4d8dc, alpha: 0.025 });
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
  }
}
