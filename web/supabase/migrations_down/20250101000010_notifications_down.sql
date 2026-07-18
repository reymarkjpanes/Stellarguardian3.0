-- Down migration for: 20250101000010_notifications.sql
-- Local development only — see supabase/migrations/README.md.
-- Not applied automatically by the Supabase CLI.

drop table if exists public.notification_preferences;
drop table if exists public.notifications;
