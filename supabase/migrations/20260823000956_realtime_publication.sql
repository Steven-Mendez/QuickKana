revoke all on table "public"."attempts" from "anon";

revoke all on table "public"."char_stats" from "anon";

revoke all on table "public"."confusion_groups" from "anon";

revoke all on table "public"."confusion_pairs" from "anon";

revoke all on table "public"."profiles" from "anon";

revoke all on table "public"."progression" from "anon";

revoke all on table "public"."sync_batches" from "anon";

revoke all on table "public"."typos" from "anon";

revoke all on table "public"."user_settings" from "anon";

revoke all on table "public"."user_totals" from "anon";

revoke all on table "public"."writing_char_stats" from "anon";

alter publication "supabase_realtime" add table "public"."char_stats";

alter publication "supabase_realtime" add table "public"."confusion_groups";

alter publication "supabase_realtime" add table "public"."progression";

alter publication "supabase_realtime" add table "public"."user_settings";

alter publication "supabase_realtime" add table "public"."writing_char_stats";
