import type { SoundManager } from '../audio/SoundManager';
import { addAmmo, giveWeapon } from '../combat/loadout';
import { isWeaponId } from '../combat/weapons';
import type { PassiveSynergyComponent, PickupComponent, WeaponInventoryComponent } from '../ecs/components';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { GameState } from '../game/GameState';
import { addImplant, IMPLANTS, isImplantId } from '../shop/implants';
import type { KeyColor } from '../types';

const PICKUP_RADIUS = 24;
const KEY_COLORS: readonly string[] = ['red', 'blue', 'gold'];

/** Walking over loot collects it: weapons, ammo, keycards, credits and free implants. */
export class PickupSystem implements System {
  private readonly state: GameState;
  private readonly audio: SoundManager;

  constructor(state: GameState, audio: SoundManager) {
    this.state = state;
    this.audio = audio;
  }

  update(world: World): void {
    world.each(['playerControlled', 'transform', 'weaponInventory', 'passiveSynergy'], (_entity, _tag, t, inv, syn) => {
      world.each(['pickup', 'transform'], (loot, pickup, pt) => {
        if (Math.hypot(pt.x - t.x, pt.y - t.y) > PICKUP_RADIUS) return;
        if (!this.collect(pickup, inv, syn)) return;
        world.destroy(loot);
        this.audio.playPickup();
      });
    });
  }

  /** Applies a pickup. Returns false when it can not be used, so it stays on the floor. */
  private collect(pickup: PickupComponent, inv: WeaponInventoryComponent, syn: PassiveSynergyComponent): boolean {
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
    }
  }
}
