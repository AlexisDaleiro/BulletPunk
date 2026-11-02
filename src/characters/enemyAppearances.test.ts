import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enemyAppearance, ENEMY_APPEARANCES } from './enemyAppearances.ts';

test('enemy silhouette communicates its weapon threat without relying only on color', () => {
  const pistol = enemyAppearance('PISTOL'), smg = enemyAppearance('SMG'), shotgun = enemyAppearance('SHOTGUN');
  assert.equal(new Set([pistol.silhouette, smg.silhouette, shotgun.silhouette]).size, 3);
  for (const appearance of Object.values(ENEMY_APPEARANCES)) {
    assert.ok(appearance.hostile);
    assert.ok(appearance.name.length > 0);
    assert.notEqual(appearance.palette.armor, appearance.palette.cloth);
  }
});
