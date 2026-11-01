import { isWeaponId, WEAPONS } from '../combat/weapons';
import type { PickupComponent, WeaponInventoryComponent } from '../ecs/components';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';

const PICKUP_RADIUS = 24;

/** Walking over loot collects it. Weapon pickups equip the weapon; ammo tops up the first finite-ammo gun. */
export class PickupSystem implements System {
  update(world: World): void {
    world.each(['playerControlled', 'transform', 'weaponInventory'], (_entity, _tag, t, inv) => {
      world.each(['pickup', 'transform'], (loot, pickup, pt) => {
        if (Math.hypot(pt.x - t.x, pt.y - t.y) > PICKUP_RADIUS) return;
        if (collect(pickup, inv)) world.destroy(loot);
      });
    });
  }
}

/** Applies a pickup to an inventory. Returns false when it can not be used, so it stays on the floor. */
function collect(pickup: PickupComponent, inv: WeaponInventoryComponent): boolean {
  // `ammo` counts magazines of the receiving weapon.
  if (pickup.kind === 'AMMO') {
    const slot = Number.isFinite(inv.reserve[inv.activeSlot]) ? inv.activeSlot : inv.reserve.findIndex(Number.isFinite);
    if (slot < 0) return false; // only the pistol: nothing to refill
    inv.reserve[slot] += pickup.ammo * inv.slots[slot].magazineSize;
    return true;
  }

  if (!pickup.weaponId || !isWeaponId(pickup.weaponId)) return true;
  const def = WEAPONS[pickup.weaponId];
  const owned = inv.slots.findIndex((s) => s.id === def.id);
  if (owned >= 0) {
    inv.reserve[owned] += pickup.ammo * def.magazineSize;
    return true;
  }
  inv.slots.push(def);
  inv.magazine.push(def.magazineSize);
  inv.reserve.push(pickup.ammo * def.magazineSize);
  inv.activeSlot = inv.slots.length - 1;
  inv.reloadTimer = 0;
  return true;
}
