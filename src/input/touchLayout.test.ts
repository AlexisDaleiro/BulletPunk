import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, sanitizeSettings, TOUCH_ACTIONS } from '../settings/Settings.ts';
import { touchLayout } from './touchLayout.ts';
test('mobile buttons remain within landscape screens at every size and handedness', () => {
  for (const [w, h] of [
    [640, 320],
    [740, 360],
    [844, 390],
    [1024, 768],
  ])
    for (const scale of [0.85, 1, 1.4])
      for (const left of [false, true]) {
        const layout = touchLayout(w, h, { ...DEFAULT_SETTINGS, touchScale: scale, touchLeftHanded: left });
        for (const p of Object.values(layout)) {
          assert.ok(p.width >= 44 && p.height >= 44);
          assert.ok(p.x - p.width / 2 >= 0 && p.x + p.width / 2 <= w);
          assert.ok(p.y - p.height / 2 >= 0 && p.y + p.height / 2 <= h);
        }
      }
});
test('custom positions survive sanitizing and mirror with the pad sides', () => {
  const s = sanitizeSettings({
    ...DEFAULT_SETTINGS,
    touchPositions: { dash: { x: 0.25, y: 0.75 }, ability: { x: 9, y: -5 } },
    aimDeadzone: 100,
    touchOpacity: 0,
  });
  assert.equal(s.aimDeadzone, 24);
  assert.equal(s.touchOpacity, 0.35);
  assert.deepEqual(s.touchPositions.ability, { x: 1, y: 0 });
  const right = touchLayout(800, 400, s),
    left = touchLayout(800, 400, { ...s, touchLeftHanded: true });
  assert.equal(right.dash.x, 200);
  assert.equal(left.dash.x, 600);
  for (const key of TOUCH_ACTIONS) assert.equal(left[key].height, right[key].height);
});
