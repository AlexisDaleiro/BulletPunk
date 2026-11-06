import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Postgres checkpoints: exclusive claims, fenced writes, exact revisions, atomic stats and close', async () => {
  const db = new PGlite(),
    owner = crypto.randomUUID(),
    other = crypto.randomUUID(),
    a = crypto.randomUUID(),
    b = crypto.randomUUID(),
    run = crypto.randomUUID();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
    );
    const dir = new URL('../../supabase/migrations/', import.meta.url);
    for (const file of (await readdir(dir)).filter((n) => n.endsWith('.sql')).sort())
      await db.exec(await readFile(new URL(file, dir), 'utf8'));
    await db.query('insert into auth.users values($1),($2)', [owner, other]);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
    await db.query('select public.bp_load_profile($1)', [owner]);
    const rpc = async (request: Record<string, unknown>, id = owner) =>
      (
        await db.query<{ v: any }>('select public.bp_checkpoint($1,$2) v', [
          id,
          { clientId: a, operationId: crypto.randomUUID(), ...request },
        ])
      ).rows[0].v;
    const payload = {
      version: 1,
      worldVersion: 1,
      run: { runId: run, seed: 123, elapsed: 0, reportSeq: 1, generation: 0, characterId: 'NIX', upgradeOptions: [] },
      level: {
        floor: 1,
        kills: 0,
        credits: 0,
        experience: {},
        keys: {},
        tiles: [],
        doors: [],
        found: [],
        obstacleHp: [],
        layoutHash: 1,
        width: 96,
        height: 96,
        pendingFloor: null,
      },
      entities: [{}],
    };
    let value = await rpc({ action: 'start', payload });
    assert.equal(value.save.revision, 1);
    assert.equal(value.profile.profile.stats.kills, 0);
    await assert.rejects(rpc({ action: 'inspect' }, other), /UNAUTHORIZED/);
    assert.equal((await db.query('select * from public.bp_checkpoints where user_id=$1', [other])).rows.length, 0);
    await assert.rejects(db.query('update public.bp_checkpoints set client_id=$1', [b]), /permission denied/);
    await assert.rejects(rpc({ action: 'claim', clientId: b, runId: run, revision: 1 }), /LEASE_BUSY/);
    const updated = structuredClone(payload);
    updated.run.reportSeq = 2;
    updated.run.elapsed = 30;
    updated.level.kills = 5;
    const operation = crypto.randomUUID();
    value = await rpc({ action: 'save', runId: run, revision: 1, payload: updated, operationId: operation });
    assert.equal(value.profile.profile.stats.kills, 5);
    assert.equal(value.profile.profile.stats.totalTimeSec, 30);
    assert.equal(value.save.revision, 2);
    assert.equal(
      (await rpc({ action: 'save', runId: run, revision: 1, payload: updated, operationId: operation })).save.revision,
      2,
    );
    value = await rpc({ action: 'claim', clientId: b, runId: run, revision: 2, takeover: true });
    assert.equal(value.save.clientId, b);
    assert.equal(value.save.revision, 3);
    await assert.rejects(rpc({ action: 'save', runId: run, revision: 2, payload: updated }), /SAVE_CHANGED/);
    await assert.rejects(rpc({ action: 'save', runId: run, revision: 3, payload: updated }), /LEASE_LOST/);
    await assert.rejects(
      db.query('select public.bp_report_run($1,$2,0,$3)', [
        owner,
        crypto.randomUUID(),
        {
          runId: run,
          seq: 3,
          seed: 123,
          characterId: 'NIX',
          floor: 1,
          kills: 9,
          timeSec: 40,
          credits: 0,
          finished: false,
          leaseClient: a,
        },
      ]),
      /LEASE_LOST/,
    );
    const report = {
      runId: run,
      seq: 3,
      seed: 123,
      characterId: 'NIX',
      floor: 1,
      kills: 6,
      timeSec: 40,
      credits: 20,
      finished: true,
    };
    value = await rpc({ action: 'finish', clientId: b, runId: run, revision: 3, report });
    assert.equal(value.save, null);
    assert.equal(value.profile.profile.stats.kills, 6);
    assert.equal(value.profile.profile.stats.runs, 1);
    await assert.rejects(rpc({ action: 'claim', runId: run, revision: 3 }), /SAVE_UNAVAILABLE/);
    assert.equal((await rpc({ action: 'inspect' })).save, null);
    // A released lease can be resumed elsewhere without forcing a takeover.
    const next = structuredClone(payload);
    next.run.runId = crypto.randomUUID();
    value = await rpc({ action: 'start', payload: next });
    let revision = value.save.revision;
    await rpc({ action: 'release', runId: next.run.runId, revision });
    value = await rpc({ action: 'claim', clientId: b, runId: next.run.runId, revision });
    revision = value.save.revision;
    assert.equal(value.save.clientId, b);
    // A suspended device may upload its unconfirmed snapshot only over the same base revision.
    await db.exec('reset role');
    await db.query("update public.bp_checkpoints set lease_until=now()-interval '1 second' where user_id=$1", [owner]);
    await db.exec('set role authenticated');
    await assert.rejects(rpc({ action: 'heartbeat', clientId: b, runId: next.run.runId, revision }), /LEASE_LOST/);
    const pending = structuredClone(next);
    pending.run.reportSeq = 3;
    pending.run.elapsed = 20;
    pending.level.kills = 2;
    value = await rpc({ action: 'claim', runId: next.run.runId, revision, payload: pending });
    revision = value.save.revision;
    assert.equal(value.profile.profile.stats.kills, 8);
    assert.equal(value.save.payload.level.kills, 2);
    await assert.rejects(
      rpc({ action: 'save', runId: next.run.runId, revision, payload: pending }),
      /INVALID_CHECKPOINT_ORDER/,
    );
    const unsupported = structuredClone(pending);
    unsupported.version = 2;
    unsupported.run.reportSeq++;
    await assert.rejects(
      rpc({ action: 'save', runId: next.run.runId, revision, payload: unsupported }),
      /INVALID_CHECKPOINT/,
    );
    // Starting another run needs an exact, explicitly supplied replacement. It closes the old one once.
    const replacement = structuredClone(next);
    replacement.run.runId = crypto.randomUUID();
    await assert.rejects(rpc({ action: 'start', payload: replacement }), /SAVE_CHANGED/);
    value = await rpc({
      action: 'start',
      payload: replacement,
      replaceRunId: next.run.runId,
      replaceRevision: revision,
    });
    assert.equal(value.profile.profile.stats.runs, 2);
    assert.equal(value.profile.profile.stats.kills, 8);
    const reset = (
      await db.query<{ v: any }>('select public.bp_reset_progress($1,$2,$3) v', [
        owner,
        value.profile.revision,
        crypto.randomUUID(),
      ])
    ).rows[0].v;
    assert.equal(reset.generation, 1);
    assert.equal((await rpc({ action: 'inspect' })).save, null);
    await assert.rejects(
      rpc({ action: 'claim', runId: replacement.run.runId, revision: value.save.revision }),
      /SAVE_UNAVAILABLE/,
    );
    await assert.rejects(rpc({ action: 'start', payload: next }), /INVALID_CHECKPOINT/);
    const fresh = structuredClone(next);
    fresh.run.runId = crypto.randomUUID();
    fresh.run.generation = 1;
    value = await rpc({ action: 'start', payload: fresh });
    assert.equal(value.save.generation, 1);
    assert.equal(value.profile.profile.stats.runs, 0);
  } finally {
    await db.close();
  }
});
