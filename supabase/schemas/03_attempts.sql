-- Append-only event log; the recomputable source of truth for every
-- aggregate. The pk is a client-generated uuid so replayed batches are
-- idempotent (`on conflict do nothing`). Only *first* attempts land here —
-- retries after a miss never generate an event.

create table public.attempts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  modality public.modality not null,
  syllabary public.syllabary not null,
  -- Stable kana id, e.g. `hiragana:つ` (same key the client stores under).
  kana text not null,
  expected text not null,
  answer text not null,
  is_correct boolean not null,
  -- Kana id the answer resolved to when it spelled another kana, else null.
  confused_with text,
  -- Answer spelled no kana at all; kept out of the confusion matrix.
  is_typo boolean not null default false,
  response_ms integer not null,
  -- Client session the attempt belongs to; makes session totals recomputable.
  session_id text,
  -- Modality-specific extras (writing: stroke mistakes, from_memory).
  payload jsonb,
  client_created_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index attempts_user_created_idx
  on public.attempts (user_id, created_at desc);

alter table public.attempts enable row level security;

create policy "attempts_select_own" on public.attempts
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "attempts_insert_own" on public.attempts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "attempts_delete_own" on public.attempts
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.attempts to authenticated;
