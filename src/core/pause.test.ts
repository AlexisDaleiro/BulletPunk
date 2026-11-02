import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PauseReasons } from './pause.ts';

test('game stays paused until every reason is gone', () => {
  const p = new PauseReasons();
  assert.equal(p.paused, false);
  assert.equal(p.add('menu'), true);
  assert.equal(p.add('portrait'), false);
  assert.equal(p.delete('portrait'), false);
  assert.equal(p.paused, true);
  assert.equal(p.delete('menu'), true);
  assert.equal(p.paused, false);
});

test('adding a reason twice or deleting an absent one changes nothing', () => {
  const p = new PauseReasons();
  p.add('hidden');
  assert.equal(p.add('hidden'), false);
  assert.equal(p.delete('menu'), false);
  assert.equal(p.delete('hidden'), true);
  assert.equal(p.delete('hidden'), false);
});
