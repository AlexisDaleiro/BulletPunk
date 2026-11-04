import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, getCharacter } from './characters.ts';
import { ABILITY_UPGRADES, applyAbilityUpgrade, upgradeChoices } from './upgrades.ts';
import { tickAbility } from './abilities.ts';
import { createHealth, type CharacterComponent } from '../ecs/components.ts';

const character = (id: string): CharacterComponent => ({ def: getCharacter(id), activeRemaining: 0, cooldownRemaining: 0, activationFlash: 0, recoil: 0, trailTimer: 0 });

test('every operative receives three distinct seeded choices, with an eligible exclusive evolution', () => {
  for (const def of CHARACTERS) for (let seed = 1; seed < 40; seed++) {
    const c = character(def.id), choices = upgradeChoices(c, seed, 1);
    assert.equal(choices.length, 3);
    assert.equal(new Set(choices.map(u => u.id)).size, 3);
    assert.ok(choices.some(u => u.character === def.id));
    assert.ok(choices.every(u => !u.character || u.character === def.id));
    assert.deepEqual(choices, upgradeChoices(c, seed, 1));
  }
});

test('evolutions combine within a run and never mutate the shared character catalog', () => {
  const before = JSON.stringify(CHARACTERS);
  for (const def of CHARACTERS) {
    const c = character(def.id);
    for (const item of ABILITY_UPGRADES.filter(u => !u.character || u.character === def.id)) assert.equal(applyAbilityUpgrade(c, item.id), true);
    assert.ok(c.upgrades!.length >= 5);
    assert.equal(JSON.stringify(CHARACTERS), before);
    const exclusive = ABILITY_UPGRADES.find(u => u.character === def.id)!;
    assert.equal(applyAbilityUpgrade(c, exclusive.id), false);
    assert.ok(!upgradeChoices(c, 1, 2).some(u => u.id === exclusive.id));
    assert.equal(applyAbilityUpgrade(c, 'NOT_AN_UPGRADE'), false);
  }
  assert.equal(applyAbilityUpgrade(character('NIX'), 'MORSA_FEED'), false);
});

test('high experience levels always offer three choices and repeated modifiers have safe bounds', () => {
  const c = character('NIX');
  applyAbilityUpgrade(c, 'NIX_ECHO'); applyAbilityUpgrade(c, 'NIX_PHASE');
  for (let i = 0; i < 100; i++) {
    const choices = upgradeChoices(c, 123, i + 1);
    assert.equal(choices.length, 3);
    for (const item of choices) applyAbilityUpgrade(c, item.id);
  }
  for (let i = 0; i < 100; i++) for (const id of ['LONG_CYCLE', 'QUICK_RECYCLE', 'SECOND_WIND']) applyAbilityUpgrade(c, id);
  assert.equal(c.def.ability.cooldown, 3);
  assert.equal(c.def.ability.duration, 15);
  assert.equal(c.augments!.activationHeal, 60);
  assert.ok(upgradeChoices(c, 1, 200).every(u => !['LONG_CYCLE', 'QUICK_RECYCLE', 'SECOND_WIND'].includes(u.id)));
});

test('repair drones regenerate shield only during the active duration; second wind respects the HP cap', () => {
  const c = character('SUTURA');
  applyAbilityUpgrade(c, 'SUTURA_BARRIER'); applyAbilityUpgrade(c, 'SECOND_WIND');
  const h = createHealth(95, 40); h.hp = 50; h.shield = 0;
  assert.equal(tickAbility(c, h, true, 0), true);
  assert.equal(h.hp, 62);
  tickAbility(c, h, false, 10);
  assert.equal(h.shield, 24);
  assert.equal(h.hp, 92);
  tickAbility(c, h, false, 1);
  assert.equal(h.shield, 24);
  c.cooldownRemaining = 0;
  tickAbility(c, h, true, 0);
  assert.equal(h.hp, 95);
});
