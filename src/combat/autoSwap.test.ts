import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoSwapEmptyWeapon } from './autoSwap.ts';
import type { WeaponInventoryComponent } from '../ecs/components.ts';
import type { WeaponDefinition } from '../types.ts';

function inventory(magazine: number[], reserve: number[], activeSlot = 0): WeaponInventoryComponent {
  return { slots: magazine.map((_, i) => ({ id: `WEAPON_${i}` }) as WeaponDefinition), magazine, reserve,
    activeSlot, fireCooldown: 0, reloadTimer: 0 };
}

test('only switches after both the magazine and reserve are exhausted', () => {
  for (const [mag, reserve] of [[1, 0], [0, 20], [0, Infinity]]) {
    const inv = inventory([mag, 5], [reserve, 0]);
    assert.equal(autoSwapEmptyWeapon(inv), false);
    assert.equal(inv.activeSlot, 0);
  }
  const inv = inventory([0, 5], [0, 0]);
  assert.equal(autoSwapEmptyWeapon(inv), true);
  assert.equal(inv.activeSlot, 1);
});

test('skips empty weapons and prefers loaded ammunition over a reloadable weapon', () => {
  const inv = inventory([0, 0, 0, 2], [0, 0, 15, 0]);
  inv.reloadTimer = 1;
  inv.fireCooldown = 1.4;
  assert.equal(autoSwapEmptyWeapon(inv), true);
  assert.equal(inv.activeSlot, 3);
  assert.equal(inv.reloadTimer, 0);
  assert.equal(inv.fireCooldown, 1.4);
  assert.deepEqual(inv.magazine, [0, 0, 0, 2]);
  assert.deepEqual(inv.reserve, [0, 0, 15, 0]);
});

test('wraps around the inventory and can fall back to the pistol with infinite reserve', () => {
  const inv = inventory([0, 0, 0], [Infinity, 0, 0], 2);
  assert.equal(autoSwapEmptyWeapon(inv), true);
  assert.equal(inv.activeSlot, 0);
  assert.equal(inv.fireCooldown, .2);
  assert.equal(autoSwapEmptyWeapon(inv), false, 'a reloadable fallback must not trigger another switch');
});

test('does not cycle or reset timers when no usable alternative exists', () => {
  for (const inv of [inventory([0], [0]), inventory([0, 0, 0], [0, 0, 0])]) {
    inv.fireCooldown = .7;
    const before = structuredClone(inv);
    for (let i = 0; i < 5; i++) assert.equal(autoSwapEmptyWeapon(inv), false);
    assert.deepEqual(inv, before);
  }
});
