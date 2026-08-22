-- Journey/progression state, one row per user. Low-frequency writes,
-- last-write-wins guarded by the client-supplied `updated_at`.

create table public.progression (
  user_id uuid primary key references auth.users (id) on delete cascade,
  mode text not null default 'journey'
    constraint progression_mode_check check (mode in ('free', 'journey')),
  track public.syllabary not null default 'hiragana',
  lesson_hiragana integer not null default 0,
  lesson_katakana integer not null default 0,
  -- `${script}:${index}` → unlock timestamp (ms epoch), as stored client-side.
  unlocked_at jsonb not null default '{}'::jsonb,
  day_last text,
  day_streak integer not null default 0,
  day_best integer not null default 0,
  best_session_streak integer not null default 0,
  best_accuracy real not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.progression enable row level security;

create policy "progression_select_own" on public.progression
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "progression_insert_own" on public.progression
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "progression_update_own" on public.progression
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "progression_delete_own" on public.progression
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.progression to authenticated;

-- Session counters live apart from `progression` because they are applied
-- as idempotent deltas, while `progression` is last-write-wins — mixing the
-- two write disciplines in one row would let devices clobber each other.
create table public.user_totals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reading_sessions integer not null default 0,
  writing_sessions integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.user_totals enable row level security;

create policy "user_totals_select_own" on public.user_totals
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_totals_insert_own" on public.user_totals
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_totals_update_own" on public.user_totals
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_totals_delete_own" on public.user_totals
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_totals to authenticated;

-- Settings + free-selection, opaque to the server (client owns the shape).
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  selection jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "user_settings_select_own" on public.user_settings
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_settings_insert_own" on public.user_settings
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_settings_update_own" on public.user_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_settings_delete_own" on public.user_settings
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_settings to authenticated;
