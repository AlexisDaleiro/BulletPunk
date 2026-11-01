import { COLORS } from '../config';
import { createTransform } from '../ecs/components';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { createOperativeGraphic } from '../entities/player';
import type { RenderSystem } from './RenderSystem';

const TRAIL_LIFE = 0.3;
const TRAIL_ALPHA = 0.5;

/** While an entity dashes, leaves fading afterimages of itself behind. */
export class DashTrailSystem implements System {
  private readonly renderer: RenderSystem;

  constructor(renderer: RenderSystem) {
    this.renderer = renderer;
  }

  update(world: World, dt: number): void {
    world.each(['transform', 'locomotion'], (_entity, t, loc) => {
      if (loc.dashTimer <= 0) return;
      loc.trailTimer -= dt;
      if (loc.trailTimer > 0) return;
      loc.trailTimer = loc.dashTrailInterval;

      const ghost = world.create();
      world
        .add(ghost, 'transform', createTransform(t.x, t.y, t.angle))
        .add(ghost, 'lifetime', { age: 0, duration: TRAIL_LIFE, startAlpha: TRAIL_ALPHA });
      const node = createOperativeGraphic(COLORS.cyan);
      node.alpha = TRAIL_ALPHA;
      this.renderer.attach(world, ghost, 'shadows', node);
    });
  }
}
