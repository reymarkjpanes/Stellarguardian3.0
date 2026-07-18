-- Migration: idempotency_and_audit
-- Tables: idempotency_keys, audit_records
-- Requirements: 2.2, 2.4, 2.7, 13, 19.1, 28, 31
--
-- Append-only enforcement (no UPDATE/DELETE grants + BEFORE UPDATE/DELETE
-- triggers) for audit_records is added in task 3.3 alongside RLS policies.
-- This migration only establishes table shape, constraints, and indexes.

-- idempotency_keys — Req 13
create table public.idempotency_keys (
  key text primary key check (char_length(key) between 1 and 255),
  endpoint text not null check (char_length(endpoint) > 0),
  request_hash text not null check (char_length(request_hash) > 0),
  response_payload jsonb,
  status_code int not null check (status_code between 100 and 599),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index idx_idempotency_keys_expires_at on public.idempotency_keys (expires_at);

comment on table public.idempotency_keys is
  'Primary key on key provides the DB unique constraint required to insert-before-execute (Req 13.5). expires_at = created_at + 24h (Req 13.3).';

-- audit_records — Req 28, 31 (append-only; enforcement added in task 3.3)
create table public.audit_records (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users (id) on delete set null,
  actor_name text,
  occurred_at timestamptz(3) not null default now(),
  action_type text not null check (char_length(action_type) > 0),
  target_type text not null check (char_length(target_type) > 0),
  target_id text not null check (char_length(target_id) > 0),
  wallet_address text,
  tx_hash text,
  before_state jsonb,
  after_state jsonb,
  reason text,
  request_meta jsonb,
  onchain_status text
);

create index idx_audit_records_actor_id on public.audit_records (actor_id);
create index idx_audit_records_action_type on public.audit_records (action_type);
create index idx_audit_records_target_id on public.audit_records (target_id);
create index idx_audit_records_occurred_at on public.audit_records (occurred_at);

comment on table public.audit_records is
  'Immutable action log (Req 31.1-31.2). No UPDATE/DELETE grants and BEFORE UPDATE/DELETE triggers are added in task 3.3.';
