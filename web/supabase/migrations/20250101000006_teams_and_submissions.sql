-- Migration: teams_and_submissions
-- Tables: teams, team_members, submissions, submission_versions, submission_files
-- Requirements: 2.2, 2.4, 2.7, 10, 15, 19.1, 30

-- teams — Req 10
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  captain_id uuid not null references public.users (id) on delete restrict,
  version int not null default 0
);

create index idx_teams_event_id on public.teams (event_id);

-- team_members — Req 10.7
--
-- Design decision: design.md specifies "a participant belongs to at most one
-- team per event (partial unique index on (event_id, user_id))", but
-- event_id is not a natural column of team_members — it only has team_id and
-- user_id. A direct partial unique index on team_members(event_id, user_id)
-- is therefore not expressible without denormalizing event_id onto this
-- table. We add a denormalized, NOT NULL `event_id` column to team_members,
-- populated automatically from teams.event_id via a BEFORE INSERT trigger
-- (so callers only ever supply team_id/user_id, exactly as the Zod
-- CreateTeamSchema/TeamMemberSchema shapes suggest), and put the required
-- unique index on that column. This keeps the one-team-per-participant-per-
-- event invariant enforceable by Postgres itself rather than by application
-- code or a cross-table subquery trigger.
create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index idx_team_members_user_id on public.team_members (user_id);

create unique index team_members_one_team_per_event
  on public.team_members (event_id, user_id);

comment on index public.team_members_one_team_per_event is
  'Enforces Req 10.7: a participant belongs to at most one team per event.';

create or replace function public.set_team_member_event_id()
returns trigger
language plpgsql
as $$
begin
  select t.event_id into new.event_id
  from public.teams t
  where t.id = new.team_id;

  if new.event_id is null then
    raise exception 'team_members.team_id % does not reference an existing team', new.team_id;
  end if;

  return new;
end;
$$;

create trigger trg_team_members_set_event_id
  before insert on public.team_members
  for each row
  execute function public.set_team_member_event_id();

comment on function public.set_team_member_event_id() is
  'Denormalizes teams.event_id onto team_members so the one-team-per-participant-per-event partial unique index (Req 10.7) can be expressed directly on team_members.';

-- submissions / submission_versions — Req 15, 30
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  submitter_id uuid not null references public.users (id) on delete restrict,
  status text not null default 'Draft' check (status in ('Draft', 'Submitted')),
  current_version int not null default 1 check (current_version > 0),
  version int not null default 0,
  updated_at timestamptz not null default now()
);

create index idx_submissions_event_id on public.submissions (event_id);
create index idx_submissions_team_id on public.submissions (team_id);
create index idx_submissions_submitter_id on public.submissions (submitter_id);

-- submission_versions — append-only history (Req 30.2, 30.8)
create table public.submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  version_no int not null check (version_no > 0),
  content jsonb not null,
  diff_summary jsonb not null default '{}'::jsonb,
  actor_id uuid not null references public.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint submission_versions_unique_version unique (submission_id, version_no)
);

create index idx_submission_versions_submission_id on public.submission_versions (submission_id);

comment on table public.submission_versions is
  'Append-only version history; incrementing version_no per submission (Req 30.2).';

-- submission_files — Req 30.4-30.7
create table public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  storage_path text not null check (char_length(storage_path) > 0),
  mime_type text not null check (char_length(mime_type) > 0),
  size_bytes bigint not null check (size_bytes >= 0),
  sanitized_filename text not null check (char_length(sanitized_filename) > 0)
);

create index idx_submission_files_submission_id on public.submission_files (submission_id);
