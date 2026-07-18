-- Migration: disputes
-- Tables: disputes, dispute_evidence
-- Requirements: 2.2, 2.4, 2.7, 7, 19.1, 30.6, 39

-- disputes — Req 7, 39
-- state CHECK mirrors the 5 canonical DisputeState values in
-- web/types/enums.ts (DisputeStateSchema) exactly.
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  filer_id uuid not null references public.users (id) on delete restrict,
  state text not null default 'Open' check (state in ('Open', 'UnderReview', 'Upheld', 'Dismissed', 'Withdrawn')),
  reason text not null check (char_length(reason) between 1 and 5000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  version int not null default 0
);

create index idx_disputes_event_id on public.disputes (event_id);
create index idx_disputes_state on public.disputes (state);

-- dispute_evidence — Req 30.6
create table public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  storage_path text not null check (char_length(storage_path) > 0),
  mime_type text not null check (char_length(mime_type) > 0),
  size_bytes bigint not null check (size_bytes >= 0)
);

create index idx_dispute_evidence_dispute_id on public.dispute_evidence (dispute_id);
