import { PickupGraphic } from '../render/PickupGraphic';
import { createTransform, type PickupComponent } from '../ecs/components';
import type { Entity, World } from '../ecs/World';
import type { RenderSystem } from '../systems/RenderSystem';

/** Physical loot shares the same presentation whether dropped by a bot or a chest. */
export function createPickup(world: World, renderer: RenderSystem, x: number, y: number, pickup: PickupComponent): Entity {
  const entity = world.create();
  const node = new PickupGraphic(pickup, renderer.renderer);
  world
    .add(entity, 'transform', createTransform(x, y))
    .add(entity, 'pickup', pickup)
    .add(entity, 'pickupVisual', { age: 0, phase: (x * 0.07 + y * 0.13) % (Math.PI * 2) })
    .add(entity, 'fogged', {});
  renderer.attach(world, entity, 'shadows', node);
  return entity;
}
