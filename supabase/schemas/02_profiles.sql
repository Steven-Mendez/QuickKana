-- One row per auth user, created by trigger on signup (official
-- "Managing user data" pattern). `imported_at` marks the one-shot local
-- snapshot import so it can never run twice.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  imported_at timestamptz
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Table-level update (not column-level: pg-delta orders column grants
-- before its table-level revoke, wiping them). RLS restricts updates to the
-- user's own row; import_local_snapshot/delete_user_data (security invoker)
-- need to write imported_at.
grant select, update on public.profiles to authenticated;

-- security definer is required here: the trigger fires as the auth admin
-- role during signup, before any user session exists. It only ever inserts
-- the row for the user being created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
