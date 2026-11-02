import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { KV } from '../core/storage.ts';
import { defaultProfile } from './Profile.ts';
import { ProfileStore } from './ProfileStore.ts';

function fakeStorage(): KV {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

test('recorded runs and the chosen name survive a reload', () => {
  const storage = fakeStorage();
  const store = new ProfileStore(storage);
  store.record({ characterId: 'GHOST', floor: 3, credits: 40, timeSec: 90, kills: 5 });
  store.setLastCharacter('GHOST');
  assert.equal(store.setName(' Neo ').ok, true);

  const reloaded = new ProfileStore(storage).value;
  assert.equal(reloaded.name, 'Neo');
  assert.equal(reloaded.lastCharacter, 'GHOST');
  assert.equal(reloaded.stats.bestFloor, 3);
  assert.equal(reloaded.stats.kills, 5);
});

test('an invalid name is rejected and changes nothing', () => {
  const store = new ProfileStore(fakeStorage());
  const result = store.setName('<bad>');
  assert.equal(result.ok, false);
  assert.equal(store.value.name, defaultProfile().name);
});

test('clear wipes memory and storage', () => {
  const storage = fakeStorage();
  const store = new ProfileStore(storage);
  store.record({ characterId: 'GHOST', floor: 2, credits: 1, timeSec: 1, kills: 0 });
  store.clear();
  assert.deepEqual(store.value, defaultProfile());
  assert.deepEqual(new ProfileStore(storage).value, defaultProfile());
});
