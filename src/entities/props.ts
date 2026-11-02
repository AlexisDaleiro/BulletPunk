import { Container, Graphics, Text } from 'pixi.js';
import { COLORS, TILE_SIZE } from '../config';
import { createTransform, type InteractableComponent } from '../ecs/components';
import type { Entity, World } from '../ecs/World';
import { ChestGraphic } from '../render/chestGraphic';
import type { RenderSystem } from '../systems/RenderSystem';
import type { ChestSpawn, HazardSpawn } from '../world/plan';

const T = TILE_SIZE;
const MAGENTA = 0xff007f;

export interface ShopOffer {
  kind: 'WEAPON' | 'IMPLANT' | 'AMMO';
  id: string | null;
  cost: number;
  label: string;
}

const label = (text: string, size: number, fill: number): Text => {
  const t = new Text({ text, style: { fontFamily: 'monospace', fontSize: size, fill } });
  t.anchor.set(0.5);
  return t;
};

function spawnProp(world: World, renderer: RenderSystem, x: number, y: number, node: Container, interactable?: InteractableComponent): Entity {
  const entity = world.create();
  world.add(entity, 'transform', createTransform(x, y)).add(entity, 'fogged', {});
  if (interactable) world.add(entity, 'interactable', interactable);
  renderer.attach(world, entity, 'entities', node);
  return entity;
}

/**
 * A chest from the generator's plan. The node is a ChestGraphic whose lid and LEDs the environment
 * system animates; the contents are rolled only when it is opened.
 */
export function createChest(world: World, renderer: RenderSystem, c: ChestSpawn): Entity {
  const node = new ChestGraphic(c.family, c.category, c.tier);
  const name = c.family === 'SPECIAL' ? 'SPECIAL CASE' : c.category === 'AMMO' ? 'AMMO CRATE' : c.category === 'MED' ? 'MED KIT' : 'CREDIT BOX';
  const entity = spawnProp(world, renderer, (c.tx + 0.5) * T, (c.ty + 0.5) * T, node, { kind: 'CHEST', payload: c.id, cost: 0, label: name, used: false });
  world.add(entity, 'chest', { family: c.family, category: c.category, tier: c.tier, seed: c.seed, state: 'CLOSED', t: 0 });
  return entity;
}

/** A priced item on a pedestal. */
export function createShopItem(world: World, renderer: RenderSystem, x: number, y: number, offer: ShopOffer): Entity {
  const node = new Container();
  const base = new Graphics().circle(0, 0, 15).fill({ color: 0x0b1620, alpha: 0.9 }).stroke({ width: 2, color: COLORS.amber, alpha: 0.6 });
  const icon = new Graphics();
  if (offer.kind === 'WEAPON') {
    icon.rect(-8, -3, 16, 6).fill(COLORS.amber).rect(2, 3, 4, 6).fill(COLORS.amber);
  } else if (offer.kind === 'IMPLANT') {
    icon.poly([0, -9, 8, -4.5, 8, 4.5, 0, 9, -8, 4.5, -8, -4.5]).fill(MAGENTA);
  } else {
    icon.rect(-8, -6, 4, 12).fill(COLORS.cyan).rect(-2, -6, 4, 12).fill(COLORS.cyan).rect(4, -6, 4, 12).fill(COLORS.cyan);
  }
  const price = label(`${offer.cost}¢`, 11, COLORS.amber);
  price.position.set(0, -24);
  node.addChild(base, icon, price);
  const payload = `${offer.kind}:${offer.id ?? ''}`;
  return spawnProp(world, renderer, x, y, node, { kind: 'SHOP_ITEM', payload, cost: offer.cost, label: offer.label, used: false });
}

/** The Cyber-Vendor: a neon kiosk. Decoration; the pedestals around it do the selling. */
export function createVendor(world: World, renderer: RenderSystem, x: number, y: number): Entity {
  const node = new Container();
  const body = new Graphics()
    .rect(-20, -14, 40, 28)
    .fill(0x0b1620)
    .stroke({ width: 2, color: COLORS.cyan })
    .rect(-14, -9, 28, 10)
    .fill({ color: COLORS.cyan, alpha: 0.35 });
  const sign = label('VENDOR', 9, COLORS.cyan);
  sign.position.set(0, 7);
  node.addChild(body, sign);
  return spawnProp(world, renderer, x, y, node);
}

/** Medical station: full repair for credits, once. */
export function createMedic(world: World, renderer: RenderSystem, x: number, y: number, cost: number): Entity {
  const node = new Graphics()
    .roundRect(-14, -14, 28, 28, 4)
    .fill(0x0b1620)
    .stroke({ width: 2, color: MAGENTA })
    .rect(-3, -9, 6, 18)
    .fill(MAGENTA)
    .rect(-9, -3, 18, 6)
    .fill(MAGENTA);
  return spawnProp(world, renderer, x, y, node, { kind: 'MEDIC', payload: '', cost, label: 'MEDICAL STATION', used: false });
}

/** Security terminal: one use opens every shutter on the floor and disarms the tripwires. */
export function createTerminal(world: World, renderer: RenderSystem, tx: number, ty: number): Entity {
  const node = new Graphics()
    .roundRect(-13, -12, 26, 24, 3)
    .fill(0x10181d)
    .stroke({ width: 2, color: 0x6fb4ff })
    .rect(-9, -8, 18, 10)
    .fill({ color: 0x6fb4ff, alpha: 0.45 })
    .rect(-9, 5, 6, 3)
    .fill(0x6fb4ff)
    .rect(-1, 5, 10, 3)
    .fill({ color: 0x6fb4ff, alpha: 0.35 });
  return spawnProp(world, renderer, (tx + 0.5) * T, (ty + 0.5) * T, node, { kind: 'TERMINAL', payload: '', cost: 0, label: 'SECURITY TERMINAL', used: false });
}

/**
 * A hazard strip. Drawn with its own warning (hazard stripes, status lights); the environment
 * system animates the node's `alpha` cycle and applies the effect.
 */
export function createHazard(world: World, renderer: RenderSystem, h: HazardSpawn): Entity {
  const entity = world.create();
  const x = h.tx * T;
  const y = h.ty * T;
  const w = h.w * T;
  const hgt = h.h * T;
  const node = new Container();
  const art = new Graphics();
  if (h.kind === 'SHOCK') {
    art.rect(4, 4, w - 8, hgt - 8).fill({ color: 0x1a1d16, alpha: 0.9 }).stroke({ color: 0xffe600, width: 2.5, alpha: 0.8 });
    for (let i = 0; i < w + hgt; i += 12) art.moveTo(4 + Math.min(i, w - 8), 4 + Math.max(0, i - w + 8)).lineTo(4 + Math.max(0, i - hgt + 8), 4 + Math.min(i, hgt - 8)).stroke({ color: 0xffe600, width: 2, alpha: 0.35 });
    for (const px of [10, w - 10]) art.circle(px, hgt / 2, 3).fill(0xffe600);
  } else if (h.kind === 'TOXIC') {
    art.rect(2, 2, w - 4, hgt - 4).stroke({ color: 0x8dff6a, width: 2, alpha: 0.55 });
    for (let i = 0; i < 4; i++) art.circle(14 + i * 22, 14 + (i % 2) * 28, 4 + (i % 3)).fill({ color: 0xa6ffb4, alpha: 0.25 });
  } else {
    // Tripwire: two emitter posts in the walls and a beam between them.
    const horiz = h.w > h.h;
    const a = horiz ? [-T / 2 + 6, hgt / 2] : [w / 2, -T / 2 + 6];
    const b = horiz ? [w + T / 2 - 6, hgt / 2] : [w / 2, hgt + T / 2 - 6];
    art.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ color: 0xff2a55, width: 2.2, alpha: 0.9 });
    for (const p of [a, b]) art.roundRect(p[0] - 7, p[1] - 7, 14, 14, 3).fill(0x1b1d22).stroke({ color: 0xff2a55, width: 1.5 }).circle(p[0], p[1], 3).fill(0xff2a55);
  }
  node.addChild(art);
  node.position.set(x, y);
  world.add(entity, 'hazard', { kind: h.kind, x, y, w, h: hgt, clock: h.kind === 'LASER' ? 99 : Math.random() * 2, active: h.kind === 'LASER', disabled: false, hit: [] });
  world.add(entity, 'fogged', {});
  // Hazards sit at the origin of their box, not the centre: the transform keeps the node where the tiles are.
  world.add(entity, 'transform', createTransform(x, y));
  renderer.attach(world, entity, 'shadows', node);
  return entity;
}
