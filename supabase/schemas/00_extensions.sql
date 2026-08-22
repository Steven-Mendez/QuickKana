-- Platform extensions present on every Supabase database. Declared
-- explicitly so pg-delta manages them instead of treating the tree as a
-- legacy export (it would otherwise refuse to sync, or drop them).

create extension if not exists pgcrypto with schema extensions;

create extension if not exists "uuid-ossp" with schema extensions;
