-- Migration: phase1a_core_domain
-- Tables: event_versions, domain_events

-- 1. Event Versioning (Event v1 -> Event v2)
create table public.event_versions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  version int not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

create index idx_event_versions_event_id on public.event_versions (event_id, version);

-- Trigger to capture event versions automatically on update
create or replace function public.capture_event_version()
returns trigger
language plpgsql as $$
begin
  new.version := old.version + 1;
  insert into public.event_versions (event_id, version, snapshot)
  values (new.id, new.version, row_to_json(new));
  return new;
end;
$$;

create trigger trg_capture_event_version
  before update on public.events
  for each row
  when (old.* is distinct from new.*)
  execute function public.capture_event_version();


-- 2. Domain Events Emitter
create table public.domain_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null, -- e.g., 'EventPublished', 'SubmissionCreated'
  aggregate_id uuid not null, -- e.g., event_id or submission_id
  aggregate_type text not null,
  payload jsonb not null,
  emitted_at timestamptz not null default now(),
  processed boolean not null default false
);

create index idx_domain_events_unprocessed on public.domain_events (emitted_at) where processed = false;
create index idx_domain_events_aggregate on public.domain_events (aggregate_id, aggregate_type);

-- 3. Judging Strategy Addition (Competition Engine plugin selector)
alter table public.events
  add column judging_strategy text not null default 'Rubric' check (
    judging_strategy in ('Rubric', 'CommunityVote', 'SponsorVote', 'QuadraticFunding', 'AIReview', 'Custom')
  );

-- 4. Initial version insertion trigger for Events
create or replace function public.capture_initial_event_version()
returns trigger
language plpgsql as $$
begin
  insert into public.event_versions (event_id, version, snapshot)
  values (new.id, new.version, row_to_json(new));
  return new;
end;
$$;

create trigger trg_capture_initial_event_version
  after insert on public.events
  for each row
  execute function public.capture_initial_event_version();
