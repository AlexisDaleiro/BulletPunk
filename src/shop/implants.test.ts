import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPassiveSynergy } from '../ecs/components.ts';
import { addImplant, IMPLANTS, IMPLANT_TIER } from './implants.ts';

test('implants stack: multipliers multiply, additive bonuses add', () => {
  const syn = createPassiveSynergy();
  addImplant(syn, IMPLANTS.OVERCLOCK);
  assert.ok(Math.abs(syn.stats.damageMult - 1.2) < 1e-9);
  addImplant(syn, IMPLANTS.OVERCLOCK);
  assert.ok(Math.abs(syn.stats.damageMult - 1.44) < 1e-9);

  addImplant(syn, IMPLANTS.GHOST_FIBERS);
  addImplant(syn, IMPLANTS.GHOST_FIBERS);
  assert.ok(Math.abs(syn.stats.noiseDampingMult - 0.5625) < 1e-9);

  addImplant(syn, IMPLANTS.RICOCHET_COATING);
  addImplant(syn, IMPLANTS.RICOCHET_COATING);
  addImplant(syn, IMPLANTS.SHIELD_MATRIX);
  assert.equal(syn.stats.bulletBounces, 2);
  assert.equal(syn.stats.shieldRegenRate, 3);
  assert.equal(syn.passives.length, 7);
});

test('an implant with several modifiers applies all of them and leaves the rest neutral', () => {
  const syn = createPassiveSynergy();
  addImplant(syn, IMPLANTS.OPTIC_BOOST);
  assert.ok(Math.abs(syn.stats.visionRangeMult - 1.15) < 1e-9);
  assert.ok(syn.stats.visionAngleBonus > 0.13 && syn.stats.visionAngleBonus < 0.15);
  assert.equal(syn.stats.moveSpeedMult, 1);
  assert.equal(syn.stats.bulletBounces, 0);
});

test('every implant has a tier and a price', () => {
  for (const [id, implant] of Object.entries(IMPLANTS)) {
    assert.ok(id in IMPLANT_TIER, id);
    assert.ok(implant.cost > 0);
  }
});
