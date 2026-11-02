import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abilityModifiers, endAbility, tickAbility } from './abilities.ts';
import { getCharacter } from './characters.ts';
import { createHealth, createPassiveSynergy, type CharacterComponent } from '../ecs/components.ts';
import { applyDamage } from '../combat/damage.ts';
import { addImplant, IMPLANTS } from '../shop/implants.ts';

function operative(id: string): CharacterComponent {
  return { def: getCharacter(id), activeRemaining: 0, cooldownRemaining: 0, activationFlash: 0, recoil: 0, trailTimer: 0 };
}

test('ghost step cannot be refreshed during cooldown and cancellation preserves cooldown', () => {
  const c = operative('NIX');
  const h = createHealth(c.def.hp, c.def.shield);
  tickAbility(c, h, true, 0);
  assert.equal(abilityModifiers(c).speedMult, 1.25);
  assert.equal(abilityModifiers(c).movementNoiseMult, 0.15);
  tickAbility(c, h, true, 1);
  assert.equal(c.activeRemaining, 2);
  assert.equal(c.cooldownRemaining, 10);
  endAbility(c, h);
  assert.equal(abilityModifiers(c).speedMult, 1);
  tickAbility(c, h, true, 0);
  assert.equal(c.activeRemaining, 0);
  tickAbility(c, h, true, 10);
  assert.equal(c.activeRemaining, 3);
});

test('overload consumes temporary shield before permanent shield and health, then expires without healing', () => {
  const c = operative('BRASA');
  const h = createHealth(110, 75);
  tickAbility(c, h, true, 0);
  assert.equal(h.temporaryShield, 60);
  assert.equal(applyDamage(h, 40), 40);
  assert.deepEqual([h.temporaryShield, h.shield, h.hp], [20, 75, 110]);
  assert.equal(applyDamage(h, 35), 35);
  assert.deepEqual([h.temporaryShield, h.shield, h.hp], [0, 60, 110]);
  tickAbility(c, h, false, 0.1);
  assert.equal(c.activeRemaining, 0);
  assert.equal(h.maxShield, 75);
  tickAbility(c, h, true, 16);
  applyDamage(h, 15);
  tickAbility(c, h, false, 4);
  assert.deepEqual([h.temporaryShield, h.shield, h.maxShield, h.hp], [0, 60, 75, 110]);
});

test('optical sweep stacks with innate vision and implants without permanently changing either', () => {
  const c = operative('VECTOR');
  const h = createHealth();
  const syn = createPassiveSynergy();
  addImplant(syn, c.def.passive);
  addImplant(syn, IMPLANTS.OPTIC_BOOST);
  const baseline = syn.stats.visionRangeMult;
  tickAbility(c, h, true, 0);
  assert.ok(Math.abs(baseline * abilityModifiers(c).visionMult - 1.1 * 1.15 * 1.45) < 1e-9);
  tickAbility(c, h, false, 4);
  assert.equal(abilityModifiers(c).visionMult, 1);
  assert.equal(syn.stats.visionRangeMult, baseline);
});

test('death cancels temporary effects and prevents activation', () => {
  for (const id of ['NIX', 'BRASA', 'VECTOR']) {
    const c = operative(id);
    const h = createHealth();
    tickAbility(c, h, true, 0);
    h.hp = 0;
    tickAbility(c, h, true, 50);
    assert.equal(c.activeRemaining, 0);
    assert.equal(h.temporaryShield, 0);
  }
});

test('Nix footstep passive survives implant recomputation without quieting the weapon', () => {
  const syn = createPassiveSynergy();
  addImplant(syn, getCharacter('NIX').passive);
  addImplant(syn, IMPLANTS.SERVO_LEGS);
  assert.equal(syn.stats.movementNoiseMult, 0.7);
  assert.equal(syn.stats.noiseDampingMult, 1);
});
