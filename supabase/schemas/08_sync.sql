-- Batched, idempotent sync push. The client accumulates attempt events plus
-- the aggregates its own TS logic already computed, and ships them under a
-- client-generated batch uuid. Replaying a batch (network retry, tab crash)
-- is a no-op: the batch row is the dedupe key.
--
-- Write discipline per column kind:
--   * counters (attempts, correct, total_ms, counts) — applied as deltas,
--     so two offline devices add up instead of clobbering each other;
--   * point-in-time values (weight, streak) — last write wins;
--   * monotonic values (best_streak, last_seen_at) — greatest().
-- The weight/streak/grouping *algorithm* stays in the client; SQL only
-- stores its outputs.

create table public.sync_batches (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  applied_at timestamptz not null default now()
);

create index sync_batches_user_idx on public.sync_batches (user_id);

alter table public.sync_batches enable row level security;

create policy "sync_batches_select_own" on public.sync_batches
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "sync_batches_insert_own" on public.sync_batches
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "sync_batches_delete_own" on public.sync_batches
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.sync_batches to authenticated;

create or replace function public.sync_push(
  batch_id uuid,
  events jsonb default '[]'::jsonb,
  aggregates jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  batch_rows integer;
  attempts_inserted integer := 0;
begin
  if uid is null then
    raise exception 'sync_push requires an authenticated user';
  end if;
  if jsonb_array_length(events) > 2000 then
    raise exception 'sync_push batch too large (max 2000 events)';
  end if;

  -- Idempotency gate: a replayed batch is ignored wholesale.
  insert into public.sync_batches (id, user_id)
  values (batch_id, uid)
  on conflict (id) do nothing;
  get diagnostics batch_rows = row_count;
  if batch_rows = 0 then
    return jsonb_build_object('status', 'duplicate');
  end if;

  -- Event log. Client-generated uuid pk gives per-event idempotency even
  -- across differently-shaped batches.
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
  from jsonb_array_elements(events) as e
  on conflict (id) do nothing;
  get diagnostics attempts_inserted = row_count;

  -- Reading aggregates.
  insert into public.char_stats as cs (
    user_id, kana, attempts, correct, streak, best_streak, total_ms,
    weight, last_seen_at, updated_at
  )
  select
    uid,
    s ->> 'kana',
    coalesce((s ->> 'd_attempts')::integer, 0),
    coalesce((s ->> 'd_correct')::integer, 0),
    coalesce((s ->> 'streak')::integer, 0),
    coalesce((s ->> 'best_streak')::integer, 0),
    coalesce((s ->> 'd_total_ms')::bigint, 0),
    coalesce((s ->> 'weight')::real, 1),
    (s ->> 'last_seen_at')::timestamptz,
    now()
  from jsonb_array_elements(coalesce(aggregates -> 'char_stats', '[]'::jsonb)) as s
  on conflict (user_id, kana) do update set
    attempts = cs.attempts + excluded.attempts,
    correct = cs.correct + excluded.correct,
    total_ms = cs.total_ms + excluded.total_ms,
    streak = excluded.streak,
    weight = excluded.weight,
    best_streak = greatest(cs.best_streak, excluded.best_streak),
    last_seen_at = greatest(cs.last_seen_at, excluded.last_seen_at),
    updated_at = now();

  -- Writing aggregates.
  insert into public.writing_char_stats as ws (
    user_id, kana, attempts, correct, streak, best_streak, total_ms,
    weight, last_seen_at, stroke_mistakes, memory_correct, updated_at
  )
  select
    uid,
    s ->> 'kana',
    coalesce((s ->> 'd_attempts')::integer, 0),
    coalesce((s ->> 'd_correct')::integer, 0),
    coalesce((s ->> 'streak')::integer, 0),
    coalesce((s ->> 'best_streak')::integer, 0),
    coalesce((s ->> 'd_total_ms')::bigint, 0),
    coalesce((s ->> 'weight')::real, 1),
    (s ->> 'last_seen_at')::timestamptz,
    coalesce((s ->> 'd_stroke_mistakes')::integer, 0),
    coalesce((s ->> 'd_memory_correct')::integer, 0),
    now()
  from jsonb_array_elements(coalesce(aggregates -> 'writing_char_stats', '[]'::jsonb)) as s
  on conflict (user_id, kana) do update set
    attempts = ws.attempts + excluded.attempts,
    correct = ws.correct + excluded.correct,
    total_ms = ws.total_ms + excluded.total_ms,
    streak = excluded.streak,
    weight = excluded.weight,
    best_streak = greatest(ws.best_streak, excluded.best_streak),
    last_seen_at = greatest(ws.last_seen_at, excluded.last_seen_at),
    stroke_mistakes = ws.stroke_mistakes + excluded.stroke_mistakes,
    memory_correct = ws.memory_correct + excluded.memory_correct,
    updated_at = now();

  -- Confusion pairs: canonicalize + group in case a batch carries both
  -- orders of the same pair (the insert would otherwise hit its own row).
  insert into public.confusion_pairs as cp (
    user_id, kana_a, kana_b, count, last_at
  )
  select
    uid,
    least(p ->> 'kana_a', p ->> 'kana_b'),
    greatest(p ->> 'kana_a', p ->> 'kana_b'),
    sum(coalesce((p ->> 'd_count')::integer, 0)),
    max((p ->> 'last_at')::timestamptz)
  from jsonb_array_elements(coalesce(aggregates -> 'confusion_pairs', '[]'::jsonb)) as p
  group by 2, 3
  on conflict (user_id, kana_a, kana_b) do update set
    count = cp.count + excluded.count,
    last_at = greatest(cp.last_at, excluded.last_at);

  -- Typos, keyed by shown kana + raw typed text.
  insert into public.typos as tp (user_id, kana, typo_text, count)
  select
    uid,
    t ->> 'kana',
    t ->> 'typo_text',
    sum(coalesce((t ->> 'd_count')::integer, 0))
  from jsonb_array_elements(coalesce(aggregates -> 'typos', '[]'::jsonb)) as t
  group by 2, 3
  on conflict (user_id, kana, typo_text) do update set
    count = tp.count + excluded.count;

  -- Group state: client-computed, last write wins per group.
  insert into public.confusion_groups as cg (
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
  from jsonb_array_elements(coalesce(aggregates -> 'groups', '[]'::jsonb)) as g
  on conflict (user_id, id) do update set
    members = excluded.members,
    status = excluded.status,
    total_misses = excluded.total_misses,
    streak = excluded.streak,
    activated_at = excluded.activated_at,
    graduated_at = excluded.graduated_at,
    times_activated = excluded.times_activated,
    updated_at = excluded.updated_at
  where excluded.updated_at >= cg.updated_at;

  -- Session counters: pure deltas.
  if aggregates ? 'totals' then
    insert into public.user_totals as ut (
      user_id, reading_sessions, writing_sessions, updated_at
    )
    values (
      uid,
      coalesce((aggregates -> 'totals' ->> 'd_reading_sessions')::integer, 0),
      coalesce((aggregates -> 'totals' ->> 'd_writing_sessions')::integer, 0),
      now()
    )
    on conflict (user_id) do update set
      reading_sessions = ut.reading_sessions + excluded.reading_sessions,
      writing_sessions = ut.writing_sessions + excluded.writing_sessions,
      updated_at = now();
  end if;

  -- Progression: monotonic fields (lessons, unlocks, records) merge with
  -- greatest()/jsonb-union so a device with a stale clock can never erase
  -- unlocked lessons; preference-ish fields (mode, track, day streak) are
  -- last-write-wins on the client clock.
  if aggregates ? 'progression' then
    insert into public.progression as pr (
      user_id, mode, track, lesson_hiragana, lesson_katakana, unlocked_at,
      day_last, day_streak, day_best, best_session_streak, best_accuracy,
      updated_at
    )
    select
      uid,
      p ->> 'mode',
      (p ->> 'track')::public.syllabary,
      coalesce((p ->> 'lesson_hiragana')::integer, 0),
      coalesce((p ->> 'lesson_katakana')::integer, 0),
      coalesce(p -> 'unlocked_at', '{}'::jsonb),
      p ->> 'day_last',
      coalesce((p ->> 'day_streak')::integer, 0),
      coalesce((p ->> 'day_best')::integer, 0),
      coalesce((p ->> 'best_session_streak')::integer, 0),
      coalesce((p ->> 'best_accuracy')::real, 0),
      coalesce((p ->> 'updated_at')::timestamptz, now())
    from (select aggregates -> 'progression' as p) as src
    on conflict (user_id) do update set
      mode = case when excluded.updated_at >= pr.updated_at
        then excluded.mode else pr.mode end,
      track = case when excluded.updated_at >= pr.updated_at
        then excluded.track else pr.track end,
      lesson_hiragana = greatest(pr.lesson_hiragana, excluded.lesson_hiragana),
      lesson_katakana = greatest(pr.lesson_katakana, excluded.lesson_katakana),
      unlocked_at = pr.unlocked_at || excluded.unlocked_at,
      day_last = case when excluded.updated_at >= pr.updated_at
        then excluded.day_last else pr.day_last end,
      day_streak = case when excluded.updated_at >= pr.updated_at
        then excluded.day_streak else pr.day_streak end,
      day_best = greatest(pr.day_best, excluded.day_best),
      best_session_streak = greatest(pr.best_session_streak, excluded.best_session_streak),
      best_accuracy = greatest(pr.best_accuracy, excluded.best_accuracy),
      updated_at = greatest(pr.updated_at, excluded.updated_at);
  end if;

  -- Settings/selection: opaque blobs, last write wins.
  if aggregates ? 'settings' then
    insert into public.user_settings as us (
      user_id, settings, selection, updated_at
    )
    values (
      uid,
      coalesce(aggregates -> 'settings' -> 'settings', '{}'::jsonb),
      coalesce(aggregates -> 'settings' -> 'selection', '{}'::jsonb),
      coalesce((aggregates -> 'settings' ->> 'updated_at')::timestamptz, now())
    )
    on conflict (user_id) do update set
      settings = excluded.settings,
      selection = excluded.selection,
      updated_at = excluded.updated_at
    where excluded.updated_at >= us.updated_at;
  end if;

  return jsonb_build_object(
    'status', 'applied',
    'attempts_inserted', attempts_inserted
  );
end;
$$;

revoke execute on function public.sync_push(uuid, jsonb, jsonb)
  from public, anon;
grant execute on function public.sync_push(uuid, jsonb, jsonb)
  to authenticated;
