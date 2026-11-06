create schema if not exists bp_private;
revoke all on schema bp_private from public, anon;
grant usage on schema bp_private to authenticated;

create table public.bp_checkpoints (
  user_id uuid primary key references auth.users(id) on delete cascade,
  run_id uuid not null,
  generation integer not null,
  payload jsonb,
  revision bigint not null default 1,
  client_id uuid not null,
  lease_until timestamptz,
  closed boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.bp_checkpoints enable row level security;
revoke all on public.bp_checkpoints from anon, authenticated;
grant select on public.bp_checkpoints to authenticated;
create policy own_checkpoint on public.bp_checkpoints for select to authenticated using ((select auth.uid())=user_id);

create function bp_private.checkpoint_reply(p_owner uuid,p_include_payload boolean default false) returns jsonb
language sql stable set search_path='' as $$
select jsonb_build_object('profile',public.bp_envelope(p_owner),'save',
  (select case when closed or generation<>(select generation from public.bp_profiles where user_id=p_owner) then null else
    jsonb_build_object('runId',run_id,'revision',revision,'generation',generation,'clientId',client_id,'leaseUntil',lease_until,'updatedAt',updated_at,
      'version',payload->'version','worldVersion',payload->'worldVersion','floor',payload #> '{level,floor}','characterId',payload #> '{run,characterId}',
      'elapsed',payload #> '{run,elapsed}','payload',case when p_include_payload then payload else null end) end
   from public.bp_checkpoints where user_id=p_owner));
$$;

create function bp_private.validate_checkpoint(p_payload jsonb,p_generation integer) returns void language plpgsql set search_path='' as $$
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or pg_column_size(p_payload)>2000000 or
    p_payload->>'version' is distinct from '1' or p_payload->>'worldVersion' is distinct from '1' or
    jsonb_typeof(p_payload->'run') is distinct from 'object' or jsonb_typeof(p_payload->'level') is distinct from 'object' or
    jsonb_typeof(p_payload->'entities') is distinct from 'array' or jsonb_array_length(p_payload->'entities') not between 1 and 2000 or
    (p_payload #>> '{run,generation}')::integer is distinct from p_generation or
    not (p_payload #> '{run}') ?& array['runId','seed','elapsed','reportSeq','characterId','upgradeOptions'] or
    not (p_payload #> '{level}') ?& array['floor','kills','credits','keys','experience','tiles','doors','found','obstacleHp','layoutHash','width','height','pendingFloor'] then
    raise exception 'INVALID_CHECKPOINT';
  end if;
  if (p_payload #>> '{run,characterId}') not in ('NIX','BRASA','VECTOR','SUTURA','VOLT','MORSA') or
    not ((p_payload #>> '{run,elapsed}')::double precision between 0 and 604800) or
    not ((p_payload #>> '{level,floor}')::integer between 1 and 1000) then raise exception 'INVALID_CHECKPOINT'; end if;
end $$;

create function bp_private.checkpoint_report(p_payload jsonb,p_client uuid,p_finished boolean) returns jsonb language sql immutable set search_path='' as $$
select jsonb_build_object('runId',p_payload #> '{run,runId}','seq',p_payload #> '{run,reportSeq}','characterId',p_payload #> '{run,characterId}',
 'seed',p_payload #> '{run,seed}','kills',p_payload #> '{level,kills}','floor',p_payload #> '{level,floor}',
 'timeSec',p_payload #> '{run,elapsed}','credits',p_payload #> '{level,credits}','finished',p_finished,'leaseClient',p_client);
$$;

create function bp_private.checkpoint_command(p_owner uuid,p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare p public.bp_profiles; c public.bp_checkpoints; action text; client uuid; operation uuid; payload jsonb; run_key uuid; expected bigint; include_payload boolean:=false; report jsonb;
begin
  perform public.bp_require_owner(p_owner);
  if jsonb_typeof(p_request) is distinct from 'object' or pg_column_size(p_request)>2050000 then raise exception 'INVALID_CHECKPOINT_REQUEST'; end if;
  action:=p_request->>'action'; client:=(p_request->>'clientId')::uuid;
  if client is null then raise exception 'INVALID_CLIENT'; end if;
  -- Every command takes locks in the same order as progress updates.
  select * into strict p from public.bp_profiles where user_id=p_owner for update;
  select * into c from public.bp_checkpoints where user_id=p_owner for update;
  if action='inspect' then return bp_private.checkpoint_reply(p_owner,false); end if;
  if action not in ('start','claim','save','heartbeat','release','finish') then raise exception 'INVALID_CHECKPOINT_ACTION'; end if;
  operation:=(p_request->>'operationId')::uuid;
  if operation is null then raise exception 'INVALID_OPERATION'; end if;
  if exists(select 1 from public.bp_operations where user_id=p_owner and operation_id=operation) then
    return bp_private.checkpoint_reply(p_owner,action in ('start','claim'));
  end if;
  if action='start' then
    payload:=p_request->'payload'; perform bp_private.validate_checkpoint(payload,p.generation);
    run_key:=(payload #>> '{run,runId}')::uuid;
    if c.user_id is not null and not c.closed and c.generation=p.generation then
      if c.run_id is distinct from (p_request->>'replaceRunId')::uuid or c.revision is distinct from (p_request->>'replaceRevision')::bigint then raise exception 'SAVE_CHANGED'; end if;
      -- Explicit replacement finalizes only the last server-confirmed old checkpoint.
      report:=bp_private.checkpoint_report(c.payload,c.client_id,true);
      report:=jsonb_set(report,'{seq}',to_jsonb((report->>'seq')::bigint+1));
      perform public.bp_report_run(p_owner,gen_random_uuid(),p.generation,report);
    end if;
    if (payload #>> '{level,kills}')::bigint<>0 or (payload #>> '{level,floor}')::integer<>1 or (payload #>> '{run,elapsed}')::double precision<>0 then raise exception 'INVALID_NEW_RUN'; end if;
    insert into public.bp_checkpoints(user_id,run_id,generation,payload,revision,client_id,lease_until,closed)
      values(p_owner,run_key,p.generation,payload,coalesce(c.revision,0)+1,client,clock_timestamp()+interval '40 seconds',false)
      on conflict(user_id) do update set run_id=excluded.run_id,generation=excluded.generation,payload=excluded.payload,revision=excluded.revision,client_id=client,lease_until=excluded.lease_until,closed=false,updated_at=now();
    perform public.bp_report_run(p_owner,gen_random_uuid(),p.generation,bp_private.checkpoint_report(payload,client,false));
    include_payload:=true;
  else
    run_key:=(p_request->>'runId')::uuid; expected:=(p_request->>'revision')::bigint;
    if c.user_id is null or c.closed or c.generation<>p.generation or c.run_id is distinct from run_key then raise exception 'SAVE_UNAVAILABLE'; end if;
    if expected is distinct from c.revision then raise exception 'SAVE_CHANGED'; end if;
    if action='claim' then
      if c.client_id<>client and c.lease_until>clock_timestamp() and not coalesce((p_request->>'takeover')::boolean,false) then raise exception 'LEASE_BUSY'; end if;
      -- A pending local snapshot is only recovered if nobody advanced the confirmed revision.
      if p_request ? 'payload' then
        payload:=p_request->'payload'; perform bp_private.validate_checkpoint(payload,p.generation);
        if (payload #>> '{run,runId}')::uuid<>run_key then raise exception 'INVALID_CHECKPOINT'; end if;
        if (payload #>> '{run,reportSeq}')::bigint <= (c.payload #>> '{run,reportSeq}')::bigint then raise exception 'INVALID_CHECKPOINT_ORDER'; end if;
      else payload:=c.payload; end if;
      update public.bp_checkpoints set client_id=client,lease_until=clock_timestamp()+interval '40 seconds',payload=payload,revision=revision+1,updated_at=now() where user_id=p_owner;
      if p_request ? 'payload' then perform public.bp_report_run(p_owner,gen_random_uuid(),p.generation,bp_private.checkpoint_report(payload,client,false)); end if;
      include_payload:=true;
    else
      if c.client_id<>client then raise exception 'LEASE_LOST'; end if;
      if action in ('save','heartbeat') and (c.lease_until is null or c.lease_until<=clock_timestamp()) then raise exception 'LEASE_LOST'; end if;
      if action='save' then
        payload:=p_request->'payload'; perform bp_private.validate_checkpoint(payload,p.generation);
        if (payload #>> '{run,runId}')::uuid<>run_key then raise exception 'INVALID_CHECKPOINT'; end if;
        if (payload #>> '{run,reportSeq}')::bigint <= (c.payload #>> '{run,reportSeq}')::bigint then raise exception 'INVALID_CHECKPOINT_ORDER'; end if;
        perform public.bp_report_run(p_owner,gen_random_uuid(),p.generation,bp_private.checkpoint_report(payload,client,false));
        update public.bp_checkpoints set payload=payload,revision=revision+1,lease_until=clock_timestamp()+interval '40 seconds',updated_at=now() where user_id=p_owner;
      elsif action='heartbeat' then
        update public.bp_checkpoints set lease_until=clock_timestamp()+interval '40 seconds' where user_id=p_owner;
      elsif action='release' then
        update public.bp_checkpoints set lease_until=null where user_id=p_owner;
      elsif action='finish' then
        report:=p_request->'report';
        if (report->>'runId')::uuid<>run_key or not coalesce((report->>'finished')::boolean,false) then raise exception 'INVALID_REPORT'; end if;
        report:=jsonb_set(report,'{leaseClient}',to_jsonb(client));
        perform public.bp_report_run(p_owner,gen_random_uuid(),p.generation,report);
        update public.bp_checkpoints set closed=true,payload=null,revision=revision+1,lease_until=null,updated_at=now() where user_id=p_owner;
      end if;
    end if;
  end if;
  insert into public.bp_operations values(p_owner,operation,now());
  return bp_private.checkpoint_reply(p_owner,include_payload);
end $$;

create function public.bp_checkpoint(p_owner uuid,p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$
  select bp_private.checkpoint_command(p_owner,p_request);
$$;
revoke all on function bp_private.checkpoint_reply(uuid,boolean),bp_private.validate_checkpoint(jsonb,integer),bp_private.checkpoint_report(jsonb,uuid,boolean),bp_private.checkpoint_command(uuid,jsonb) from public,anon,authenticated;
grant execute on function bp_private.checkpoint_command(uuid,jsonb) to authenticated;
revoke all on function public.bp_checkpoint(uuid,jsonb) from public,anon;
grant execute on function public.bp_checkpoint(uuid,jsonb) to authenticated;

-- Fence legacy progress calls for checkpoint-managed runs.
create or replace function public.bp_report_run(p_owner uuid,p_id uuid,p_generation integer,p_report jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.bp_profiles; prev public.bp_runs; v jsonb; s jsonb; run_key uuid; ch text; n bigint; k bigint; f integer; t double precision; credits bigint; seed_value bigint; done boolean; finished_delta integer;
begin
  perform public.bp_require_owner(p_owner);
  select * into strict r from public.bp_profiles where user_id=p_owner for update;
  if exists(select 1 from public.bp_operations where user_id=p_owner and operation_id=p_id) then return public.bp_envelope(p_owner); end if;
  if r.generation<>p_generation then raise exception 'GENERATION_CHANGED'; end if;
  if exists(select 1 from public.bp_checkpoints where user_id=p_owner and run_id=(p_report->>'runId')::uuid and not closed and generation=p_generation) then
    if exists(select 1 from public.bp_checkpoints where user_id=p_owner and (client_id::text is distinct from p_report->>'leaseClient' or (not coalesce((p_report->>'finished')::boolean,false) and (lease_until is null or lease_until<=clock_timestamp())))) then raise exception 'LEASE_LOST'; end if;
  elsif p_report ? 'leaseClient' then raise exception 'SAVE_UNAVAILABLE'; end if;
  if jsonb_typeof(p_report)<>'object' or pg_column_size(p_report)>4096 or
    not (p_report ?& array['runId','seq','characterId','seed','kills','floor','timeSec','credits','finished']) then raise exception 'INVALID_REPORT'; end if;
  if exists(select 1 from jsonb_each(p_report) e where (e.key in ('seq','seed','kills','floor','credits','timeSec') and jsonb_typeof(e.value)<>'number') or (e.key in ('runId','characterId') and jsonb_typeof(e.value)<>'string')) then raise exception 'INVALID_REPORT'; end if;
  if exists(select 1 from jsonb_each(p_report) e where e.key in ('seq','seed','kills','floor','credits') and (e.value #>> '{}')::numeric <> trunc((e.value #>> '{}')::numeric)) then raise exception 'INVALID_REPORT'; end if;
  run_key:=(p_report->>'runId')::uuid; ch:=p_report->>'characterId'; n:=(p_report->>'seq')::bigint;
  k:=(p_report->>'kills')::bigint; f:=(p_report->>'floor')::integer; t:=(p_report->>'timeSec')::double precision;
  credits:=(p_report->>'credits')::bigint; seed_value:=(p_report->>'seed')::bigint; done:=(p_report->>'finished')::boolean;
  if ch not in ('NIX','BRASA','VECTOR','SUTURA','VOLT','MORSA') or not (n between 1 and 1000000000) or
    not (k between 0 and 1000000) or not (f between 1 and 1000) or not (t between 0 and 604800) or
    not (credits between 0 and 1000000000) or not (seed_value between 0 and 4294967295) or
    jsonb_typeof(p_report->'finished')<>'boolean' then raise exception 'INVALID_REPORT'; end if;
  insert into public.bp_runs(user_id,run_id,character_id,seed) values(p_owner,run_key,ch,seed_value) on conflict do nothing;
  select * into strict prev from public.bp_runs where user_id=p_owner and run_id=run_key for update;
  if prev.finished or n<=prev.seq then return public.bp_envelope(p_owner); end if;
  if ch<>prev.character_id or seed_value<>prev.seed or k<prev.kills or f<prev.floor or t<prev.time_sec then raise exception 'INVALID_REPORT_ORDER'; end if;
  finished_delta:=case when done then 1 else 0 end;
  s:=r.data->'stats';
  s:=jsonb_build_object('kills',(s->>'kills')::bigint+k-prev.kills,'bestFloor',greatest((s->>'bestFloor')::integer,f),
    'totalTimeSec',(s->>'totalTimeSec')::double precision+t-prev.time_sec,'maxCredits',greatest((s->>'maxCredits')::bigint,credits),'runs',(s->>'runs')::bigint+finished_delta);
  v:=jsonb_set(r.data,'{stats}',s);
  if done then v:=jsonb_set(v,array['runsByCharacter',ch],to_jsonb(coalesce((v #>> array['runsByCharacter',ch])::bigint,0)+1)); end if;
  update public.bp_profiles set data=public.bp_unlock(v),revision=revision+1,updated_at=now() where user_id=p_owner;
  update public.bp_runs set seq=n,kills=k,floor=f,time_sec=t,finished=done,updated_at=now() where user_id=p_owner and run_id=run_key;
  insert into public.bp_operations values(p_owner,p_id,now());
  return public.bp_envelope(p_owner);
end $$;

