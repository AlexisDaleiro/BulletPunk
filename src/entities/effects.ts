import { Graphics, GraphicsContext, Text } from 'pixi.js';
import { COLORS } from '../config';
import { createTransform } from '../ecs/components';
import type { World } from '../ecs/World';
import type { RenderSystem } from '../systems/RenderSystem';
import { IMPACT_STYLE, type ImpactMaterial } from '../combat/impactMaterial';

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

/** Material-specific chips and sparks, with the same bounded particle pool budget as debris. */
export function spawnImpactBurst(world: World, renderer: RenderSystem, x: number, y: number, material: ImpactMaterial, incoming: number): void {
  const style = IMPACT_STYLE[material];
  spawnFlash(world, renderer, x, y, style.color, material === 'SHIELD' ? 12 : 7, .13);
  const budget = Math.min(style.count, 160 - world.store('particle').size);
  const key = `impact:${material}`;
  let shape = particleShapes.get(key);
  if (!shape) {
    shape = material === 'METAL' || material === 'SHIELD' || material === 'ARMOR'
      ? new GraphicsContext().poly([-5, 0, 0, -1, 3, 0, 0, 1]).fill(style.chips)
      : new GraphicsContext().poly([-2, -1, 2, -2, 3, 1, -1, 2]).fill(style.chips);
    particleShapes.set(key, shape);
  }
  for (let i = 0; i < budget; i++) {
    const id = world.create();
    const angle = incoming + Math.PI + (Math.random() - .5) * 2.5;
    const t = createTransform(x, y, angle);
    const speed = 60 + Math.random() * 140;
    t.vx = Math.cos(angle) * speed; t.vy = Math.sin(angle) * speed;
    world.add(id, 'transform', t).add(id, 'particle', { drag: material === 'WOOD' ? 5 : 3, spin: style.dust ? 6 : 0 })
      .add(id, 'fogged', {}).add(id, 'lifetime', { age: 0, duration: .2 + Math.random() * .2, startAlpha: .9 });
    const node = new Graphics(shape);
    if (!style.dust) node.blendMode = 'add';
    renderer.attach(world, id, 'entities', node);
  }
  if (style.dust) {
    const id = world.create();
    world.add(id, 'transform', createTransform(x, y)).add(id, 'fogged', {})
      .add(id, 'lifetime', { age: 0, duration: .35, startAlpha: style.dust });
    renderer.attach(world, id, 'entities', new Graphics().circle(0, 0, 11).fill(style.chips));
  }
}

export function spawnShieldBreak(world: World, renderer: RenderSystem, x: number, y: number): void {
  const id = world.create();
  const g = new Graphics();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const px = Math.cos(a) * 20, py = Math.sin(a) * 20;
    g.poly([px, py - 4, px + 5, py, px, py + 4, px - 3, py]).stroke({ color: 0xb6efff, width: 1.3 });
    g.moveTo(Math.cos(a) * 24, Math.sin(a) * 24).lineTo(Math.cos(a) * 34, Math.sin(a) * 34).stroke({ color: 0x86dbe8, width: 1.2, alpha: .6 });
  }
  g.blendMode = 'add';
  world.add(id, 'transform', createTransform(x, y)).add(id, 'fogged', {})
    .add(id, 'lifetime', { age: 0, duration: .32, startAlpha: .95 });
  renderer.attach(world, id, 'entities', g);
}
