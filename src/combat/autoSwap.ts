import type { WeaponInventoryComponent } from '../ecs/components.ts';

/** Exhausted means no loaded rounds AND no reserve. Prefer a ready weapon in slot order. */
export function autoSwapEmptyWeapon(inv: WeaponInventoryComponent): boolean {
  const current = inv.activeSlot;
  if (inv.magazine[current] > 0 || inv.reserve[current] > 0) return false;
  let reloadable = -1;
  for (let offset = 1; offset < inv.slots.length; offset++) {
    const slot = (current + offset) % inv.slots.length;
    if (inv.magazine[slot] > 0) {
      equip(slot);
      return true;
    }
    if (reloadable < 0 && inv.reserve[slot] > 0) reloadable = slot;
  }
  if (reloadable < 0) return false;
  equip(reloadable);
  return true;

  function equip(slot: number): void {
    inv.activeSlot = slot;
    inv.reloadTimer = 0;
    // Keep the last shot's recovery, especially for slow rifles and shotguns.
    inv.fireCooldown = Math.max(inv.fireCooldown, .2);
  }
}
