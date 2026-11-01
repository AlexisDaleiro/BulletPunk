import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { computeVisibility } from '../vision/visibility';
import type { Segment } from '../world/wallEdges';

/**
 * Rebuilds the player's visibility polygon from its transform, after movement and turning.
 * Bots do not get a polygon: they only need a yes/no sight test, which `canSee` answers with one ray.
 */
export class VisionRaycastSystem implements System {
  /** Current floor's wall segments; swap it when a new floor is generated. */
  segments: readonly Segment[] = [];

  update(world: World): void {
    world.each(['playerControlled', 'transform', 'vision'], (entity, _tag, t, vision) => {
      const stats = world.get(entity, 'passiveSynergy')?.stats;
      computeVisibility(
        this.segments,
        {
          x: t.x,
          y: t.y,
          angle: t.angle,
          fov: vision.fov + (stats?.visionAngleBonus ?? 0),
          range: vision.range * (stats?.visionRangeMult ?? 1),
          proximity: vision.proximityRadius,
        },
        vision.polygon,
      );
    });
  }
}
