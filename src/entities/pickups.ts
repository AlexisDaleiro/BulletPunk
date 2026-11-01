import { Graphics } from 'pixi.js';
import { COLORS, KEY_INFO } from '../config';
import { createTransform, type PickupComponent } from '../ecs/components';
import type { Entity, World } from '../ecs/World';
import type { RenderSystem } from '../systems/RenderSystem';

const MAGENTA = 0xff007f;
const GREEN = 0x35ff8a;

function colorOf(pickup: PickupComponent): number {
  switch (pickup.kind) {
    case 'WEAPON':
      return COLORS.amber;
    case 'KEY':
      return KEY_INFO[pickup.id as keyof typeof KEY_INFO]?.color ?? COLORS.amber;
    case 'IMPLANT':
      return MAGENTA;
    case 'CREDITS':
      return GREEN;
    default:
      return COLORS.cyan;
  }
}

/** Neon marker on the floor, colored by what it is. Keycards are bigger so they read from afar. */
export function createPickup(world: World, renderer: RenderSystem, x: number, y: number, pickup: PickupComponent): Entity {
  const entity = world.create();
  const color = colorOf(pickup);
  const size = pickup.kind === 'KEY' ? 1.4 : 1;
  const node = new Graphics()
    .poly([0, -10 * size, 8 * size, 0, 0, 10 * size, -8 * size, 0])
    .fill({ color, alpha: 0.25 })
    .stroke({ width: 2, color });
  node.blendMode = 'add';
  world
    .add(entity, 'transform', createTransform(x, y))
    .add(entity, 'pickup', pickup)
    .add(entity, 'fogged', {});
  renderer.attach(world, entity, 'entities', node);
  return entity;
}
