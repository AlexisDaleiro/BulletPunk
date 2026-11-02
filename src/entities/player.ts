import { Container, Graphics } from 'pixi.js';
import type { CharacterDef } from '../characters/characters';
import { OperativeGraphic } from '../characters/OperativeGraphic';
import { WEAPONS, createWeaponInventory, type WeaponId } from '../combat/weapons';
import { PLAYER_COLLIDER_HALF } from '../config';
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
import { addImplant } from '../shop/implants';
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

/** Every operative carries the infinite-ammo pistol, so a magazine weapon can never leave them empty-handed. */
const SIDEARM: WeaponId = 'PLASMA_PISTOL';

export function createPlayer(world: World, render: RenderSystem, x: number, y: number, def: CharacterDef): Entity {
  const player = world.create();
  const synergy = createPassiveSynergy();
  if (def.passive) addImplant(synergy, def.passive);
  const weapons: WeaponId[] = def.weapon === SIDEARM ? [SIDEARM] : [def.weapon, SIDEARM];
  const locomotion = createLocomotion();
  locomotion.runSpeed *= def.moveSpeed;
  world
    .add(player, 'transform', createTransform(x, y))
    .add(player, 'character', { def, activeRemaining: 0, cooldownRemaining: 0, activationFlash: 0, recoil: 0, trailTimer: 0 })
    .add(player, 'intent', createIntent())
    .add(player, 'locomotion', locomotion)
    .add(player, 'health', createHealth(def.hp, def.shield))
    .add(player, 'noiseEmitter', createNoiseEmitter())
    .add(player, 'passiveSynergy', synergy)
    .add(player, 'vision', createVision())
    .add(player, 'weaponInventory', createWeaponInventory(weapons))
    .add(player, 'team', { team: 'PLAYER' })
    .add(player, 'collider', { halfSize: PLAYER_COLLIDER_HALF })
    .add(player, 'playerControlled', {});
  render.attach(world, player, 'entities', new OperativeGraphic(def, WEAPONS[def.weapon].type));
  return player;
}
