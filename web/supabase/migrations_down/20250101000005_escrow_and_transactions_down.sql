-- Down migration for: 20250101000005_escrow_and_transactions.sql
-- Local development only — see supabase/migrations/README.md.
-- Not applied automatically by the Supabase CLI.
--
-- transactions references escrow_accounts, so it must be dropped first.

drop table if exists public.transactions;
drop table if exists public.escrow_accounts;
