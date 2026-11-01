import { Container, Graphics } from 'pixi.js';
import { createWeaponInventory } from '../combat/weapons';
import { COLORS, PLAYER_COLLIDER_HALF } from '../config';
import {
  createHealth,
  createIntent,
  createLocomotion,
  createNoiseEmitter,
  createPassiveSynergy,
  createTransform,
  createVision,
} from '../ecs/components';
import type { Entity, World } from '../ecs/World';
import type { RenderSystem } from '../systems/RenderSystem';

/** Top-down operative facing +x: dark body, glowing shoulders and weapon barrel. */
export function createOperativeGraphic(color: number): Container {
  const root = new Container();
  const body = new Graphics().circle(0, 0, 13).fill(0x0b1620).stroke({ width: 2, color });
  const glow = new Graphics().circle(0, -11, 5).circle(0, 11, 5).fill(color).rect(10, -2.5, 18, 5).fill(color);
  glow.blendMode = 'add';
  root.addChild(body, glow);
  return root;
}

export function createPlayer(world: World, render: RenderSystem, x: number, y: number): Entity {
  const player = world.create();
  world
    .add(player, 'transform', createTransform(x, y))
    .add(player, 'intent', createIntent())
    .add(player, 'locomotion', createLocomotion())
    .add(player, 'health', createHealth())
    .add(player, 'noiseEmitter', createNoiseEmitter())
    .add(player, 'passiveSynergy', createPassiveSynergy())
    .add(player, 'vision', createVision())
    .add(player, 'weaponInventory', createWeaponInventory(['PLASMA_PISTOL']))
    .add(player, 'team', { team: 'PLAYER' })
    .add(player, 'collider', { halfSize: PLAYER_COLLIDER_HALF })
    .add(player, 'playerControlled', {});
  render.attach(world, player, 'entities', createOperativeGraphic(COLORS.cyan));
  return player;
}
