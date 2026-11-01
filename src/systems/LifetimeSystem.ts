import type { System } from '../ecs/System';
import type { World } from '../ecs/World';

/** Ages entities with a LifetimeComponent, fading their node, and destroys them at expiry. */
export class LifetimeSystem implements System {
  update(world: World, dt: number): void {
    world.each(['lifetime'], (entity, life) => {
      life.age += dt;
      if (life.age >= life.duration) {
        world.destroy(entity);
        return;
      }
      const renderable = world.get(entity, 'renderable');
      if (renderable) renderable.node.alpha = life.startAlpha * (1 - life.age / life.duration);
    });
  }
}
