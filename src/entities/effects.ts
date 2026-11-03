import { Graphics, GraphicsContext, Text } from 'pixi.js';
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
  const node = new Graphics().circle(0, 0, radius).fill({ color, alpha: 0.12 })
    .circle(0, 0, radius * 0.55).fill({ color, alpha: 0.35 })
    .poly([-radius * 1.4, 0, -radius * .18, -radius * .18, 0, -radius * 1.1, radius * .18, -radius * .18, radius * 1.4, 0, radius * .18, radius * .18, 0, radius * 1.1, -radius * .18, radius * .18]).fill({ color, alpha: .42 })
    .circle(0, 0, radius * 0.18).fill(0xffeed1);
  node.blendMode = 'add';
  node.alpha = 0.9;
  world
    .add(flash, 'transform', createTransform(x, y))
    .add(flash, 'lifetime', { age: 0, duration: life, startAlpha: 0.9 })
    .add(flash, 'fogged', {});
  renderer.attach(world, flash, 'entities', node);
}

const particleShapes = new Map<string, GraphicsContext>();
/** Bounded debris geometry: casings settle and impact sparks dissipate quickly. */
export function spawnDebris(world: World, renderer: RenderSystem, x: number, y: number, color: number, count = 4, casing = false): void {
  const budget = Math.min(count, 160 - world.store('particle').size);
  const key = `${color}:${casing}`;
  let shape = particleShapes.get(key);
  if (!shape) {
    shape = casing ? new GraphicsContext().roundRect(-1.8, -0.8, 3.6, 1.6, 0.4).fill(color)
      : new GraphicsContext().poly([-3, 0, 0, -1, 4, 0, 0, 1]).fill(color);
    particleShapes.set(key, shape);
  }
  for (let i = 0; i < budget; i++) {
    const particle = world.create();
    const angle = Math.random() * Math.PI * 2;
    const speed = casing ? 35 + Math.random() * 40 : 40 + Math.random() * 120;
    const t = createTransform(x, y, angle);
    t.vx = Math.cos(angle) * speed;
    t.vy = Math.sin(angle) * speed;
    world.add(particle, 'transform', t).add(particle, 'fogged', {})
      .add(particle, 'particle', { drag: casing ? 6 : 3, spin: casing ? 8 : 2 })
      .add(particle, 'lifetime', { age: 0, duration: casing ? 1.8 : 0.25 + Math.random() * 0.25, startAlpha: casing ? 0.8 : 1 });
    const node = new Graphics(shape);
    if (!casing) node.blendMode = 'add';
    renderer.attach(world, particle, casing ? 'shadows' : 'entities', node);
  }
}

/**
 * A short alert mark, hidden with its enemy when it is outside the forward view.
 */
export function spawnAlertMark(world: World, renderer: RenderSystem, x: number, y: number): void {
  const mark = world.create();
  const node = new Graphics().rect(-2.5, -16, 5, 11).fill(COLORS.red).circle(0, -1, 3).fill(COLORS.red);
  node.blendMode = 'add';
  world
    .add(mark, 'transform', createTransform(x, y))
    .add(mark, 'fogged', {})
    .add(mark, 'lifetime', { age: 0, duration: 0.8, startAlpha: 1 });
  renderer.attach(world, mark, 'entities', node);
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
