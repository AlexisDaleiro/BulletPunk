import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { KV } from '../core/storage.ts';
import { loadSettings } from './Settings.ts';
import { SettingsStore } from './SettingsStore.ts';

function fakeStorage(): KV {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

test('update sanitizes, persists and notifies', () => {
  const storage = fakeStorage();
  const store = new SettingsStore(storage);
  const seen: number[] = [];
  const off = store.subscribe((s) => seen.push(s.volume));

  store.update({ volume: 5 });
  assert.equal(store.value.volume, 1);
  assert.equal(loadSettings(storage).volume, 1);
  assert.deepEqual(seen, [1]);

  off();
  store.update({ volume: 0.3 });
  assert.deepEqual(seen, [1]);
  assert.equal(new SettingsStore(storage).value.volume, 0.3);
});

test('reset returns to defaults', () => {
  const store = new SettingsStore(fakeStorage());
  store.update({ muted: true, showFps: true });
  store.reset();
  assert.equal(store.value.muted, false);
  assert.equal(store.value.showFps, false);
});
