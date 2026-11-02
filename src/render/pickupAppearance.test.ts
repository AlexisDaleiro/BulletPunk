import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickupAppearance } from './pickupAppearance.ts';

test('loot communicates its real weapon, implant and key, with safe fallbacks for old ids', () => {
  const smg = pickupAppearance({ kind: 'WEAPON', id: 'AUTO_SMG', amount: 1 });
  const rail = pickupAppearance({ kind: 'WEAPON', id: 'HEAVY_RAILGUN', amount: 1 });
  assert.equal(smg.weaponType, 'SMG');
  assert.equal(rail.weaponType, 'RAILGUN');
  assert.notEqual(smg.name, rail.name);
  assert.notEqual(smg.cacheKey, rail.cacheKey);
  assert.match(pickupAppearance({ kind: 'IMPLANT', id: 'SERVO_LEGS', amount: 1 }).name, /SERVO/);
  assert.notEqual(pickupAppearance({ kind: 'KEY', id: 'red', amount: 1 }).color, pickupAppearance({ kind: 'KEY', id: 'blue', amount: 1 }).color);
  assert.equal(pickupAppearance({ kind: 'CREDITS', id: null, amount: 17 }).name, 'CRÉDITOS +17');
  assert.equal(pickupAppearance({ kind: 'WEAPON', id: 'old-id', amount: 1 }).weaponType, 'PISTOL');
});
