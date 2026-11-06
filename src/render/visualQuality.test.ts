import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FrameBudget } from './visualQuality.ts';
test('quality adaptation ignores isolated stalls and reduces one tier only after sustained slow play', () => {
  const budget = new FrameBudget();
  for (let i = 0; i < 179; i++) assert.equal(budget.sample(16.6, 'CINEMATIC'), 'CINEMATIC');
  assert.equal(budget.sample(160, 'CINEMATIC'), 'CINEMATIC');
  budget.reset();
  for (let i = 0; i < 179; i++) assert.equal(budget.sample(33, 'CINEMATIC'), 'CINEMATIC');
  assert.equal(budget.sample(33, 'CINEMATIC'), 'BALANCED');
  for (let i = 0; i < 100; i++) assert.equal(budget.sample(33, 'BALANCED'), 'BALANCED');
});
