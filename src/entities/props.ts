import { Container, Graphics, Text } from 'pixi.js';
import { COLORS } from '../config';
import { createTransform, type InteractableComponent } from '../ecs/components';
import type { Entity, World } from '../ecs/World';
import type { RenderSystem } from '../systems/RenderSystem';

const MAGENTA = 0xff007f;
/** Chest tier 1, 2, 3. */
const TIER_COLORS = [COLORS.cyan, COLORS.amber, MAGENTA] as const;

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

/** Locked-room chest. Tier 1-3 sets its glow and what it can hold. */
export function createChest(world: World, renderer: RenderSystem, x: number, y: number, tier: 1 | 2 | 3): Entity {
  const color = TIER_COLORS[tier - 1];
  const node = new Graphics()
    .roundRect(-15, -11, 30, 22, 3)
    .fill(0x10202e)
    .stroke({ width: 2, color })
    .rect(-15, -3, 30, 3)
    .fill({ color, alpha: 0.5 })
    .circle(0, 0, 3)
    .fill(color);
  return spawnProp(world, renderer, x, y, node, { kind: 'CHEST', payload: String(tier), cost: 0, label: 'CHEST', used: false });
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

/** Access Breaker node: hacking it cracks every secret wall on the floor open. */
export function createBreaker(world: World, renderer: RenderSystem, x: number, y: number): Entity {
  const node = new Graphics()
    .rect(-12, -14, 24, 28)
    .fill(0x0b1620)
    .stroke({ width: 2, color: COLORS.amber })
    .moveTo(-6, -8)
    .lineTo(2, -2)
    .lineTo(-3, 3)
    .lineTo(6, 9)
    .stroke({ width: 2, color: COLORS.amber });
  return spawnProp(world, renderer, x, y, node, { kind: 'BREAKER', payload: '', cost: 0, label: 'ACCESS BREAKER', used: false });
}
