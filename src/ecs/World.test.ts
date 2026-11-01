import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './World.ts';
import { createTransform } from './components.ts';

const health = (hp: number) => ({ hp, maxHp: hp, shield: 0, maxShield: 0, invulnerableTimer: 0 });

test('each joins stores and survives swap-remove', () => {
  const w = new World();
  const a = w.create();
  const b = w.create();
  const c = w.create();
  for (const e of [a, b, c]) w.add(e, 'transform', createTransform(e, 0));
  w.add(a, 'health', health(10)).add(c, 'health', health(30));

  w.remove(a, 'transform'); // swaps c into a's slot
  assert.equal(w.get(c, 'transform')?.x, c);
  assert.equal(w.has(a, 'transform'), false);

  const seen: number[] = [];
  w.each(['transform', 'health'], (e, t, h) => seen.push(e, t.x, h.hp));
  assert.deepEqual(seen, [c, c, 30]);
});

test('destroy is deferred, clears components and recycles the id', () => {
  const w = new World();
  const e = w.create();
  w.add(e, 'transform', createTransform(1, 2));
  w.destroy(e);
  w.destroy(e); // double destroy is harmless
  assert.equal(w.entityCount, 1);
  w.flush();
  assert.equal(w.entityCount, 0);
  assert.equal(w.has(e, 'transform'), false);
  assert.equal(w.create(), e);
});

test('removing components inside each visits every entity once', () => {
  const w = new World();
  for (let i = 0; i < 3; i++) w.add(w.create(), 'transform', createTransform(0, 0));
  let n = 0;
  w.each(['transform'], (e) => {
    n++;
    w.remove(e, 'transform');
  });
  assert.equal(n, 3);
});
