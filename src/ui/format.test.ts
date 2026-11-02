import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration } from './format.ts';

test('durations read as M:SS, then H:MM:SS', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(5.9), '0:05');
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(3599), '59:59');
  assert.equal(formatDuration(3600), '1:00:00');
  assert.equal(formatDuration(3725), '1:02:05');
});

test('bad input reads as zero', () => {
  assert.equal(formatDuration(-4), '0:00');
  assert.equal(formatDuration(NaN), '0:00');
  assert.equal(formatDuration(Infinity), '0:00');
});
