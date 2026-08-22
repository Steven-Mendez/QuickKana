-- Writing-mode aggregates, fully separate from reading (mirrors the two
-- independent localStorage stores on the client).

create table public.writing_char_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  kana text not null,
  attempts integer not null default 0,
  correct integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  total_ms bigint not null default 0,
  weight real not null default 1,
  last_seen_at timestamptz,
  -- Total wrong strokes ever drawn on this character.
  stroke_mistakes integer not null default 0,
  -- Clean, unassisted completions with no outline — what the lesson gate asks.
  memory_correct integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, kana)
);

alter table public.writing_char_stats enable row level security;

create policy "writing_char_stats_select_own" on public.writing_char_stats
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "writing_char_stats_insert_own" on public.writing_char_stats
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "writing_char_stats_update_own" on public.writing_char_stats
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "writing_char_stats_delete_own" on public.writing_char_stats
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.writing_char_stats to authenticated;
