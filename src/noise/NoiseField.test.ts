import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NoiseField } from './NoiseField.ts';

test('RUN ripple grows 10 -> 90 px over 0.6 s while fading, then disappears', () => {
  const field = new NoiseField();
  field.emit('RUN', 5, 6, 1);
  field.update(0.3);
  const e = field.events[0];
  assert.ok(Math.abs(e.currentRadius - 50) < 1e-9);
  assert.ok(Math.abs(e.intensity - 0.5) < 1e-9);
  field.update(0.4);
  assert.equal(field.events.length, 0);
});

test('noise damping shrinks the max radius', () => {
  const field = new NoiseField();
  assert.equal(field.emit('RUN', 0, 0, 1, 0.5).maxRadius, 45);
});

test('expiring one ripple keeps the others', () => {
  const field = new NoiseField();
  field.emit('UTILITY', 0, 0, 1); // 0.5 s
  field.update(0.3);
  field.emit('SHOOT', 0, 0, 2); // 1.0 s
  field.update(0.3); // utility ripple expires here
  assert.equal(field.events.length, 1);
  assert.equal(field.events[0].color, '#ff0055');
});
