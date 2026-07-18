-- Down migration for: 20250101000001_extensions.sql
-- Local development only — see supabase/migrations/README.md.
-- Not applied automatically by the Supabase CLI.

drop extension if exists "pgcrypto";
