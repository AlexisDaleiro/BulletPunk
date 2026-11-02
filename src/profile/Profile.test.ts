import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { KV } from '../core/storage.ts';
import { clearProfile, defaultProfile, favoriteCharacter, loadProfile, NAME_MAX, PROFILE_KEY, recordRun, sanitizeProfile, saveProfile, validateName } from './Profile.ts';

function fakeStorage(): KV & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

test('names are trimmed and checked for length and characters', () => {
  assert.deepEqual(validateName('  Neo  '), { ok: true, name: 'Neo' });
  assert.deepEqual(validateName('A   B'), { ok: true, name: 'A B' });
  assert.equal(validateName('   ').ok, false);
  assert.equal(validateName('').ok, false);
  assert.equal(validateName('x'.repeat(NAME_MAX)).ok, true);
  assert.equal(validateName('x'.repeat(NAME_MAX + 1)).ok, false);
  for (const bad of ['<b>', 'a;b', 'ñandú', 'emoji😀', 'tab\tname']) assert.equal(validateName(bad).ok, false, bad);
});

test('recordRun accumulates, keeps maxima, and does not mutate the input', () => {
  const p0 = defaultProfile();
  const p1 = recordRun(p0, { characterId: 'GHOST', floor: 3, credits: 120, timeSec: 200, kills: 9 });
  const p2 = recordRun(p1, { characterId: 'GHOST', floor: 2, credits: 300, timeSec: 50.5, kills: 1 });
  assert.deepEqual(p0, defaultProfile());
  assert.deepEqual(p2.stats, { runs: 2, bestFloor: 3, totalTimeSec: 250.5, maxCredits: 300, kills: 10 });
  assert.deepEqual(p2.runsByCharacter, { GHOST: 2 });
});

test('recordRun ignores negative or non-finite numbers', () => {
  const p = recordRun(defaultProfile(), { characterId: 'VANGUARD', floor: NaN, credits: -5, timeSec: Infinity, kills: -1 });
  assert.deepEqual(p.stats, { runs: 1, bestFloor: 0, totalTimeSec: 0, maxCredits: 0, kills: 0 });
});

test('favorite is the most played character, null before any run', () => {
  let p = defaultProfile();
  assert.equal(favoriteCharacter(p), null);
  const run = (characterId: string) => ({ characterId, floor: 1, credits: 0, timeSec: 1, kills: 0 });
  p = recordRun(recordRun(recordRun(p, run('GHOST')), run('BREACHER')), run('BREACHER'));
  assert.equal(favoriteCharacter(p), 'BREACHER');
});

test('sanitizeProfile repairs bad fields and drops junk keys', () => {
  const p = sanitizeProfile({
    name: '<script>',
    lastCharacter: 'not valid',
    stats: { runs: -4, bestFloor: 3.9, totalTimeSec: 'x', maxCredits: 50, kills: null },
    runsByCharacter: { GHOST: 2.7, 'bad key': 3, BREACHER: -1, VANGUARD: 0.4 },
  });
  assert.equal(p.name, 'OPERATIVE');
  assert.equal(p.lastCharacter, 'VANGUARD');
  assert.deepEqual(p.stats, { runs: 0, bestFloor: 3, totalTimeSec: 0, maxCredits: 50, kills: 0 });
  assert.deepEqual(p.runsByCharacter, { GHOST: 2 });
  assert.deepEqual(sanitizeProfile('corrupt'), defaultProfile());
});

test('save, load and clear through storage', () => {
  const storage = fakeStorage();
  const p = recordRun({ ...defaultProfile(), name: 'Neo' }, { characterId: 'GHOST', floor: 4, credits: 10, timeSec: 30, kills: 2 });
  assert.equal(saveProfile(p, storage), true);
  assert.deepEqual(loadProfile(storage), p);
  clearProfile(storage);
  assert.equal(storage.data.has(PROFILE_KEY), false);
  assert.deepEqual(loadProfile(storage), defaultProfile());
});
