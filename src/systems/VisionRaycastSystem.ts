import type { System } from '../ecs/System';
import { abilityModifiers } from '../characters/abilities';
import type { World } from '../ecs/World';
import { computeVisibility } from '../vision/visibility';
import type { Segment } from '../world/wallEdges';
import { SpatialIndex } from '../core/SpatialIndex';

/**
 * Rebuilds the player's visibility polygon from its transform, after movement and turning.
 * Bots do not get a polygon: they only need a yes/no sight test, which `canSee` answers with one ray.
 */
export class VisionRaycastSystem implements System {
  private indexed: readonly Segment[] | null = null;
  private readonly walls = new SpatialIndex(256);
  private readonly nearby: Segment[] = [];
  private last = '';
  private polygon: number[] | null = null;
  /** Current floor's wall segments; swap it when a new floor is generated. */
  segments: readonly Segment[] = [];

  update(world: World): void {
    if (this.indexed !== this.segments) {
      this.indexed = this.segments;
      this.walls.clear();
      this.last = '';
      this.segments.forEach((s, i) => this.walls.insert(i, s.x1, s.y1, s.x2, s.y2));
    }
    world.each(['playerControlled', 'transform', 'vision'], (entity, _tag, t, vision) => {
      const stats = world.get(entity, 'passiveSynergy')?.stats;
      vision.effectiveRange =
        vision.range * (stats?.visionRangeMult ?? 1) * abilityModifiers(world.get(entity, 'character')).visionMult;
      const key = `${entity}:${t.x}:${t.y}:${t.angle}:${vision.fov}:${stats?.visionAngleBonus ?? 0}:${vision.effectiveRange}:${vision.proximityRadius}`;
      if (key === this.last && this.polygon === vision.polygon) return;
      this.last = key;
      this.polygon = vision.polygon;
      this.nearby.length = 0;
      const range = vision.effectiveRange;
      for (const i of this.walls.query(t.x - range, t.y - range, t.x + range, t.y + range))
        this.nearby.push(this.segments[i]);
      computeVisibility(
        this.nearby,
        {
          x: t.x,
          y: t.y,
          angle: t.angle,
          fov: vision.fov + (stats?.visionAngleBonus ?? 0),
          range: vision.effectiveRange,
          proximity: vision.proximityRadius,
        },
        vision.polygon,
      );
    });
  }
}
