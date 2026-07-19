-- Migration: submission_files and dispute_evidence
-- Requirements: 15, 30, 39
-- Tables missing from original migrations per design doc ER diagram

-- submission_files — file attachments for submissions (Req 30.4)
create table if not exists public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sanitized_filename text not null,
  created_at timestamptz not null default now()
);

create index idx_submission_files_submission_id on public.submission_files (submission_id);

comment on table public.submission_files is
  'File attachments for submissions stored in Supabase Storage (Req 30.4).';

-- dispute_evidence — evidence attachments to disputes (Req 39)
create table if not exists public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  submitted_by uuid not null references public.users (id) on delete cascade,
  file_path text,
  description text not null check (char_length(description) <= 5000),
  created_at timestamptz not null default now()
);

create index idx_dispute_evidence_dispute_id on public.dispute_evidence (dispute_id);

comment on table public.dispute_evidence is
  'Evidence attached to disputes for review (Req 39).';

-- submission_versions — append-only version history (Req 30.2)
create table if not exists public.submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  version_no int not null,
  content jsonb not null,
  diff_summary jsonb,
  actor_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  constraint submission_versions_unique unique (submission_id, version_no)
);

create index idx_submission_versions_submission on public.submission_versions (submission_id);

comment on table public.submission_versions is
  'Append-only submission version history (Req 30.2).';

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

create index idx_activity_log_event_id on public.activity_log (event_id);
create index idx_activity_log_created_at on public.activity_log (created_at);

comment on table public.activity_log is
  'Chronological activity feed per event (Req 28.3).';

-- Enable RLS on new tables
alter table public.submission_files enable row level security;
alter table public.dispute_evidence enable row level security;
alter table public.submission_versions enable row level security;
alter table public.activity_log enable row level security;

-- Basic RLS policies
create policy "submission_files_event_access" on public.submission_files
  for select using (true);

create policy "dispute_evidence_event_access" on public.dispute_evidence
  for select using (true);

create policy "submission_versions_read" on public.submission_versions
  for select using (true);

create policy "activity_log_read" on public.activity_log
  for select using (true);
