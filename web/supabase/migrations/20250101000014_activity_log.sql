-- Migration: activity_log
-- Requirements: 28.3

-- activity_log — event activity timeline (Req 28.3)
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  actor_id uuid references public.users (id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_log_event_id on public.activity_log (event_id);
create index if not exists idx_activity_log_created_at on public.activity_log (created_at);

comment on table public.activity_log is
  'Chronological activity feed per event (Req 28.3).';

-- Enable RLS on new tables
alter table public.activity_log enable row level security;

-- Basic RLS policies
create policy "activity_log_read" on public.activity_log
  for select using (true);
