import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AimPad } from './AimPad.ts';

test('right pad aims in all eight directions, including vertical drags', () => {
  for (const [dx, dy] of [[40, 0], [40, 40], [0, 40], [-40, 40], [-40, 0], [-40, -40], [0, -40], [40, -40]]) {
    const pad = new AimPad();
    pad.begin(2, 600, 180);
    pad.move(600 + dx, 180 + dy);
    const direction = pad.takeDirection()!;
    assert.ok(direction);
    assert.ok(Math.abs(Math.atan2(direction.y, direction.x) - Math.atan2(dy, dx)) < 1e-10);
    assert.ok(Math.hypot(pad.x, pad.y) <= 1.000001);
    assert.equal(pad.takeDirection(), null);
  }
});

test('aim is independent of drag distance and does not turn from a tap or tiny finger jitter', () => {
  const pad = new AimPad();
  pad.begin(1, 10, 20);
  assert.equal(pad.takeDirection(), null);
  pad.move(13, 24);
  assert.equal(pad.takeDirection(), null);
  pad.move(30, 0);
  const short = pad.takeDirection()!;
  pad.move(210, -180);
  assert.deepEqual(pad.takeDirection(), short);
  pad.move(10, 20);
  assert.equal(pad.takeDirection(), null);
});

test('quick drag survives lifting; grabbing elsewhere never jumps; cancellation drops pending aim', () => {
  const pad = new AimPad();
  pad.begin(1, 500, 200);
  pad.move(500, 150);
  pad.end();
  assert.deepEqual(pad.takeDirection(), { x: 0, y: -1 });
  pad.begin(2, 750, 100);
  assert.equal(pad.takeDirection(), null);
  pad.move(780, 100);
  pad.reset();
  assert.equal(pad.pointerId, null);
  assert.equal(pad.takeDirection(), null);
  pad.move(900, 400);
  assert.equal(pad.takeDirection(), null);
});
