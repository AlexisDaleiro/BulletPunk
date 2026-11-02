import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWeaponId } from '../combat/weapons.ts';
import { PLAYER_VITALS } from '../config.ts';
import { CHARACTERS, DEFAULT_CHARACTER_ID, findCharacter, getCharacter } from './characters.ts';

const MODIFIER_KEYS = ['moveSpeedMult', 'visionRangeMult', 'visionAngleBonus', 'noiseDampingMult', 'damageMult', 'fireRateMult', 'bulletBounces', 'shieldRegenRate'];
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
    assert.ok(entries.length > 0, c.id);
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

test('vitals stay near the baseline balance', () => {
  const baseline = PLAYER_VITALS.hp + PLAYER_VITALS.shield;
  for (const c of CHARACTERS) {
    assert.ok(c.hp > 0 && c.shield >= 0, c.id);
    const total = c.hp + c.shield;
    assert.ok(Math.abs(total - baseline) <= baseline * 0.15, `${c.id}: ${total} vs ${baseline}`);
  }
});

test('the default operative keeps the current game values', () => {
  const d = getCharacter(DEFAULT_CHARACTER_ID);
  assert.equal(d.hp, PLAYER_VITALS.hp);
  assert.equal(d.shield, PLAYER_VITALS.shield);
  assert.equal(d.weapon, 'PLASMA_PISTOL');
  assert.equal(d.passive, undefined);
});

test('unknown ids fall back to the first operative', () => {
  assert.equal(findCharacter('NOPE'), undefined);
  assert.equal(getCharacter('NOPE').id, DEFAULT_CHARACTER_ID);
});
