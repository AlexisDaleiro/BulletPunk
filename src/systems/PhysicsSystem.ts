import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { TileMap } from '../world/TileMap';
import { moveAndCollide } from '../world/collision';

/** Integrates velocity. Entities with a collider are stopped by solid tiles of `map`. */
export class PhysicsSystem implements System {
  /** Current floor's tiles; swap it when a new floor is generated. */
  map: TileMap | null = null;

  update(world: World, dt: number): void {
    const map = this.map;
    world.each(['transform'], (entity, t) => {
      t.prevX = t.x;
      t.prevY = t.y;
      t.prevAngle = t.angle;
      const collider = map ? world.get(entity, 'collider') : undefined;
      if (map && collider) {
        moveAndCollide(map, t, collider.halfSize, dt);
      } else {
        t.x += t.vx * dt;
        t.y += t.vy * dt;
      }
    });
  }
}
