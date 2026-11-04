import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS } from '../combat/weapons.ts';
import { weaponVisual } from './weaponVisual.ts';
import { weaponMuzzle } from './weaponPose.ts';
import { traceAim } from '../combat/aimTrace.ts';
import { TileMap } from '../world/TileMap.ts';

test('all ten weapons have distinct models, including weapons sharing the same class', () => {
  const models = Object.values(WEAPONS).map(weaponVisual);
  assert.equal(new Set(models.map(m => m.style)).size, Object.keys(WEAPONS).length);
  assert.notEqual(weaponVisual(WEAPONS.BELT_LMG).style, weaponVisual(WEAPONS.PULSE_CARBINE).style);
  assert.notEqual(weaponVisual(WEAPONS.HUSH_SMG).style, weaponVisual(WEAPONS.ARC_SMG).style);
});

test('drawn muzzle, aim guide and bullet origin use each weapon’s actual model length', () => {
  const map = new TileMap(30, 30, 'FLOOR');
  for (const weapon of Object.values(WEAPONS)) {
    const muzzle = weaponMuzzle(weapon), model = weaponVisual(weapon);
    assert.equal(muzzle.x, model.length);
    const trace = traceAim(map, 200, 200, 0, weapon, 400);
    assert.equal(trace.sx, 200 + model.length);
    assert.equal(trace.sy, 208);
  }
});
