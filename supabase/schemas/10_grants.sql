-- Hardening over the platform's default privileges (which grant ALL on new
-- public tables to anon/authenticated). Guests never touch the API, so anon
-- gets nothing; authenticated keeps only row-level DML — TRUNCATE in
-- particular is NOT subject to RLS and must never reach client roles.
-- service_role is untouched: it is server-only and bypasses RLS by design.

revoke all on public.profiles from anon;
revoke truncate, references, trigger, maintain on public.profiles from authenticated;

revoke all on public.attempts from anon;
revoke truncate, references, trigger, maintain on public.attempts from authenticated;

revoke all on public.char_stats from anon;
revoke truncate, references, trigger, maintain on public.char_stats from authenticated;

revoke all on public.writing_char_stats from anon;
revoke truncate, references, trigger, maintain on public.writing_char_stats from authenticated;

revoke all on public.confusion_pairs from anon;
revoke truncate, references, trigger, maintain on public.confusion_pairs from authenticated;

revoke all on public.confusion_groups from anon;
revoke truncate, references, trigger, maintain on public.confusion_groups from authenticated;

revoke all on public.typos from anon;
revoke truncate, references, trigger, maintain on public.typos from authenticated;

revoke all on public.progression from anon;
revoke truncate, references, trigger, maintain on public.progression from authenticated;

revoke all on public.user_totals from anon;
revoke truncate, references, trigger, maintain on public.user_totals from authenticated;

revoke all on public.user_settings from anon;
revoke truncate, references, trigger, maintain on public.user_settings from authenticated;

revoke all on public.sync_batches from anon;
revoke truncate, references, trigger, maintain on public.sync_batches from authenticated;
