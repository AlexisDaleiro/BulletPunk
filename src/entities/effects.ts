import { Graphics, Text } from 'pixi.js';
import { COLORS } from '../config';
import { createTransform } from '../ecs/components';
import type { World } from '../ecs/World';
import type { RenderSystem } from '../systems/RenderSystem';

/** Short additive blob for muzzle flares and bullet impacts. Hidden when outside the player's light. */
export function spawnFlash(
  world: World,
  renderer: RenderSystem,
  x: number,
  y: number,
  color: number,
  radius: number,
  life: number,
): void {
  const flash = world.create();
  const node = new Graphics().circle(0, 0, radius).fill(color);
  node.blendMode = 'add';
  node.alpha = 0.9;
  world
    .add(flash, 'transform', createTransform(x, y))
    .add(flash, 'lifetime', { age: 0, duration: life, startAlpha: 0.9 })
    .add(flash, 'fogged', {});
  renderer.attach(world, flash, 'entities', node);
}

/**
 * Red "!" over a bot that just spotted the player. It sits above the fog on purpose: being
 * spotted from outside your cone is information the player should get.
 */
export function spawnAlertMark(world: World, renderer: RenderSystem, x: number, y: number): void {
  const mark = world.create();
  const node = new Graphics().rect(-2.5, -16, 5, 11).fill(COLORS.red).circle(0, -1, 3).fill(COLORS.red);
  node.blendMode = 'add';
  world
    .add(mark, 'transform', createTransform(x, y))
    .add(mark, 'lifetime', { age: 0, duration: 0.8, startAlpha: 1 });
  renderer.attach(world, mark, 'ripples', node);
}

/** Short text that rises and fades: "+25", "+AMMO". Shown over the fog on purpose, it is feedback for the player. */
export function spawnPopup(world: World, renderer: RenderSystem, x: number, y: number, text: string, color: number): void {
  const popup = world.create();
  const node = new Text({ text, style: { fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', fill: color, stroke: { color: 0x000000, width: 3 } } });
  node.anchor.set(0.5);
  const t = createTransform(x, y - 18);
  t.vy = -38;
  world.add(popup, 'transform', t).add(popup, 'lifetime', { age: 0, duration: 0.9, startAlpha: 1 });
  renderer.attach(world, popup, 'ripples', node);
}
