import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { computeVisibility } from '../vision/visibility';
import type { Segment } from '../world/wallEdges';

/** Rebuilds every entity's visibility polygon from its transform, after movement and turning. */
export class VisionRaycastSystem implements System {
  /** Current floor's wall segments; swap it when a new floor is generated. */
  segments: readonly Segment[] = [];

  update(world: World): void {
    world.each(['transform', 'vision'], (entity, t, vision) => {
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
