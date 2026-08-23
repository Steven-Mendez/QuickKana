-- Realtime: another device's push shows up live. Only the tables the client
-- reacts to are published; RLS still gates what each subscriber sees.

alter publication supabase_realtime add table
  public.char_stats,
  public.writing_char_stats,
  public.confusion_groups,
  public.progression,
  public.user_settings;
