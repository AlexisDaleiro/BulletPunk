import { Graphics } from 'pixi.js';
import { COLORS } from '../config';
import { createTransform, type PickupComponent } from '../ecs/components';
import type { Entity, World } from '../ecs/World';
import type { RenderSystem } from '../systems/RenderSystem';

/** Neon diamond on the floor: amber for a weapon, cyan for ammo. */
export function createPickup(world: World, renderer: RenderSystem, x: number, y: number, pickup: PickupComponent): Entity {
  const entity = world.create();
  const color = pickup.kind === 'WEAPON' ? COLORS.amber : COLORS.cyan;
  const node = new Graphics().poly([0, -10, 8, 0, 0, 10, -8, 0]).fill({ color, alpha: 0.25 }).stroke({ width: 2, color });
  node.blendMode = 'add';
  world
    .add(entity, 'transform', createTransform(x, y))
    .add(entity, 'pickup', pickup)
    .add(entity, 'fogged', {});
  renderer.attach(world, entity, 'entities', node);
  return entity;
}
