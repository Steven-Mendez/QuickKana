-- Confusion data. Pairs are symmetric, stored once in canonical order
-- (kana_a < kana_b) — same convention as the client's symmetric matrix.

create table public.confusion_pairs (
  user_id uuid not null references auth.users (id) on delete cascade,
  kana_a text not null,
  kana_b text not null,
  count integer not null default 0,
  last_at timestamptz,
  primary key (user_id, kana_a, kana_b),
  constraint confusion_pairs_canonical_order check (kana_a < kana_b)
);

alter table public.confusion_pairs enable row level security;

create policy "confusion_pairs_select_own" on public.confusion_pairs
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "confusion_pairs_insert_own" on public.confusion_pairs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "confusion_pairs_update_own" on public.confusion_pairs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "confusion_pairs_delete_own" on public.confusion_pairs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.confusion_pairs to authenticated;

-- Group state is computed by the client (connected components + streaks);
-- the server only stores it, last-write-wins on `updated_at`.
create table public.confusion_groups (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Deterministic client id: members sorted and joined with `|`.
  id text not null,
  members text[] not null,
  status public.group_status not null default 'active',
  total_misses integer not null default 0,
  streak integer not null default 0,
  activated_at timestamptz not null,
  graduated_at timestamptz,
  times_activated integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.confusion_groups enable row level security;

create policy "confusion_groups_select_own" on public.confusion_groups
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "confusion_groups_insert_own" on public.confusion_groups
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "confusion_groups_update_own" on public.confusion_groups
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "confusion_groups_delete_own" on public.confusion_groups
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.confusion_groups to authenticated;

-- Answers that spell no kana at all. Keyed by the kana that was shown too
-- (the client stores typos per shown kana), so pull is lossless.
create table public.typos (
  user_id uuid not null references auth.users (id) on delete cascade,
  kana text not null,
  typo_text text not null,
  count integer not null default 0,
  primary key (user_id, kana, typo_text)
);

alter table public.typos enable row level security;

create policy "typos_select_own" on public.typos
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "typos_insert_own" on public.typos
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "typos_update_own" on public.typos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "typos_delete_own" on public.typos
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.typos to authenticated;
