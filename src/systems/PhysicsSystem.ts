import type { System } from '../ecs/System';
import type { World } from '../ecs/World';

/** Integrates velocity. Tile collision joins in Milestone 3. */
export class PhysicsSystem implements System {
  update(world: World, dt: number): void {
    world.each(['transform'], (_, t) => {
      t.prevX = t.x;
      t.prevY = t.y;
      t.prevAngle = t.angle;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
    });
  }
}
