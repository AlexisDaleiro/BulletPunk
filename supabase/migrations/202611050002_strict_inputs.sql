-- Tighten input types before any game accounts are created.
create or replace function public.bp_apply_profile(p_owner uuid,p_id uuid,p_revision bigint,p_generation integer,p_patch jsonb)
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
    if jsonb_typeof(p_patch #> '{preferences,volume}') is distinct from 'number' or jsonb_typeof(p_patch #> '{preferences,muted}') is distinct from 'boolean' or
      not ((p_patch #>> '{preferences,volume}')::numeric between 0 and 1) or
      (select count(*) from jsonb_object_keys(p_patch->'preferences'))<>2 then raise exception 'INVALID_PREFERENCES'; end if;
    r.preferences:=p_patch->'preferences';
  end if;
  update public.bp_profiles set data=v,preferences=r.preferences,revision=revision+1,updated_at=now() where user_id=p_owner;
  insert into public.bp_operations values(p_owner,p_id,now());
  return public.bp_envelope(p_owner);
end $$;


create or replace function public.bp_report_run(p_owner uuid,p_id uuid,p_generation integer,p_report jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.bp_profiles; prev public.bp_runs; v jsonb; s jsonb; run_key uuid; ch text; n bigint; k bigint; f integer; t double precision; credits bigint; seed_value bigint; done boolean; finished_delta integer;
begin
  perform public.bp_require_owner(p_owner);
  select * into strict r from public.bp_profiles where user_id=p_owner for update;
  if exists(select 1 from public.bp_operations where user_id=p_owner and operation_id=p_id) then return public.bp_envelope(p_owner); end if;
  if r.generation<>p_generation then raise exception 'GENERATION_CHANGED'; end if;
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

