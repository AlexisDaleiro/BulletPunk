import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExperience, experienceRequired, gainExperience, KILL_XP } from './experience.ts';

test('three normal kills or one elite earn the first upgrade', () => {
  const normal = createExperience(), elite = createExperience();
  gainExperience(normal, KILL_XP.normal); gainExperience(normal, KILL_XP.normal);
  assert.deepEqual(normal, { level: 1, xp: 40, total: 40, pending: 0 });
  gainExperience(normal, KILL_XP.normal); gainExperience(elite, KILL_XP.elite);
  assert.deepEqual(normal, { level: 2, xp: 0, total: 60, pending: 1 });
  assert.deepEqual(elite, normal);
});

test('large rewards preserve overflow and queue every level earned', () => {
  const xp = createExperience(); gainExperience(xp, 245);
  assert.deepEqual(xp, { level: 3, xp: 95, total: 245, pending: 2 });
  gainExperience(xp, 25);
  assert.deepEqual(xp, { level: 4, xp: 0, total: 270, pending: 3 });
});

test('experience thresholds grow with operative level and ignore invalid awards', () => {
  assert.deepEqual([1, 2, 3, 4].map(experienceRequired), [60, 90, 120, 150]);
  const xp = createExperience();
  for (const amount of [0, -20, NaN, Infinity, -Infinity, Number.MAX_VALUE]) assert.equal(gainExperience(xp, amount), 0);
  assert.deepEqual(xp, createExperience());
  assert.equal(gainExperience(xp, 20.8), 20);
  assert.equal(xp.xp, 20);
});

test('new runs have independent experience state', () => {
  const a = createExperience(), b = createExperience(); gainExperience(a, 60);
  assert.deepEqual(b, { level: 1, xp: 0, total: 0, pending: 0 });
});
