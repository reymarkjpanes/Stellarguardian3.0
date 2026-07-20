-- Migration: module2_improvements
-- Resolves architecture debts before Module 3: Teams.
-- 1. Expands `users` table for global identity (bio, timezone, country, etc.)
-- 2. Implements dictionary `skills` and `user_skills` mapping.
-- 3. Implements `user_links` and `user_presence`.
-- 4. Overhauls `invitations` with `type`, `status`, and `payload`.
-- 5. Standardizes `audit_logs`.
-- 6. Prepares reserved `user_*` tables for reputation, activity, badges, followers.

-- ============================================================================
-- 1. Extend Users Profile
-- ============================================================================

alter table public.users add column avatar_url text;
alter table public.users add column bio text;
alter table public.users add column timezone text;
alter table public.users add column country text;
alter table public.users add column city text;
alter table public.users add column preferred_language text;
alter table public.users add column updated_at timestamptz not null default now();

-- Clean up event_members to remove duplicated identity concerns
alter table public.event_members drop column if exists skills;
alter table public.event_members drop column if exists timezone;

-- Update event_members availability values
alter table public.event_members drop constraint if exists event_members_availability_check;
alter table public.event_members add constraint event_members_availability_check 
  check (availability in ('Available', 'Busy', 'Looking for Team', 'Looking for Mentor', 'Looking for Members', 'Unavailable'));

-- Migrate existing 'Open to Join Team' to 'Looking for Team'
update public.event_members set availability = 'Looking for Team' where availability = 'Open to Join Team';
-- Migrate 'Not Looking' to 'Unavailable' (or 'Busy')
update public.event_members set availability = 'Unavailable' where availability = 'Not Looking';


-- ============================================================================
-- 2. Structured Skills
-- ============================================================================

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) > 0),
  category text not null check (char_length(category) > 0)
);

create table public.user_skills (
  user_id uuid not null references public.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  level int not null check (level between 1 and 5),
  years_experience numeric(4,1),
  primary key (user_id, skill_id)
);


-- ============================================================================
-- 3. Social Links
-- ============================================================================

create table public.user_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('GitHub', 'Portfolio', 'LinkedIn', 'Twitter', 'YouTube', 'Devpost', 'Behance', 'Dribbble', 'Medium', 'Website')),
  url text not null,
  constraint user_links_user_type_key unique (user_id, type)
);


-- ============================================================================
-- 4. User Presence
-- ============================================================================

create table public.user_presence (
  user_id uuid primary key references public.users(id) on delete cascade,
  status text not null check (status in ('Online', 'Away', 'Offline')),
  device text not null check (device in ('web', 'mobile', 'desktop')),
  updated_at timestamptz not null default now()
);


-- ============================================================================
-- 5. Invitations Rewrite
-- ============================================================================

-- Rename 'scope' to 'type' and expand allowed values
alter table public.invitations rename column scope to type;
alter table public.invitations drop constraint if exists invitations_scope_check;
alter table public.invitations add constraint invitations_type_check 
  check (type in ('workspace', 'event', 'team', 'judge_assignment', 'mentor_assignment'));

-- Rename 'scope_id' to 'target_id' for consistency with type
alter table public.invitations rename column scope_id to target_id;
alter index if exists idx_invitations_scope rename to idx_invitations_type;

-- Add 'status' and 'payload'
alter table public.invitations add column payload jsonb;


-- ============================================================================
-- 6. Audit Logs (Platform-wide)
-- ============================================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  target_type text not null,
  target_id uuid,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index idx_audit_logs_event on public.audit_logs(event_id);
create index idx_audit_logs_workspace on public.audit_logs(workspace_id);


-- ============================================================================
-- 7. Reserved Future Tables
-- ============================================================================

-- We just define their shell structures to reserve the namespace.

create table public.user_reputation (
  user_id uuid primary key references public.users(id) on delete cascade,
  projects_completed int default 0,
  wins int default 0,
  hackathons_attended int default 0,
  mentoring_hours numeric(6,2) default 0,
  reviews_completed int default 0,
  trust_score int default 100,
  contribution_score int default 0,
  updated_at timestamptz default now()
);

create table public.user_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  activity_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  badge_name text not null,
  awarded_at timestamptz not null default now()
);

create table public.user_followers (
  follower_id uuid references public.users(id) on delete cascade,
  following_id uuid references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);
