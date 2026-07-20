-- Migration: module2_memberships
-- Refines the Event Members and Teams schema based on the Module 2 architectural review.
-- 1. Separates Event Member identity from Team Membership relations.
-- 2. Uses proper event_member_id linking.
-- 3. Prepares the system for a normalized Community Directory.

-- ============================================================================
-- 1. event_members table enhancements
-- ============================================================================

-- Drop the old primary key on event_members so we can introduce a surrogate UUID id.
alter table public.event_members drop constraint if exists event_members_pkey cascade;

alter table public.event_members add column id uuid primary key default gen_random_uuid();
alter table public.event_members add constraint event_members_event_user_role_key unique (event_id, user_id, role);

-- Refine the "status" column into "availability"
alter table public.event_members rename column status to availability;
alter table public.event_members alter column availability drop not null;
-- If any rows exist, default to 'Not Looking'
update public.event_members set availability = 'Not Looking' where availability is null or availability not in ('Open to Join Team', 'Not Looking');
alter table public.event_members alter column availability set default 'Not Looking';
alter table public.event_members alter column availability set not null;

-- Use a CHECK constraint instead of ENUM for flexibility while preventing invalid states
alter table public.event_members add constraint event_members_availability_check 
  check (availability in ('Open to Join Team', 'Not Looking'));

-- Add skills and timezone columns
alter table public.event_members add column skills text[] not null default '{}';
alter table public.event_members add column timezone text;

-- ============================================================================
-- 2. Drop the original team_members table and replace with team_memberships
-- ============================================================================

drop trigger if exists trg_team_members_set_event_id on public.team_members;
drop function if exists public.set_team_member_event_id cascade;
drop table if exists public.team_members cascade;

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  event_member_id uuid not null references public.event_members (id) on delete cascade,
  role text not null check (role in ('Captain', 'Member')),
  joined_at timestamptz not null default now(),
  -- Ensure that an Event Member can only be part of one team at a time
  constraint team_memberships_unique_member unique (event_member_id)
);

create index idx_team_memberships_team_id on public.team_memberships (team_id);
create index idx_team_memberships_event_member_id on public.team_memberships (event_member_id);

-- ============================================================================
-- 3. Invitations enhancements
-- ============================================================================

-- Expand invitation scopes to include 'event'
alter table public.invitations drop constraint if exists invitations_scope_check;
alter table public.invitations add constraint invitations_scope_check 
  check (scope in ('workspace', 'team', 'event'));
