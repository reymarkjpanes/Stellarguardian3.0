-- Migration: events
-- Tables: events, event_members
-- Requirements: 2.2, 2.4, 2.7, 3.3, 7.2, 11.3, 12, 19.1, 23, 24.6, 30.3, 30.4, 37.1

-- events — Req 12, 23
-- state CHECK mirrors the 16 canonical EventState values in
-- web/types/enums.ts (EventStateSchema) exactly.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  organizer_id uuid not null references public.users (id) on delete restrict,
  title text not null check (char_length(title) between 1 and 200),
  description text not null check (char_length(description) <= 10000),
  tags text[] not null default '{}',
  category text not null check (char_length(category) > 0),
  format text not null check (char_length(format) > 0),
  state text not null default 'Draft' check (
    state in (
      'Draft',
      'Published',
      'RegistrationOpen',
      'RegistrationClosed',
      'TeamFormation',
      'SubmissionOpen',
      'SubmissionClosed',
      'Judging',
      'ReviewObjectionWindow',
      'WinnersFinalized',
      'OrganizerFundsEscrow',
      'EscrowLocked',
      'PrizeDistribution',
      'Completed',
      'Cancelled',
      'Archived'
    )
  ),
  review_window_hours int not null default 72 check (review_window_hours between 24 and 168),
  team_size_min int not null check (team_size_min > 0),
  team_size_max int not null check (team_size_max > 0),
  registration_deadline timestamptz,
  prize_pool_target numeric check (prize_pool_target is null or prize_pool_target >= 0),
  network_mode text not null check (network_mode in ('testnet', 'mainnet')),
  resubmission_policy jsonb not null default '{"allowed": true}'::jsonb,
  file_policy jsonb not null default '{"allowedMimeTypes": []}'::jsonb,
  retention_days int not null default 90 check (retention_days > 0),
  version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_team_size_range check (team_size_max >= team_size_min)
);

create index idx_events_workspace_id on public.events (workspace_id);
create index idx_events_state on public.events (state);
create index idx_events_registration_deadline on public.events (registration_deadline);

-- GIN full-text index on title || description || tags (Req 37.1).
-- tags is text[]; array_to_string flattens it into the tsvector input.
create index idx_events_fulltext on public.events
  using gin (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(array_to_string(tags, ' '), '')
    )
  );

comment on table public.events is
  'Canonical event lifecycle (16 states, Req 23.1); GIN full-text index supports discovery search (Req 37.1).';

-- event_members — Req 3.3, 11.3
create table public.event_members (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('Organizer', 'Judge', 'Participant', 'Sponsor', 'Mentor')),
  status text not null check (char_length(status) > 0),
  primary key (event_id, user_id, role)
);

create index idx_event_members_user_id on public.event_members (user_id);
create index idx_event_members_event_id_role on public.event_members (event_id, role);

-- A user cannot hold both Judge and Participant on the same event (Req 11.3).
-- A partial unique index on (event_id, user_id) restricted to the two
-- mutually-exclusive roles guarantees at most one row from {Judge,
-- Participant} per (event, user) pair, which is equivalent to forbidding
-- both roles being held simultaneously.
create unique index event_members_judge_participant_exclusive
  on public.event_members (event_id, user_id)
  where role in ('Judge', 'Participant');

comment on index public.event_members_judge_participant_exclusive is
  'Enforces Req 11.3: a user cannot be both Judge and Participant on one event.';
