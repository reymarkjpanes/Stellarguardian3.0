-- Migration: extensions
-- Enables Postgres extensions required by later migrations.
-- Requirements: 2.1, 2.2

-- uuid-ossp / pgcrypto provide gen_random_uuid(); pgcrypto is bundled with
-- Supabase Postgres images and is the recommended source for gen_random_uuid().
create extension if not exists "pgcrypto";

-- pg_trgm is not required by the current schema but is commonly needed
-- alongside full-text search trigram lookups; omitted intentionally to keep
-- this migration minimal and scoped to what Data Models requires.
