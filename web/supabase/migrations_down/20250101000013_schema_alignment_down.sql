-- Down migration: schema_alignment
-- Reverts the column renames and additions from migration 013.

-- winners
alter table public.winners rename column disbursement_status to status;

-- disputes
alter table public.disputes drop column if exists resolution;
alter table public.disputes drop column if exists resolved_by;
alter table public.disputes drop column if exists title;
alter table public.disputes rename column description to reason;
alter table public.disputes rename column filed_by to filer_id;

-- idempotency_keys — recreate original
drop table if exists public.idempotency_keys;
create table public.idempotency_keys (
  key text primary key check (char_length(key) between 1 and 255),
  endpoint text not null check (char_length(endpoint) > 0),
  request_hash text not null check (char_length(request_hash) > 0),
  response_payload jsonb,
  status_code int not null check (status_code between 100 and 599),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- notifications — revert to payload-based
alter table public.notifications drop column if exists email_sent;
alter table public.notifications drop column if exists read;
alter table public.notifications drop column if exists metadata;
alter table public.notifications drop column if exists action_url;
alter table public.notifications drop column if exists workspace_id;
alter table public.notifications drop column if exists event_id;
alter table public.notifications drop column if exists body;
alter table public.notifications drop column if exists title;
alter table public.notifications add column if not exists payload jsonb not null default '{}'::jsonb;

-- audit_records — revert column renames
alter table public.audit_records drop column if exists amount;
alter table public.audit_records drop column if exists metadata;
alter table public.audit_records drop column if exists workspace_id;
alter table public.audit_records drop column if exists event_id;
alter table public.audit_records add column if not exists actor_name text;
alter table public.audit_records add column if not exists request_meta jsonb;
alter table public.audit_records add column if not exists reason text;
alter table public.audit_records add column if not exists after_state jsonb;
alter table public.audit_records add column if not exists before_state jsonb;
alter table public.audit_records rename column on_chain_status to onchain_status;
alter table public.audit_records rename column created_at to occurred_at;
alter table public.audit_records rename column resource_id to target_id;
alter table public.audit_records rename column resource_type to target_type;
alter table public.audit_records rename column action to action_type;
