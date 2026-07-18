-- Down migration for: 20250101000002_users_and_wallets.sql
-- Local development only — see supabase/migrations/README.md.
-- Not applied automatically by the Supabase CLI.
--
-- Drop in reverse dependency order: wallet_challenges and wallets both
-- reference users, so they must be dropped before users.

drop table if exists public.wallet_challenges;
drop table if exists public.wallets;
drop table if exists public.users;
