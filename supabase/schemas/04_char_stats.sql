-- Reading-mode aggregates, one row per (user, kana). Counters are applied
-- as deltas by sync_push; point-in-time values (weight, streak) are
-- last-write-wins. Everything here is recomputable from `attempts`.

create table public.char_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  kana text not null,
  attempts integer not null default 0,
  correct integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  total_ms bigint not null default 0,
  weight real not null default 1,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, kana)
);

alter table public.char_stats enable row level security;

create policy "char_stats_select_own" on public.char_stats
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "char_stats_insert_own" on public.char_stats
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "char_stats_update_own" on public.char_stats
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "char_stats_delete_own" on public.char_stats
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.char_stats to authenticated;
