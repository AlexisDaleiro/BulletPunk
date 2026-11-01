import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDamage } from './damage.ts';

const vitals = (hp: number, shield: number, invulnerableTimer = 0) => ({
  hp,
  maxHp: hp,
  shield,
  maxShield: shield,
  invulnerableTimer,
});

test('shield absorbs first, overflow hits hp, hp never goes negative', () => {
  const h = vitals(100, 50);
  assert.equal(applyDamage(h, 30), 30);
  assert.deepEqual([h.hp, h.shield], [100, 20]);
  assert.equal(applyDamage(h, 50), 50);
  assert.deepEqual([h.hp, h.shield], [70, 0]);
  assert.equal(applyDamage(h, 500), 70);
  assert.equal(h.hp, 0);
});

test('i-frames, dead targets and non-positive damage do nothing', () => {
  const dashing = vitals(100, 50, 0.1);
  assert.equal(applyDamage(dashing, 40), 0);
  assert.deepEqual([dashing.hp, dashing.shield], [100, 50]);
  assert.equal(applyDamage(vitals(0, 0), 10), 0);
  assert.equal(applyDamage(vitals(10, 0), 0), 0);
  assert.equal(applyDamage(vitals(10, 0), -5), 0);
});
