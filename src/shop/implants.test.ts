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

// --- chest rewards ---------------------------------------------------------------------------------
import { rollChest, rollSpecial, rollSupply, GEAR_WEAPONS, type LootContext } from '../rewards/rewards.ts';

const fit: LootContext = { hp: 100, maxHp: 100, shield: 50, maxShield: 50, weapons: ['PLASMA_PISTOL'], usesAmmo: false, implants: [] };

test('rewards: same seed and gear give the same loot; supplies adapt to need', () => {
  assert.deepEqual(rollChest('SPECIAL', 'GEAR', 2, 99, 3, fit), rollChest('SPECIAL', 'GEAR', 2, 99, 3, fit));
  assert.equal(rollSupply('AMMO', 1, 2, fit)[0].kind, 'CREDITS', 'no ammo weapon: ammo becomes credits');
  assert.equal(rollSupply('AMMO', 1, 2, { ...fit, usesAmmo: true })[0].kind, 'AMMO');
  assert.equal(rollSupply('MED', 1, 2, fit)[0].kind, 'CREDITS', 'full health: no repair kit');
  const hurt = rollSupply('MED', 1, 2, { ...fit, hp: 30 })[0];
  assert.equal(hurt.kind, 'HEAL');
  assert.ok(hurt.amount > 0);
});

test('rewards: special cases never repeat gear the player already has', () => {
  const every = Object.values(GEAR_WEAPONS).flat();
  const ids = Object.keys(IMPLANTS);
  for (let seed = 1; seed <= 200; seed++) {
    for (const tier of [1, 2, 3] as const) {
      const rewards = rollSpecial(tier, seed, 3, { ...fit, weapons: every.slice(0, 2), implants: ids.slice(0, 2) });
      for (const r of rewards) {
        if (r.kind === 'WEAPON') assert.ok(!every.slice(0, 2).includes(r.id as never), `owned ${r.id}`);
        if (r.kind === 'IMPLANT') assert.ok(!ids.slice(0, 2).includes(r.id as string), `installed ${r.id}`);
      }
      assert.ok(rewards.some((r) => r.kind === 'WEAPON' || r.kind === 'IMPLANT' || r.kind === 'CREDITS'));
    }
  }
  // With everything owned the case still pays out.
  const all = rollSpecial(3, 5, 3, { ...fit, weapons: every, implants: ids });
  assert.ok(all.length > 0 && all.every((r) => r.kind === 'CREDITS' || r.kind === 'AMMO'));
});
