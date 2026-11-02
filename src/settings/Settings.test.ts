import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { KV } from '../core/storage.ts';
import { DEFAULT_SETTINGS, loadSettings, sanitizeSettings, saveSettings, SETTINGS_KEY } from './Settings.ts';

function fakeStorage(initial?: string): KV & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(SETTINGS_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

test('garbage input falls back to defaults', () => {
  for (const raw of [undefined, null, 42, 'x', [], {}]) assert.deepEqual(sanitizeSettings(raw), DEFAULT_SETTINGS);
});

test('out-of-range and wrongly typed fields are fixed one by one', () => {
  const s = sanitizeSettings({ volume: 7, muted: 'yes', pixelRatio: 1.4, showFps: true, antialias: 0 });
  assert.equal(s.volume, 1);
  assert.equal(s.muted, DEFAULT_SETTINGS.muted);
  assert.equal(s.pixelRatio, 1.5);
  assert.equal(s.showFps, true);
  assert.equal(s.antialias, DEFAULT_SETTINGS.antialias);
  assert.equal(sanitizeSettings({ volume: -3 }).volume, 0);
  assert.equal(sanitizeSettings({ volume: NaN }).volume, DEFAULT_SETTINGS.volume);
  assert.equal(sanitizeSettings({ pixelRatio: Infinity }).pixelRatio, DEFAULT_SETTINGS.pixelRatio);
});

test('an old or future schema version keeps its valid fields and is stamped current', () => {
  const s = sanitizeSettings({ version: 0, volume: 0.2, extra: 'ignored' });
  assert.equal(s.volume, 0.2);
  assert.equal(s.version, DEFAULT_SETTINGS.version);
  assert.equal('extra' in s, false);
  assert.equal(sanitizeSettings({ version: 99, muted: true }).muted, true);
});

test('save then load round-trips; corrupt JSON loads defaults', () => {
  const storage = fakeStorage();
  const custom = { ...DEFAULT_SETTINGS, volume: 0.9, muted: true, showFps: true };
  assert.equal(saveSettings(custom, storage), true);
  assert.deepEqual(loadSettings(storage), custom);
  assert.deepEqual(loadSettings(fakeStorage('{not json')), DEFAULT_SETTINGS);
});

test('blocked storage never throws', () => {
  const blocked: KV = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
    removeItem: () => {
      throw new Error('denied');
    },
  };
  assert.deepEqual(loadSettings(blocked), DEFAULT_SETTINGS);
  assert.equal(saveSettings(DEFAULT_SETTINGS, blocked), false);
  assert.equal(saveSettings(DEFAULT_SETTINGS, null), false);
});
