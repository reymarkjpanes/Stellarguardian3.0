    -- Migration: schema_alignment
-- Aligns table schemas with the service-layer code.
-- This fixes column name mismatches between the original schema design
-- and the implemented service layer.

-- ============================================================================
-- audit_records — Align with lib/services/audit.ts
-- ============================================================================
alter table public.audit_records rename column action_type to action;
alter table public.audit_records rename column target_type to resource_type;
alter table public.audit_records rename column target_id to resource_id;
alter table public.audit_records rename column occurred_at to created_at;
alter table public.audit_records rename column onchain_status to on_chain_status;

-- Add missing columns
alter table public.audit_records add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.audit_records add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.audit_records add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.audit_records add column if not exists amount text;

-- Drop columns that are no longer needed (merged into metadata)
alter table public.audit_records drop column if exists before_state;
alter table public.audit_records drop column if exists after_state;
alter table public.audit_records drop column if exists reason;
alter table public.audit_records drop column if exists request_meta;
alter table public.audit_records drop column if exists actor_name;

-- Add indexes for new columns
create index if not exists idx_audit_records_event_id on public.audit_records (event_id);
create index if not exists idx_audit_records_workspace_id on public.audit_records (workspace_id);

-- ============================================================================
-- notifications — Align with lib/services/notification.ts
-- ============================================================================
-- Replace the jsonb payload approach with explicit columns
alter table public.notifications add column if not exists title text not null default '';
alter table public.notifications add column if not exists body text not null default '';
alter table public.notifications add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.notifications add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.notifications add column if not exists action_url text;
alter table public.notifications add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.notifications add column if not exists read boolean not null default false;
alter table public.notifications add column if not exists email_sent boolean not null default false;

-- Drop the old payload column (data now in explicit columns)
alter table public.notifications drop column if exists payload;

-- Add index for unread notifications
create index if not exists idx_notifications_user_unread on public.notifications (user_id) where read = false;

-- ============================================================================
-- idempotency_keys — Align with lib/services/idempotency.ts
-- ============================================================================
-- The service uses a different schema. Drop and recreate.
drop table if exists public.idempotency_keys;

create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  request_hash text not null,
  response_body jsonb,
  response_status int,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint idempotency_keys_user_key_unique unique (user_id, key)
);

create index idx_idempotency_keys_expires_at on public.idempotency_keys (expires_at);
create index idx_idempotency_keys_user_id on public.idempotency_keys (user_id);

-- ============================================================================
-- disputes — Align with lib/services/dispute.ts
-- ============================================================================
alter table public.disputes rename column filer_id to filed_by;
alter table public.disputes rename column reason to description;
alter table public.disputes add column if not exists title text not null default '';
alter table public.disputes add column if not exists resolved_by uuid references public.users(id) on delete set null;
alter table public.disputes add column if not exists resolution text;

-- ============================================================================
-- winners — Align with lib/services/escrow.ts (disbursement)
-- ============================================================================
alter table public.winners rename column status to disbursement_status;

-- ============================================================================
-- invitations — Add workspace_id reference for RLS
-- ============================================================================
alter table public.invitations add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

-- Backfill workspace_id from scope_id where scope = 'workspace'
update public.invitations set workspace_id = scope_id::uuid where scope = 'workspace' and workspace_id is null;
