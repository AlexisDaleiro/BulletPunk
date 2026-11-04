import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileImpactMaterial } from './impactMaterial.ts';
import { applyDamage } from './damage.ts';
import { createHealth } from '../ecs/components.ts';

test('cover, containers and doors spark; crates splinter; concrete produces chips', () => {
  for (const tile of ['COVER', 'CONTAINER', 'MACHINE', 'BARREL', 'SHUTTER', 'DOOR_LOCKED'] as const) assert.equal(tileImpactMaterial(tile), 'METAL');
  assert.equal(tileImpactMaterial('CRATE'), 'WOOD');
  assert.equal(tileImpactMaterial('WALL'), 'CONCRETE');
  assert.equal(tileImpactMaterial('WEAK_WALL'), 'CONCRETE');
});

test('shield break triggers once when the final shield point is lost; invulnerable hits do not trigger it', () => {
  const h = createHealth(100, 20);
  applyDamage(h, 10); assert.equal(h.shieldBreak, undefined);
  applyDamage(h, 10); assert.equal(h.shieldBreak, .48);
  h.shieldBreak = 0; applyDamage(h, 10); assert.equal(h.shieldBreak, 0);
  h.shield = 10; h.temporaryShield = 10;
  applyDamage(h, 10); assert.equal(h.shieldBreak, 0);
  h.invulnerableTimer = 1; assert.equal(applyDamage(h, 50), 0); assert.equal(h.shieldBreak, 0);
  h.invulnerableTimer = 0; applyDamage(h, 10); assert.equal(h.shieldBreak, .48);
  h.shieldBreak = .2; h.shield = 1;
  applyDamage(h, 2); assert.equal(h.shieldBreak, .2, 'tiny regeneration cannot restart the break burst every bullet');
});
