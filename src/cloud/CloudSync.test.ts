import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CloudSync } from './CloudSync.ts';
import { CloudError, applyPatch, type CloudBackend, type CloudProfile, type PendingOperation } from './contracts.ts';
import { ProfileStore } from '../profile/ProfileStore.ts';
import { defaultProfile } from '../profile/Profile.ts';
import { SettingsStore } from '../settings/SettingsStore.ts';
import type { KV } from '../core/storage.ts';

const storage = (): KV => { const data = new Map<string, string>(); return { getItem: k => data.get(k) ?? null, setItem: (k,v) => { data.set(k,v); }, removeItem: k => { data.delete(k); } }; };
const envelope = (): CloudProfile => ({ profile: defaultProfile(), revision: 0, generation: 0, imported: false, preferences: { volume: .5, muted: false }, updatedAt: new Date().toISOString() });
function server(): CloudBackend & { value: CloudProfile; offline: boolean; applied: PendingOperation[] } {
  const applied: PendingOperation[] = [];
  return { value: envelope(), offline: false, applied,
    async load() { if (this.offline) throw new CloudError('Offline'); return structuredClone(this.value); },
    async apply(op) {
      if (this.offline) throw new CloudError('Offline');
      if (applied.some(item => item.id === op.id)) return structuredClone(this.value);
      if (op.generation !== this.value.generation) throw new CloudError('Reset', 'generation');
      if (op.kind === 'profile') {
        if (op.revision !== this.value.revision) throw new CloudError('Conflict', 'conflict');
        this.value.profile = applyPatch(this.value.profile, op.patch);
        if (op.patch.preferences) this.value.preferences = op.patch.preferences;
      }
      applied.push(structuredClone(op)); this.value.revision++;
      return structuredClone(this.value);
    },
    async reset() { this.value = { ...envelope(), generation: this.value.generation + 1, revision: this.value.revision + 1 }; return structuredClone(this.value); },
  };
}

test('account changes and account sound never replace the guest save or device graphics', async () => {
  const kv = storage(), profile = new ProfileStore(kv), settings = new SettingsStore(kv);
  profile.setName('GUEST'); settings.update({ volume: .2, pixelRatio: 1 });
  const sync = new CloudSync(profile, settings, kv); sync.rememberGuestSound();
  const remote = server(); remote.value.profile.name = 'ACCOUNT'; remote.value.preferences.volume = .8;
  await sync.connect('a', remote);
  assert.equal(profile.value.name, 'ACCOUNT'); assert.equal(settings.value.volume, .8); assert.equal(settings.value.pixelRatio, 1);
  profile.setName('EDITED'); await sync.flush();
  assert.equal(remote.value.profile.name, 'EDITED');
  sync.disconnect(); assert.equal(profile.value.name, 'GUEST'); assert.equal(settings.value.volume, .2);
  assert.equal(new ProfileStore(kv).value.name, 'GUEST');
});

test('offline outbox survives reload, coalesces unsent edits and stays with its owner', async () => {
  const kv = storage(), profile = new ProfileStore(kv), settings = new SettingsStore(kv), remote = server();
  const sync = new CloudSync(profile, settings, kv); await sync.connect('a', remote);
  remote.offline = true; profile.setName('FIRST'); profile.setName('LAST');
  await sync.flush(); assert.equal(sync.status, 'offline'); assert.equal(sync.pendingCount, 1);
  sync.disconnect();
  const other = server(); other.value.profile.name = 'B'; await sync.connect('b', other);
  assert.equal(profile.value.name, 'B'); assert.equal(other.applied.length, 0);
  remote.offline = false; sync.disconnect();
  const loaded = new CloudSync(profile, settings, kv); await loaded.connect('a', remote);
  assert.equal(remote.value.profile.name, 'LAST'); assert.equal(loaded.pendingCount, 0);
  loaded.disconnect();
});

test('a late response from an old account never appears in a new account', async () => {
  const kv = storage(), profile = new ProfileStore(kv), sync = new CloudSync(profile, new SettingsStore(kv), kv);
  let resolve!: (profile: CloudProfile) => void;
  const slow = server(); slow.load = () => new Promise(r => { resolve = r; });
  const old = sync.connect('a', slow);
  const next = server(); next.value.profile.name = 'NEW'; await sync.connect('b', next);
  const stale = envelope(); stale.profile.name = 'STALE'; resolve(stale); await old;
  assert.equal(profile.accountId, 'b'); assert.equal(profile.value.name, 'NEW'); sync.disconnect();
});

test('load failure without a confirmed cache blocks edits instead of uploading an empty profile', async () => {
  const kv = storage(), profile = new ProfileStore(kv), remote = server(), sync = new CloudSync(profile, new SettingsStore(kv), kv);
  remote.offline = true; await sync.connect('a', remote);
  assert.equal(sync.ready, false); assert.equal(profile.setName('EMPTY').ok, false);
  assert.equal(sync.pendingCount, 0); assert.equal(remote.applied.length, 0); sync.disconnect();
});

test('remote conflicts require a decision; retry cannot silently replace newer edits', async () => {
  const kv = storage(), profile = new ProfileStore(kv), remote = server(), sync = new CloudSync(profile, new SettingsStore(kv), kv);
  await sync.connect('a', remote); remote.value.profile.name = 'OTHER_DEVICE'; remote.value.revision++;
  profile.setName('LOCAL'); await sync.flush(); assert.equal(sync.status, 'conflict');
  await sync.retry(); assert.equal(sync.status, 'conflict'); assert.equal(remote.value.profile.name, 'OTHER_DEVICE');
  await sync.resolveConflict(false); assert.equal(profile.value.name, 'OTHER_DEVICE'); assert.equal(sync.pendingCount, 0); sync.disconnect();
});

test('cumulative run reports coalesce and a new page finalizes the last accepted checkpoint once', async () => {
  const kv = storage(), profile = new ProfileStore(kv), remote = server(), settings = new SettingsStore(kv);
  const sync = new CloudSync(profile, settings, kv); await sync.connect('a', remote);
  const base = { runId: crypto.randomUUID(), seed: 12, characterId: 'NIX', floor: 1, credits: 0, finished: false };
  for (let seq = 1; seq < 20; seq++) sync.report({ ...base, seq, kills: seq, timeSec: seq });
  assert.equal(sync.pendingCount, 1); await sync.flush();
  assert.equal(remote.applied.length, 1);
  sync.disconnect();
  const next = new CloudSync(profile, settings, kv); await next.connect('a', remote);
  const final = remote.applied[1]; assert.equal(final.kind, 'run');
  if (final.kind === 'run') { assert.equal(final.report.finished, true); assert.equal(final.report.kills, 19); }
  next.disconnect();
  const again = new CloudSync(profile, settings, kv); await again.connect('a', remote);
  assert.equal(remote.applied.length, 2); again.disconnect();
});

test('an old active run cannot resurrect progress after a server reset', async () => {
  const kv = storage(), profile = new ProfileStore(kv), remote = server(), sync = new CloudSync(profile, new SettingsStore(kv), kv);
  await sync.connect('a', remote); await sync.reset();
  sync.report({ runId: crypto.randomUUID(), seq: 1, seed: 12, characterId: 'NIX', floor: 2, credits: 10, kills: 20, timeSec: 30, finished: true, generation: 0 });
  await sync.flush(); assert.equal(sync.status, 'conflict'); assert.equal(remote.applied.length, 0);
  await sync.resolveConflict(false); assert.equal(sync.pendingCount, 0); assert.equal(profile.value.stats.kills, 0); sync.disconnect();
});
