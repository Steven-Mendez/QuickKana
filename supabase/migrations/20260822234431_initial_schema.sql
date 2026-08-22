set local check_function_bodies = off;

create table "public"."attempts" (
  "id"                uuid                     not null,
  "user_id"           uuid                     not null,
  "kana"              text                     not null,
  "expected"          text                     not null,
  "answer"            text                     not null,
  "is_correct"        boolean                  not null,
  "confused_with"     text,
  "is_typo"           boolean                  not null default false,
  "response_ms"       integer                  not null,
  "session_id"        text,
  "payload"           jsonb,
  "client_created_at" timestamp with time zone not null,
  "created_at"        timestamp with time zone not null default now(),
  constraint "attempts_pkey" primary key (id)
);

alter table "public"."attempts"
  enable row level security;

create table "public"."char_stats" (
  "user_id"      uuid                     not null,
  "kana"         text                     not null,
  "attempts"     integer                  not null default 0,
  "correct"      integer                  not null default 0,
  "streak"       integer                  not null default 0,
  "best_streak"  integer                  not null default 0,
  "total_ms"     bigint                   not null default 0,
  "weight"       real                     not null default 1,
  "last_seen_at" timestamp with time zone,
  "updated_at"   timestamp with time zone not null default now(),
  constraint "char_stats_pkey" primary key (user_id, kana)
);

alter table "public"."char_stats"
  enable row level security;

create table "public"."confusion_groups" (
  "user_id"         uuid                     not null,
  "id"              text                     not null,
  "members"         text[]                   not null,
  "total_misses"    integer                  not null default 0,
  "streak"          integer                  not null default 0,
  "activated_at"    timestamp with time zone not null,
  "graduated_at"    timestamp with time zone,
  "times_activated" integer                  not null default 1,
  "updated_at"      timestamp with time zone not null default now(),
  constraint "confusion_groups_pkey" primary key (user_id, id)
);

alter table "public"."confusion_groups"
  enable row level security;

create table "public"."confusion_pairs" (
  "user_id" uuid                     not null,
  "kana_a"  text                     not null,
  "kana_b"  text                     not null,
  "count"   integer                  not null default 0,
  "last_at" timestamp with time zone,
  constraint "confusion_pairs_canonical_order" check ((kana_a < kana_b)),
  constraint "confusion_pairs_pkey" primary key (user_id, kana_a, kana_b)
);

alter table "public"."confusion_pairs"
  enable row level security;

create table "public"."profiles" (
  "id"           uuid                     not null,
  "display_name" text,
  "created_at"   timestamp with time zone not null default now(),
  "imported_at"  timestamp with time zone,
  constraint "profiles_pkey" primary key (id)
);

alter table "public"."profiles"
  enable row level security;

create table "public"."progression" (
  "user_id"             uuid                     not null,
  "mode"                text                     not null default 'journey'::text,
  "lesson_hiragana"     integer                  not null default 0,
  "lesson_katakana"     integer                  not null default 0,
  "unlocked_at"         jsonb                    not null default '{}'::jsonb,
  "day_last"            text,
  "day_streak"          integer                  not null default 0,
  "day_best"            integer                  not null default 0,
  "best_session_streak" integer                  not null default 0,
  "best_accuracy"       real                     not null default 0,
  "updated_at"          timestamp with time zone not null default now(),
  constraint "progression_mode_check" check ((mode = ANY (ARRAY['free'::text, 'journey'::text]))),
  constraint "progression_pkey" primary key (user_id)
);

alter table "public"."progression"
  enable row level security;

create table "public"."sync_batches" (
  "id"         uuid                     not null,
  "user_id"    uuid                     not null,
  "applied_at" timestamp with time zone not null default now(),
  constraint "sync_batches_pkey" primary key (id)
);

alter table "public"."sync_batches"
  enable row level security;

create table "public"."typos" (
  "user_id"   uuid    not null,
  "kana"      text    not null,
  "typo_text" text    not null,
  "count"     integer not null default 0,
  constraint "typos_pkey" primary key (user_id, kana, typo_text)
);

alter table "public"."typos"
  enable row level security;

create table "public"."user_settings" (
  "user_id"    uuid                     not null,
  "settings"   jsonb                    not null default '{}'::jsonb,
  "selection"  jsonb                    not null default '{}'::jsonb,
  "updated_at" timestamp with time zone not null default now(),
  constraint "user_settings_pkey" primary key (user_id)
);

alter table "public"."user_settings"
  enable row level security;

create table "public"."user_totals" (
  "user_id"          uuid                     not null,
  "reading_sessions" integer                  not null default 0,
  "writing_sessions" integer                  not null default 0,
  "updated_at"       timestamp with time zone not null default now(),
  constraint "user_totals_pkey" primary key (user_id)
);

alter table "public"."user_totals"
  enable row level security;

create table "public"."writing_char_stats" (
  "user_id"         uuid                     not null,
  "kana"            text                     not null,
  "attempts"        integer                  not null default 0,
  "correct"         integer                  not null default 0,
  "streak"          integer                  not null default 0,
  "best_streak"     integer                  not null default 0,
  "total_ms"        bigint                   not null default 0,
  "weight"          real                     not null default 1,
  "last_seen_at"    timestamp with time zone,
  "stroke_mistakes" integer                  not null default 0,
  "memory_correct"  integer                  not null default 0,
  "updated_at"      timestamp with time zone not null default now(),
  constraint "writing_char_stats_pkey" primary key (user_id, kana)
);

alter table "public"."writing_char_stats"
  enable row level security;

create type "public"."group_status" as enum (
  'active',
  'graduated'
);

alter table "public"."confusion_groups"
  add column "status" public.group_status not null default 'active'::public.group_status;

create type "public"."modality" as enum (
  'reading',
  'writing'
);

alter table "public"."attempts"
  add column "modality" public.modality not null;

create type "public"."syllabary" as enum (
  'hiragana',
  'katakana'
);

alter table "public"."attempts"
  add column "syllabary" public.syllabary not null;

alter table "public"."progression"
  add column "track" public.syllabary not null default 'hiragana'::public.syllabary;

create or replace function public.delete_user_data()
  returns jsonb
  language plpgsql
  set search_path to ''
  AS $function$
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
$function$;

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$function$;

create or replace function public.import_local_snapshot (
  snapshot jsonb
)
  returns jsonb
  language plpgsql
  set search_path to ''
  AS $function$
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
$function$;

create or replace function public.sync_push (
  batch_id   uuid,
  events     jsonb default '[]'::jsonb,
  aggregates jsonb default '{}'::jsonb
)
  returns jsonb
  language plpgsql
  set search_path to ''
  AS $function$
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
$function$;

alter table "public"."attempts"
  add constraint "attempts_user_id_fkey" foreign key (user_id) references auth.users(id) on delete cascade;

alter table "public"."char_stats"
  add constraint "char_stats_user_id_fkey" foreign key (user_id) references auth.users(id) on delete cascade;

alter table "public"."confusion_groups"
  add constraint "confusion_groups_user_id_fkey" foreign key (user_id) references auth.users(id) on delete cascade;

alter table "public"."confusion_pairs"
  add constraint "confusion_pairs_user_id_fkey" foreign key (user_id) references auth.users(id) on delete cascade;

alter table "public"."profiles"
  add constraint "profiles_id_fkey" foreign key (id) references auth.users(id) on delete cascade;

alter table "public"."progression"
  add constraint "progression_user_id_fkey" foreign key (user_id) references auth.users(id) on delete cascade;

alter table "public"."sync_batches"
  add constraint "sync_batches_user_id_fkey" foreign key (user_id) references auth.users(id) on delete cascade;

alter table "public"."typos"
  add constraint "typos_user_id_fkey" foreign key (user_id) references auth.users(id) on delete cascade;

alter table "public"."user_settings"
  add constraint "user_settings_user_id_fkey" foreign key (user_id) references auth.users(id) on delete cascade;

alter table "public"."user_totals"
  add constraint "user_totals_user_id_fkey" foreign key (user_id) references auth.users(id) on delete cascade;

alter table "public"."writing_char_stats"
  add constraint "writing_char_stats_user_id_fkey" foreign key (user_id) references auth.users(id) on delete cascade;

create index attempts_user_created_idx on public.attempts using btree (user_id, created_at desc);

create index sync_batches_user_idx on public.sync_batches using btree (user_id);

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create policy "attempts_delete_own" on "public"."attempts"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "attempts_insert_own" on "public"."attempts"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "attempts_select_own" on "public"."attempts"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "char_stats_delete_own" on "public"."char_stats"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "char_stats_insert_own" on "public"."char_stats"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "char_stats_select_own" on "public"."char_stats"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "char_stats_update_own" on "public"."char_stats"
  for update
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "confusion_groups_delete_own" on "public"."confusion_groups"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "confusion_groups_insert_own" on "public"."confusion_groups"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "confusion_groups_select_own" on "public"."confusion_groups"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "confusion_groups_update_own" on "public"."confusion_groups"
  for update
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "confusion_pairs_delete_own" on "public"."confusion_pairs"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "confusion_pairs_insert_own" on "public"."confusion_pairs"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "confusion_pairs_select_own" on "public"."confusion_pairs"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "confusion_pairs_update_own" on "public"."confusion_pairs"
  for update
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "profiles_select_own" on "public"."profiles"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = id));

create policy "profiles_update_own" on "public"."profiles"
  for update
  to "authenticated"
  using ((( select auth.uid() as uid) = id))
  with check ((( SELECT auth.uid() AS uid) = id));

create policy "progression_delete_own" on "public"."progression"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "progression_insert_own" on "public"."progression"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "progression_select_own" on "public"."progression"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "progression_update_own" on "public"."progression"
  for update
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "sync_batches_delete_own" on "public"."sync_batches"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "sync_batches_insert_own" on "public"."sync_batches"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "sync_batches_select_own" on "public"."sync_batches"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "typos_delete_own" on "public"."typos"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "typos_insert_own" on "public"."typos"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "typos_select_own" on "public"."typos"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "typos_update_own" on "public"."typos"
  for update
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "user_settings_delete_own" on "public"."user_settings"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "user_settings_insert_own" on "public"."user_settings"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "user_settings_select_own" on "public"."user_settings"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "user_settings_update_own" on "public"."user_settings"
  for update
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "user_totals_delete_own" on "public"."user_totals"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "user_totals_insert_own" on "public"."user_totals"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "user_totals_select_own" on "public"."user_totals"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "user_totals_update_own" on "public"."user_totals"
  for update
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "writing_char_stats_delete_own" on "public"."writing_char_stats"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "writing_char_stats_insert_own" on "public"."writing_char_stats"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "writing_char_stats_select_own" on "public"."writing_char_stats"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id));

create policy "writing_char_stats_update_own" on "public"."writing_char_stats"
  for update
  to "authenticated"
  using ((( select auth.uid() as uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

revoke all on function "public"."delete_user_data"() from public;

grant execute on function "public"."delete_user_data"() to "authenticated", "postgres";

revoke all on function "public"."handle_new_user"() from public;

grant execute on function "public"."handle_new_user"() to "postgres";

revoke all on function "public"."import_local_snapshot"(jsonb) from public;

grant execute on function "public"."import_local_snapshot"(jsonb) to "authenticated", "postgres";

revoke all on function "public"."sync_push"(uuid, jsonb, jsonb) from public;

grant execute on function "public"."sync_push"(uuid, jsonb, jsonb) to "authenticated", "postgres";

revoke all on table "public"."attempts" from "authenticated";

grant delete, insert, select on table "public"."attempts" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."attempts" to "postgres";

grant maintain, references, trigger, truncate on table "public"."attempts" to "service_role";

revoke all on table "public"."char_stats" from "authenticated";

grant delete, insert, select, update on table "public"."char_stats" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."char_stats" to "postgres";

grant maintain, references, trigger, truncate on table "public"."char_stats" to "service_role";

revoke all on table "public"."confusion_groups" from "authenticated";

grant delete, insert, select, update on table "public"."confusion_groups" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."confusion_groups" to "postgres";

grant maintain, references, trigger, truncate on table "public"."confusion_groups" to "service_role";

revoke all on table "public"."confusion_pairs" from "authenticated";

grant delete, insert, select, update on table "public"."confusion_pairs" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."confusion_pairs" to "postgres";

grant maintain, references, trigger, truncate on table "public"."confusion_pairs" to "service_role";

revoke all on table "public"."profiles" from "authenticated";

grant select, update on table "public"."profiles" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."profiles" to "postgres";

grant maintain, references, trigger, truncate on table "public"."profiles" to "service_role";

revoke all on table "public"."progression" from "authenticated";

grant delete, insert, select, update on table "public"."progression" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."progression" to "postgres";

grant maintain, references, trigger, truncate on table "public"."progression" to "service_role";

revoke all on table "public"."sync_batches" from "authenticated";

grant delete, insert, select on table "public"."sync_batches" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."sync_batches" to "postgres";

grant maintain, references, trigger, truncate on table "public"."sync_batches" to "service_role";

revoke all on table "public"."typos" from "authenticated";

grant delete, insert, select, update on table "public"."typos" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."typos" to "postgres";

grant maintain, references, trigger, truncate on table "public"."typos" to "service_role";

revoke all on table "public"."user_settings" from "authenticated";

grant delete, insert, select, update on table "public"."user_settings" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."user_settings" to "postgres";

grant maintain, references, trigger, truncate on table "public"."user_settings" to "service_role";

revoke all on table "public"."user_totals" from "authenticated";

grant delete, insert, select, update on table "public"."user_totals" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."user_totals" to "postgres";

grant maintain, references, trigger, truncate on table "public"."user_totals" to "service_role";

revoke all on table "public"."writing_char_stats" from "authenticated";

grant delete, insert, select, update on table "public"."writing_char_stats" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."writing_char_stats" to "postgres";

grant maintain, references, trigger, truncate on table "public"."writing_char_stats" to "service_role";

grant usage on type "public"."group_status" to "postgres";

grant usage on type "public"."modality" to "postgres";

grant usage on type "public"."syllabary" to "postgres";
