import type { WeaponInventoryComponent } from '../ecs/components';
import { WEAPONS, type WeaponId } from './weapons';

/**
 * Adds `magazines` of spare ammo to the active weapon, or to the first weapon with a finite
 * reserve when the active one is the pistol. False when nothing can take ammo.
 */
export function addAmmo(inv: WeaponInventoryComponent, magazines: number): boolean {
  const slot = Number.isFinite(inv.reserve[inv.activeSlot]) ? inv.activeSlot : inv.reserve.findIndex(Number.isFinite);
  if (slot < 0) return false;
  inv.reserve[slot] += magazines * inv.slots[slot].magazineSize;
  return true;
}

/** A weapon already owned just gains ammo; a new one is added and equipped with a full magazine. */
export function giveWeapon(inv: WeaponInventoryComponent, id: WeaponId, magazines: number): void {
  const def = WEAPONS[id];
  const owned = inv.slots.findIndex((s) => s.id === def.id);
  if (owned >= 0) {
    if (Number.isFinite(inv.reserve[owned])) inv.reserve[owned] += magazines * def.magazineSize;
    return;
  }
  inv.slots.push(def);
  inv.magazine.push(def.magazineSize);
  inv.reserve.push(magazines * def.magazineSize);
  inv.activeSlot = inv.slots.length - 1;
  inv.reloadTimer = 0;
}
