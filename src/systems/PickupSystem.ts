import type { SoundManager } from '../audio/SoundManager';
import { addAmmo, giveWeapon } from '../combat/loadout';
import { isWeaponId } from '../combat/weapons';
import { COLORS } from '../config';
import type { HealthComponent, PassiveSynergyComponent, PickupComponent, WeaponInventoryComponent } from '../ecs/components';
import { spawnFlash, spawnPopup } from '../entities/effects';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { GameState } from '../game/GameState';
import { addImplant, IMPLANTS, isImplantId } from '../shop/implants';
import type { KeyColor } from '../types';
import type { RenderSystem } from './RenderSystem';
import type { TileMap } from '../world/TileMap';
import { lineOfSight } from '../world/raycast';

const PICKUP_RADIUS = 24;
const KEY_COLORS: readonly string[] = ['red', 'blue', 'gold'];

/** Walking over loot collects it: weapons, ammo, keycards, credits and free implants. */
export class PickupSystem implements System {
  map: TileMap | null = null;
  private readonly state: GameState;
  private readonly audio: SoundManager;
  private readonly renderer: RenderSystem;

  constructor(state: GameState, audio: SoundManager, renderer: RenderSystem) {
    this.state = state;
    this.audio = audio;
    this.renderer = renderer;
  }

  update(world: World): void {
    world.each(['playerControlled', 'transform', 'weaponInventory', 'passiveSynergy', 'health'], (_entity, _tag, t, inv, syn, health) => {
      world.each(['pickup', 'transform'], (loot, pickup, pt) => {
        if ((world.get(loot, 'pickupVisual')?.age ?? 1) < 0.3) return;
        if (Math.hypot(pt.x - t.x, pt.y - t.y) > PICKUP_RADIUS) return;
        if (this.map && !lineOfSight(this.map, t.x, t.y, pt.x, pt.y)) return;
        if (!this.collect(pickup, inv, syn, health)) return;
        const [text, color] = describe(pickup);
        spawnPopup(world, this.renderer, t.x, t.y, text, color);
        spawnFlash(world, this.renderer, pt.x, pt.y, color, 16, 0.22);
        world.destroy(loot);
        this.audio.playPickup();
      });
    });
  }

  /** Applies a pickup. Returns false when it can not be used, so it stays on the floor. */
  private collect(pickup: PickupComponent, inv: WeaponInventoryComponent, syn: PassiveSynergyComponent, health: HealthComponent): boolean {
    switch (pickup.kind) {
      case 'AMMO':
        return addAmmo(inv, pickup.amount);
      case 'CREDITS':
        this.state.credits += pickup.amount;
        return true;
      case 'KEY':
        if (pickup.id && KEY_COLORS.includes(pickup.id)) {
          this.state.keys[pickup.id as KeyColor] = true;
          this.state.toast(`${pickup.id.toUpperCase()} KEYCARD ACQUIRED`);
        }
        return true;
      case 'IMPLANT':
        if (pickup.id && isImplantId(pickup.id)) {
          addImplant(syn, IMPLANTS[pickup.id]);
          this.state.toast(`${IMPLANTS[pickup.id].name} INSTALLED`);
        }
        return true;
      case 'WEAPON':
        if (pickup.id && isWeaponId(pickup.id)) giveWeapon(inv, pickup.id, pickup.amount);
        return true;
      case 'HEAL':
        health.hp = Math.min(health.maxHp, health.hp + pickup.amount);
        health.shield = health.maxShield;
        return true;
    }
  }
}

/** Popup text and color for what was just picked up. */
function describe(p: PickupComponent): [string, number] {
  switch (p.kind) {
    case 'CREDITS':
      return ['+' + p.amount + '¢', 0x35ff8a];
    case 'AMMO':
      return ['+AMMO', COLORS.cyan];
    case 'HEAL':
      return ['+REPAIR', 0xff4f7a];
    case 'WEAPON':
      return ['+' + (p.id ?? 'WEAPON').replace(/_/g, ' '), COLORS.amber];
    case 'IMPLANT':
      return ['+IMPLANT', 0xff007f];
    default:
      return ['+KEYCARD', COLORS.amber];
  }
}
