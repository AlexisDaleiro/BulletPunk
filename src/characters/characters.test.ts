import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWeaponId } from '../combat/weapons.ts';
import { CHARACTERS, DEFAULT_CHARACTER_ID, findCharacter, getCharacter } from './characters.ts';

const MODIFIER_KEYS = ['moveSpeedMult', 'visionRangeMult', 'visionAngleBonus', 'noiseDampingMult', 'movementNoiseMult', 'damageMult', 'fireRateMult', 'bulletBounces', 'shieldRegenRate'];
const MULTIPLIERS = ['moveSpeedMult', 'noiseDampingMult', 'damageMult', 'fireRateMult'] as const;

test('there are three operatives with unique ids, names and colors', () => {
  assert.equal(CHARACTERS.length, 3);
  for (const key of ['id', 'name', 'color'] as const) assert.equal(new Set(CHARACTERS.map((c) => c[key])).size, CHARACTERS.length, key);
});

test('every operative starts with a real weapon', () => {
  for (const c of CHARACTERS) assert.ok(isWeaponId(c.weapon), `${c.id}: ${c.weapon}`);
});

test('passives only use known modifiers with sane values', () => {
  for (const c of CHARACTERS) {
    if (!c.passive) continue;
    const entries = Object.entries(c.passive.modifiers);
    for (const [key, value] of entries) {
      assert.ok(MODIFIER_KEYS.includes(key), `${c.id}: ${key}`);
      assert.ok(Number.isFinite(value) && value >= 0, `${c.id}: ${key}`);
    }
    for (const mult of MULTIPLIERS) {
      const v = c.passive.modifiers[mult];
      if (v !== undefined) assert.ok(v >= 0.5 && v <= 1.5, `${c.id}: ${mult}`);
    }
  }
});

test('operatives trade protection for mobility and have different starting weapons', () => {
  for (const c of CHARACTERS) {
    assert.ok(c.hp > 0 && c.shield >= 0, c.id);
    assert.ok(c.moveSpeed >= 0.8 && c.moveSpeed <= 1.2);
    assert.ok(c.ability.duration > 0 && c.ability.cooldown > c.ability.duration);
  }
  assert.equal(new Set(CHARACTERS.map((c) => c.weapon)).size, 3);
  assert.ok(getCharacter('BRASA').shield > getCharacter('NIX').shield);
  assert.ok(getCharacter('BRASA').moveSpeed < getCharacter('NIX').moveSpeed);
});

test('old profile selections resolve to the redesigned roster', () => {
  assert.equal(getCharacter('VANGUARD').id, 'NIX');
  assert.equal(getCharacter('GHOST').id, 'NIX');
  assert.equal(getCharacter('BREACHER').id, 'BRASA');
});

test('unknown ids fall back to the first operative', () => {
  assert.equal(findCharacter('NOPE'), undefined);
  assert.equal(getCharacter('NOPE').id, DEFAULT_CHARACTER_ID);
});
