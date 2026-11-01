import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerpAngle, smoothAngle } from './math.ts';

test('lerpAngle takes the short way across the +-PI seam', () => {
  const r = lerpAngle(3.1, -3.1, 1);
  assert.ok(Math.abs(r - 3.1) < 0.1); // ~3.18 (= -3.1 + 2PI), not -3.1
});

test('smoothAngle is rate-limited and frame-rate independent', () => {
  assert.equal(smoothAngle(1, 2, 0, 1), 1);
  const oneStep = smoothAngle(0, 1, 10, 0.1);
  const twoSteps = smoothAngle(smoothAngle(0, 1, 10, 0.05), 1, 10, 0.05);
  assert.ok(Math.abs(oneStep - twoSteps) < 1e-9);
});
