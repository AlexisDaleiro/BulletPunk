-- Account mutations go through authenticated functions. No client can write statistics directly.
create table public.bp_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  preferences jsonb not null default '{"volume":0.5,"muted":false}',
  revision bigint not null default 0,
  generation integer not null default 0,
  imported boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.bp_runs (
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null,
  character_id text not null,
  seed bigint not null,
  seq bigint not null default 0,
  kills bigint not null default 0,
  floor integer not null default 1,
  time_sec double precision not null default 0,
  finished boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, run_id)
);
create table public.bp_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
create table public.bp_legacy_imports (
  legacy_id uuid primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  imported_at timestamptz not null default now()
);
create table public.bp_cosmetic_catalog (
  id text primary key, kind text not null, metric text not null, target integer not null
);
insert into public.bp_cosmetic_catalog values
  ('FIELD','skin','kills',0),('NEON','skin','kills',5),('EMBER','skin','floor',2),
  ('FACTORY','weapon','kills',0),('COPPER','weapon','runs',1),('ION','weapon','kills',10),
  ('STANDARD','frame','kills',0),('CIRCUIT','frame','kills',15),('ELITE','frame','floor',3),
  ('PORTRAIT','pose','kills',0),('COMBAT','pose','kills',8);

alter table public.bp_profiles enable row level security;
alter table public.bp_runs enable row level security;
alter table public.bp_operations enable row level security;
alter table public.bp_legacy_imports enable row level security;
alter table public.bp_cosmetic_catalog enable row level security;
create policy own_profile on public.bp_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy own_runs on public.bp_runs for select to authenticated using ((select auth.uid()) = user_id);
create policy own_import on public.bp_legacy_imports for select to authenticated using ((select auth.uid()) = user_id);
create policy read_catalog on public.bp_cosmetic_catalog for select to authenticated using (true);
revoke all on public.bp_profiles, public.bp_runs, public.bp_operations, public.bp_legacy_imports, public.bp_cosmetic_catalog from anon, authenticated;
grant select on public.bp_profiles, public.bp_runs, public.bp_legacy_imports, public.bp_cosmetic_catalog to authenticated;

create function public.bp_default_profile() returns jsonb language sql immutable set search_path = '' as $$
  select '{"version":2,"name":"OPERATIVE","lastCharacter":"NIX","stats":{"runs":0,"bestFloor":0,"totalTimeSec":0,"maxCredits":0,"kills":0},"runsByCharacter":{},"cosmetics":{"unlocked":["FIELD","FACTORY","STANDARD","PORTRAIT"],"equipped":{}}}'::jsonb;
$$;
create function public.bp_require_owner(p_owner uuid) returns void language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() <> p_owner then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
end $$;
create function public.bp_envelope(p_owner uuid) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('profile',data,'revision',revision,'generation',generation,'imported',imported,'preferences',preferences,'updatedAt',updated_at)
  from public.bp_profiles where user_id=p_owner;
$$;
create function public.bp_unlock(p_data jsonb) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_set(p_data,'{cosmetics,unlocked}',(
    select jsonb_agg(id order by id) from public.bp_cosmetic_catalog c
    where c.target=0 or (p_data #> '{cosmetics,unlocked}') ? c.id or
      case c.metric when 'floor' then (p_data #>> '{stats,bestFloor}')::bigint
        when 'runs' then (p_data #>> '{stats,runs}')::bigint else (p_data #>> '{stats,kills}')::bigint end >= c.target
  ));
$$;
create function public.bp_load_profile(p_owner uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.bp_require_owner(p_owner);
  insert into public.bp_profiles(user_id,data) values(p_owner,public.bp_default_profile()) on conflict do nothing;
  return public.bp_envelope(p_owner);
end $$;

create function public.bp_apply_profile(p_owner uuid,p_id uuid,p_revision bigint,p_generation integer,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.bp_profiles; v jsonb; entry record; piece record; chosen text; name_value text; character_value text;
begin
  perform public.bp_require_owner(p_owner);
  select * into strict r from public.bp_profiles where user_id=p_owner for update;
  if exists(select 1 from public.bp_operations where user_id=p_owner and operation_id=p_id) then return public.bp_envelope(p_owner); end if;
  if r.generation<>p_generation then raise exception 'GENERATION_CHANGED'; end if;
  if r.revision<>p_revision then raise exception 'REVISION_CONFLICT'; end if;
  if jsonb_typeof(p_patch)<>'object' or pg_column_size(p_patch)>16384 or
    exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('name','lastCharacter','equipped','preferences')) then raise exception 'INVALID_PATCH'; end if;
  v:=r.data;
  if p_patch ? 'name' then
    name_value:=p_patch->>'name';
    if jsonb_typeof(p_patch->'name')<>'string' or name_value !~ '^[A-Za-z0-9 _-]{1,16}$' or btrim(name_value)='' then raise exception 'INVALID_NAME'; end if;
    v:=jsonb_set(v,'{name}',to_jsonb(name_value));
  end if;
  if p_patch ? 'lastCharacter' then
    character_value:=p_patch->>'lastCharacter';
    if character_value is null or character_value not in ('NIX','BRASA','VECTOR','SUTURA','VOLT','MORSA') then raise exception 'INVALID_CHARACTER'; end if;
    v:=jsonb_set(v,'{lastCharacter}',to_jsonb(character_value));
  end if;
  if p_patch ? 'equipped' then
    if jsonb_typeof(p_patch->'equipped')<>'object' then raise exception 'INVALID_LOOK'; end if;
    for entry in select * from jsonb_each(p_patch->'equipped') loop
      if entry.key not in ('NIX','BRASA','VECTOR','SUTURA','VOLT','MORSA') or jsonb_typeof(entry.value)<>'object' or
        not (entry.value ?& array['skin','weapon','frame','pose']) or (select count(*) from jsonb_object_keys(entry.value))<>4 then raise exception 'INVALID_LOOK'; end if;
      for piece in select * from jsonb_each_text(entry.value) loop
        chosen:=piece.value;
        if not exists(select 1 from public.bp_cosmetic_catalog where id=chosen and kind=piece.key) or
          not ((r.data #> '{cosmetics,unlocked}') ? chosen) then raise exception 'COSMETIC_LOCKED'; end if;
      end loop;
      v:=jsonb_set(v,array['cosmetics','equipped',entry.key],entry.value);
    end loop;
  end if;
  if p_patch ? 'preferences' then
    if jsonb_typeof(p_patch #> '{preferences,volume}')<>'number' or jsonb_typeof(p_patch #> '{preferences,muted}')<>'boolean' or
      not ((p_patch #>> '{preferences,volume}')::numeric between 0 and 1) or
      (select count(*) from jsonb_object_keys(p_patch->'preferences'))<>2 then raise exception 'INVALID_PREFERENCES'; end if;
    r.preferences:=p_patch->'preferences';
  end if;
  update public.bp_profiles set data=v,preferences=r.preferences,revision=revision+1,updated_at=now() where user_id=p_owner;
  insert into public.bp_operations values(p_owner,p_id,now());
  return public.bp_envelope(p_owner);
end $$;

create function public.bp_report_run(p_owner uuid,p_id uuid,p_generation integer,p_report jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.bp_profiles; prev public.bp_runs; v jsonb; s jsonb; run_key uuid; ch text; n bigint; k bigint; f integer; t double precision; credits bigint; seed_value bigint; done boolean; finished_delta integer;
begin
  perform public.bp_require_owner(p_owner);
  select * into strict r from public.bp_profiles where user_id=p_owner for update;
  if exists(select 1 from public.bp_operations where user_id=p_owner and operation_id=p_id) then return public.bp_envelope(p_owner); end if;
  if r.generation<>p_generation then raise exception 'GENERATION_CHANGED'; end if;
  if jsonb_typeof(p_report)<>'object' or pg_column_size(p_report)>4096 or
    not (p_report ?& array['runId','seq','characterId','seed','kills','floor','timeSec','credits','finished']) then raise exception 'INVALID_REPORT'; end if;
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

create function public.bp_import_local(p_owner uuid,p_id uuid,p_generation integer,p_legacy_id uuid,p_profile jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.bp_profiles; v jsonb; s jsonb; k text; amount numeric; look_patch jsonb; key_value record;
begin
  perform public.bp_require_owner(p_owner);
  select * into strict r from public.bp_profiles where user_id=p_owner for update;
  if exists(select 1 from public.bp_operations where user_id=p_owner and operation_id=p_id) then return public.bp_envelope(p_owner); end if;
  if r.generation<>p_generation then raise exception 'GENERATION_CHANGED'; end if;
  if r.imported or r.revision<>0 or exists(select 1 from public.bp_legacy_imports where legacy_id=p_legacy_id or user_id=p_owner) then raise exception 'IMPORT_NOT_AVAILABLE'; end if;
  if jsonb_typeof(p_profile)<>'object' or pg_column_size(p_profile)>32768 then raise exception 'INVALID_IMPORT'; end if;
  v:=public.bp_default_profile(); s:=p_profile->'stats';
  foreach k in array array['runs','bestFloor','totalTimeSec','maxCredits','kills'] loop
    if jsonb_typeof(s->k)<>'number' then raise exception 'INVALID_IMPORT'; end if;
    amount:=(s->>k)::numeric;
    if not (amount between 0 and 1000000000) then raise exception 'INVALID_IMPORT'; end if;
    v:=jsonb_set(v,array['stats',k],to_jsonb(case when k='totalTimeSec' then amount else trunc(amount) end));
  end loop;
  if p_profile->>'name' ~ '^[A-Za-z0-9 _-]{1,16}$' and btrim(p_profile->>'name')<>'' then v:=jsonb_set(v,'{name}',p_profile->'name'); end if;
  if p_profile->>'lastCharacter' in ('NIX','BRASA','VECTOR','SUTURA','VOLT','MORSA') then v:=jsonb_set(v,'{lastCharacter}',p_profile->'lastCharacter'); end if;
  if jsonb_typeof(p_profile->'runsByCharacter')='object' then
    for key_value in select * from jsonb_each(p_profile->'runsByCharacter') loop
      if key_value.key in ('NIX','BRASA','VECTOR','SUTURA','VOLT','MORSA') and jsonb_typeof(key_value.value)='number' and (key_value.value #>> '{}')::numeric between 0 and 1000000000 then
        v:=jsonb_set(v,array['runsByCharacter',key_value.key],to_jsonb(trunc((key_value.value #>> '{}')::numeric)));
      end if;
    end loop;
  end if;
  -- Imported cosmetics are explicitly unverified legacy progress; only known IDs are accepted.
  if jsonb_typeof(p_profile #> '{cosmetics,unlocked}')='array' then
    v:=jsonb_set(v,'{cosmetics,unlocked}',(select jsonb_agg(id order by id) from public.bp_cosmetic_catalog
      where target=0 or (p_profile #> '{cosmetics,unlocked}') ? id));
  end if;
  v:=public.bp_unlock(v);
  insert into public.bp_legacy_imports values(p_legacy_id,p_owner,now());
  update public.bp_profiles set data=v,imported=true,updated_at=now() where user_id=p_owner;
  look_patch:=jsonb_build_object('equipped',coalesce(p_profile #> '{cosmetics,equipped}','{}'));
  -- Reuse the same appearance validation, atomically with the import.
  perform public.bp_apply_profile(p_owner,p_id,0,p_generation,look_patch);
  return public.bp_envelope(p_owner);
end $$;

create function public.bp_reset_progress(p_owner uuid,p_revision bigint,p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.bp_profiles; v jsonb;
begin
  perform public.bp_require_owner(p_owner);
  select * into strict r from public.bp_profiles where user_id=p_owner for update;
  if exists(select 1 from public.bp_operations where user_id=p_owner and operation_id=p_id) then return public.bp_envelope(p_owner); end if;
  if r.revision<>p_revision then raise exception 'REVISION_CONFLICT'; end if;
  v:=jsonb_set(public.bp_default_profile(),'{name}',r.data->'name');
  update public.bp_profiles set data=v,generation=generation+1,revision=revision+1,imported=true,updated_at=now() where user_id=p_owner;
  delete from public.bp_runs where user_id=p_owner;
  insert into public.bp_operations values(p_owner,p_id,now());
  return public.bp_envelope(p_owner);
end $$;

-- All helpers are private to the function owner. Only authenticated entry points are callable.
revoke all on function public.bp_default_profile(), public.bp_require_owner(uuid), public.bp_envelope(uuid), public.bp_unlock(jsonb) from public, anon, authenticated;
revoke all on function public.bp_load_profile(uuid),public.bp_apply_profile(uuid,uuid,bigint,integer,jsonb),public.bp_report_run(uuid,uuid,integer,jsonb),public.bp_import_local(uuid,uuid,integer,uuid,jsonb),public.bp_reset_progress(uuid,bigint,uuid) from public, anon;
grant execute on function public.bp_load_profile(uuid),public.bp_apply_profile(uuid,uuid,bigint,integer,jsonb),public.bp_report_run(uuid,uuid,integer,jsonb),public.bp_import_local(uuid,uuid,integer,uuid,jsonb),public.bp_reset_progress(uuid,bigint,uuid) to authenticated;
