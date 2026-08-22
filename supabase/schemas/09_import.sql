-- One-shot import of the guest localStorage snapshot, run the first time a
-- user signs in with an empty account. Idempotent: gated on
-- profiles.imported_at AND on the account actually being empty, under a row
-- lock so two tabs racing at first login can't both import.

create or replace function public.import_local_snapshot(snapshot jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  already_imported timestamptz;
begin
  if uid is null then
    raise exception 'import_local_snapshot requires an authenticated user';
  end if;

  select imported_at into already_imported
  from public.profiles
  where id = uid
  for update;

  if already_imported is not null then
    return jsonb_build_object('status', 'skipped', 'reason', 'already_imported');
  end if;

  if exists (select 1 from public.attempts where user_id = uid)
    or exists (select 1 from public.char_stats where user_id = uid)
    or exists (select 1 from public.writing_char_stats where user_id = uid)
    or exists (select 1 from public.progression where user_id = uid)
  then
    return jsonb_build_object('status', 'skipped', 'reason', 'account_not_empty');
  end if;

  insert into public.char_stats (
    user_id, kana, attempts, correct, streak, best_streak, total_ms,
    weight, last_seen_at
  )
  select
    uid,
    s ->> 'kana',
    coalesce((s ->> 'attempts')::integer, 0),
    coalesce((s ->> 'correct')::integer, 0),
    coalesce((s ->> 'streak')::integer, 0),
    coalesce((s ->> 'best_streak')::integer, 0),
    coalesce((s ->> 'total_ms')::bigint, 0),
    coalesce((s ->> 'weight')::real, 1),
    (s ->> 'last_seen_at')::timestamptz
  from jsonb_array_elements(coalesce(snapshot -> 'char_stats', '[]'::jsonb)) as s;

  insert into public.writing_char_stats (
    user_id, kana, attempts, correct, streak, best_streak, total_ms,
    weight, last_seen_at, stroke_mistakes, memory_correct
  )
  select
    uid,
    s ->> 'kana',
    coalesce((s ->> 'attempts')::integer, 0),
    coalesce((s ->> 'correct')::integer, 0),
    coalesce((s ->> 'streak')::integer, 0),
    coalesce((s ->> 'best_streak')::integer, 0),
    coalesce((s ->> 'total_ms')::bigint, 0),
    coalesce((s ->> 'weight')::real, 1),
    (s ->> 'last_seen_at')::timestamptz,
    coalesce((s ->> 'stroke_mistakes')::integer, 0),
    coalesce((s ->> 'memory_correct')::integer, 0)
  from jsonb_array_elements(coalesce(snapshot -> 'writing_char_stats', '[]'::jsonb)) as s;

  insert into public.confusion_pairs (user_id, kana_a, kana_b, count, last_at)
  select
    uid,
    least(p ->> 'kana_a', p ->> 'kana_b'),
    greatest(p ->> 'kana_a', p ->> 'kana_b'),
    sum(coalesce((p ->> 'count')::integer, 0)),
    max((p ->> 'last_at')::timestamptz)
  from jsonb_array_elements(coalesce(snapshot -> 'confusion_pairs', '[]'::jsonb)) as p
  group by 2, 3;

  insert into public.typos (user_id, kana, typo_text, count)
  select
    uid,
    t ->> 'kana',
    t ->> 'typo_text',
    sum(coalesce((t ->> 'count')::integer, 0))
  from jsonb_array_elements(coalesce(snapshot -> 'typos', '[]'::jsonb)) as t
  group by 2, 3;

  insert into public.confusion_groups (
    user_id, id, members, status, total_misses, streak, activated_at,
    graduated_at, times_activated, updated_at
  )
  select
    uid,
    g ->> 'id',
    (select coalesce(array_agg(m), '{}') from jsonb_array_elements_text(g -> 'members') as m),
    (g ->> 'status')::public.group_status,
    coalesce((g ->> 'total_misses')::integer, 0),
    coalesce((g ->> 'streak')::integer, 0),
    (g ->> 'activated_at')::timestamptz,
    (g ->> 'graduated_at')::timestamptz,
    coalesce((g ->> 'times_activated')::integer, 1),
    coalesce((g ->> 'updated_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(snapshot -> 'groups', '[]'::jsonb)) as g;

  if snapshot ? 'progression' then
    insert into public.progression (
      user_id, mode, track, lesson_hiragana, lesson_katakana, unlocked_at,
      day_last, day_streak, day_best, best_session_streak, best_accuracy,
      updated_at
    )
    select
      uid,
      coalesce(p ->> 'mode', 'journey'),
      coalesce((p ->> 'track')::public.syllabary, 'hiragana'),
      coalesce((p ->> 'lesson_hiragana')::integer, 0),
      coalesce((p ->> 'lesson_katakana')::integer, 0),
      coalesce(p -> 'unlocked_at', '{}'::jsonb),
      p ->> 'day_last',
      coalesce((p ->> 'day_streak')::integer, 0),
      coalesce((p ->> 'day_best')::integer, 0),
      coalesce((p ->> 'best_session_streak')::integer, 0),
      coalesce((p ->> 'best_accuracy')::real, 0),
      coalesce((p ->> 'updated_at')::timestamptz, now())
    from (select snapshot -> 'progression' as p) as src;
  end if;

  if snapshot ? 'totals' then
    insert into public.user_totals (user_id, reading_sessions, writing_sessions)
    values (
      uid,
      coalesce((snapshot -> 'totals' ->> 'reading_sessions')::integer, 0),
      coalesce((snapshot -> 'totals' ->> 'writing_sessions')::integer, 0)
    );
  end if;

  if snapshot ? 'settings' then
    insert into public.user_settings (user_id, settings, selection, updated_at)
    values (
      uid,
      coalesce(snapshot -> 'settings' -> 'settings', '{}'::jsonb),
      coalesce(snapshot -> 'settings' -> 'selection', '{}'::jsonb),
      coalesce((snapshot -> 'settings' ->> 'updated_at')::timestamptz, now())
    );
  end if;

  -- Local history is capped at 2000 records; enforce the same cap here.
  insert into public.attempts (
    id, user_id, modality, syllabary, kana, expected, answer, is_correct,
    confused_with, is_typo, response_ms, session_id, payload,
    client_created_at
  )
  select
    (e ->> 'id')::uuid,
    uid,
    (e ->> 'modality')::public.modality,
    (e ->> 'syllabary')::public.syllabary,
    e ->> 'kana',
    e ->> 'expected',
    e ->> 'answer',
    (e ->> 'is_correct')::boolean,
    e ->> 'confused_with',
    coalesce((e ->> 'is_typo')::boolean, false),
    (e ->> 'response_ms')::integer,
    e ->> 'session_id',
    e -> 'payload',
    (e ->> 'client_created_at')::timestamptz
  from jsonb_array_elements(coalesce(snapshot -> 'attempts', '[]'::jsonb))
    with ordinality as t (e, ord)
  order by ord
  limit 2000
  on conflict (id) do nothing;

  update public.profiles set imported_at = now() where id = uid;

  return jsonb_build_object('status', 'imported');
end;
$$;

revoke execute on function public.import_local_snapshot(jsonb)
  from public, anon;
grant execute on function public.import_local_snapshot(jsonb)
  to authenticated;

-- Remote wipe for "Borrar todo" while signed in. Deleting rows (not the
-- auth user) and clearing imported_at so a fresh local state can be
-- imported again later. Account deletion itself is the delete-account
-- Edge Function's job.
create or replace function public.delete_user_data()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'delete_user_data requires an authenticated user';
  end if;

  delete from public.attempts where user_id = uid;
  delete from public.char_stats where user_id = uid;
  delete from public.writing_char_stats where user_id = uid;
  delete from public.confusion_pairs where user_id = uid;
  delete from public.confusion_groups where user_id = uid;
  delete from public.typos where user_id = uid;
  delete from public.progression where user_id = uid;
  delete from public.user_totals where user_id = uid;
  delete from public.user_settings where user_id = uid;
  delete from public.sync_batches where user_id = uid;
  update public.profiles set imported_at = null where id = uid;

  return jsonb_build_object('status', 'deleted');
end;
$$;

revoke execute on function public.delete_user_data()
  from public, anon;
grant execute on function public.delete_user_data()
  to authenticated;
