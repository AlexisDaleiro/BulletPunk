import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile, sanitizeProfile } from './Profile.ts';
import { ProfileStore } from './ProfileStore.ts';
import { appearanceFor, DEFAULT_LOOK } from './cosmetics.ts';
import { getCharacter } from '../characters/characters.ts';
import type { KV } from '../core/storage.ts';

test('old profiles retain stats and automatically receive the cosmetics earned before migration', () => {
  const p = sanitizeProfile({ version: 1, name: 'Neo', lastCharacter: 'SUTURA', stats: { runs: 2, bestFloor: 3, kills: 16, totalTimeSec: 90, maxCredits: 70 } });
  assert.equal(p.name, 'Neo'); assert.equal(p.stats.kills, 16); assert.equal(p.lastCharacter, 'SUTURA');
  for (const id of ['NEON', 'EMBER', 'COPPER', 'ION', 'CIRCUIT', 'ELITE', 'COMBAT']) assert.ok(p.cosmetics.unlocked.includes(id));
});

test('locked or mismatched cosmetics cannot be equipped; unlocks and per-operative selections survive reload', () => {
  const data = new Map<string, string>();
  const storage: KV = { getItem: k => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: k => void data.delete(k) };
  const p = new ProfileStore(storage);
  assert.equal(p.equip('NIX', 'skin', 'NEON'), false);
  p.checkUnlocks({ kills: 10, floor: 2, runs: 1 });
  assert.equal(p.equip('NIX', 'skin', 'NEON'), true);
  assert.equal(p.equip('NIX', 'weapon', 'ION'), true);
  assert.equal(p.equip('NIX', 'pose', 'COMBAT'), true);
  assert.equal(p.equip('NIX', 'skin', 'ION'), false);
  assert.equal(p.equip('UNKNOWN', 'skin', 'NEON'), false);
  const loaded = new ProfileStore(storage);
  assert.equal(loaded.lookFor('NIX').pose, 'COMBAT');
  assert.equal(loaded.lookFor('NIX').weapon, 'ION');
  assert.deepEqual(loaded.lookFor('MORSA'), DEFAULT_LOOK);
  loaded.clear(); assert.deepEqual(loaded.value, defaultProfile());
});

test('appearances change visual palettes without changing combat stats or shared definitions', () => {
  const base = getCharacter('NIX'), before = JSON.stringify(base);
  const skin = appearanceFor(base, { ...DEFAULT_LOOK, skin: 'EMBER', weapon: 'COPPER' });
  assert.notDeepEqual(skin.palette, base.palette);
  assert.deepEqual([skin.hp, skin.shield, skin.moveSpeed, skin.weapon], [base.hp, base.shield, base.moveSpeed, base.weapon]);
  skin.ability.duration = 99;
  assert.equal(JSON.stringify(base), before);
});

test('malformed saved cosmetic selections fall back to an available default', () => {
  const p = sanitizeProfile({ cosmetics: { unlocked: ['NOPE', 'NEON'], equipped: { NIX: { skin: 'NEON', weapon: 'ELITE', pose: 'COMBAT' }, UNKNOWN: { skin: 'NEON' } } } });
  assert.deepEqual(p.cosmetics.equipped.NIX, { ...DEFAULT_LOOK, skin: 'NEON' });
  assert.equal(p.cosmetics.equipped.UNKNOWN, undefined);
  assert.ok(!p.cosmetics.unlocked.includes('NOPE'));
});
