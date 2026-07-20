-- Migration: 20250101000026_team_tables.sql
-- Description: Alter existing teams/members tables and create new ones for Module 3.

-- 1. Alter existing teams table
-- Use CASCADE to drop dependent RLS policies, as we rewrite them in migration 29
ALTER TABLE public.teams DROP COLUMN IF EXISTS captain_id CASCADE;
ALTER TABLE public.teams DROP COLUMN IF EXISTS status CASCADE;
ALTER TABLE public.teams DROP COLUMN IF EXISTS visibility CASCADE;

ALTER TABLE public.teams 
    ADD COLUMN IF NOT EXISTS slug text,
    ADD COLUMN IF NOT EXISTS tagline text,
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS logo_url text,
    ADD COLUMN IF NOT EXISTS banner_url text,
    ADD COLUMN IF NOT EXISTS status public.team_lifecycle_state not null default 'Draft',
    ADD COLUMN IF NOT EXISTS visibility public.team_visibility not null default 'Private',
    ADD COLUMN IF NOT EXISTS looking_for_members boolean not null default true,
    ADD COLUMN IF NOT EXISTS min_members int not null default 1,
    ADD COLUMN IF NOT EXISTS max_members int not null default 4,
    ADD COLUMN IF NOT EXISTS created_by uuid references public.users(id),
    ADD COLUMN IF NOT EXISTS created_at timestamptz not null default now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz not null default now(),
    ADD COLUMN IF NOT EXISTS archived_at timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_by uuid references public.users(id),
    ADD COLUMN IF NOT EXISTS delete_reason text;

-- 2. Alter team_members to team_memberships
DO $$ BEGIN
    ALTER TABLE public.team_members RENAME TO team_memberships;
EXCEPTION
    WHEN undefined_table THEN null;
END $$;

-- Drop old constraints and columns from team_memberships
ALTER TABLE public.team_memberships DROP CONSTRAINT IF EXISTS team_members_pkey CASCADE;
ALTER TABLE public.team_memberships DROP CONSTRAINT IF EXISTS team_members_user_id_fkey CASCADE;
ALTER TABLE public.team_memberships DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE public.team_memberships DROP COLUMN IF EXISTS event_member_id CASCADE;
ALTER TABLE public.team_memberships DROP COLUMN IF EXISTS role CASCADE;
ALTER TABLE public.team_memberships DROP COLUMN IF EXISTS status CASCADE;

-- Add new columns
ALTER TABLE public.team_memberships ADD COLUMN IF NOT EXISTS id uuid primary key default gen_random_uuid();
ALTER TABLE public.team_memberships ADD COLUMN IF NOT EXISTS event_member_id uuid references public.event_members(id) on delete cascade;
ALTER TABLE public.team_memberships ADD COLUMN IF NOT EXISTS role text not null default 'Member';
ALTER TABLE public.team_memberships ADD COLUMN IF NOT EXISTS status public.team_membership_status not null default 'Active';
ALTER TABLE public.team_memberships ADD COLUMN IF NOT EXISTS left_at timestamptz;

-- 3. Create new tables

-- Drop the old team_join_requests before recreating it
DROP TABLE IF EXISTS public.team_join_requests CASCADE;

-- team_join_requests
CREATE TABLE public.team_join_requests (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references public.teams(id) on delete cascade,
    event_member_id uuid not null references public.event_members(id) on delete cascade,
    message text,
    status public.join_request_status not null default 'Pending',
    expires_at timestamptz,
    review_reason text,
    reviewed_by uuid references public.users(id),
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    deleted_at timestamptz,
    deleted_by uuid references public.users(id),
    delete_reason text
);

-- team_invitations
CREATE TABLE public.team_invitations (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references public.teams(id) on delete cascade,
    event_member_id uuid not null references public.event_members(id) on delete cascade,
    invited_by uuid not null references public.users(id),
    message text,
    status public.team_invitation_status not null default 'Pending',
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    deleted_at timestamptz,
    deleted_by uuid references public.users(id),
    delete_reason text
);

-- team_roles_needed
CREATE TABLE public.team_roles_needed (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references public.teams(id) on delete cascade,
    role_name text not null,
    skill_id uuid references public.skills(id),
    quantity int not null default 1,
    is_filled boolean not null default false,
    priority text check (priority in ('High', 'Medium', 'Low')),
    experience_level public.experience_level,
    is_required boolean not null default true,
    deleted_at timestamptz,
    deleted_by uuid references public.users(id),
    delete_reason text
);

-- tags / team_tags
CREATE TABLE public.tags (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    category text
);

CREATE TABLE public.team_tags (
    team_id uuid not null references public.teams(id) on delete cascade,
    tag_id uuid not null references public.tags(id) on delete cascade,
    primary key (team_id, tag_id)
);

-- team_activity
CREATE TABLE public.team_activity (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references public.teams(id) on delete cascade,
    actor_id uuid references public.users(id),
    entity_type text not null,
    entity_id uuid,
    action public.team_activity_action not null,
    previous_value jsonb,
    new_value jsonb,
    source public.activity_source not null default 'API',
    ip_address text,
    user_agent text,
    correlation_id text,
    request_id text,
    created_at timestamptz not null default now()
);

-- team_settings
CREATE TABLE public.team_settings (
    team_id uuid primary key references public.teams(id) on delete cascade,
    join_policy text not null default 'Invite_Only',
    default_visibility public.team_visibility not null default 'Private',
    submission_policy text not null default 'Captain_Only'
);

-- team_feature_flags
CREATE TABLE public.team_feature_flags (
    team_id uuid not null references public.teams(id) on delete cascade,
    flag text not null,
    enabled boolean not null default false,
    primary key (team_id, flag)
);

-- team_files
CREATE TABLE public.team_files (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references public.teams(id) on delete cascade,
    storage_path text not null,
    mime_type text not null,
    uploaded_by uuid not null references public.users(id),
    checksum text,
    visibility public.team_visibility not null default 'Workspace',
    name text not null,
    size bigint not null,
    version int not null default 1,
    is_latest boolean not null default true,
    status public.file_status not null default 'Uploaded',
    created_at timestamptz not null default now(),
    deleted_at timestamptz,
    deleted_by uuid references public.users(id),
    delete_reason text
);

-- team_links
CREATE TABLE public.team_links (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references public.teams(id) on delete cascade,
    type public.team_link_type not null,
    url text not null,
    sort_order int not null default 0,
    verified boolean not null default false,
    verified_at timestamptz,
    deleted_at timestamptz,
    deleted_by uuid references public.users(id),
    delete_reason text
);

-- team_match_preferences
CREATE TABLE public.team_match_preferences (
    team_id uuid primary key references public.teams(id) on delete cascade,
    preferred_timezone text,
    experience_level public.experience_level,
    availability text
);

-- team_preferred_roles
CREATE TABLE public.team_preferred_roles (
    team_id uuid not null references public.teams(id) on delete cascade,
    role text not null,
    primary key (team_id, role)
);

-- team_preferred_skills
CREATE TABLE public.team_preferred_skills (
    team_id uuid not null references public.teams(id) on delete cascade,
    skill_id uuid not null references public.skills(id) on delete cascade,
    primary key (team_id, skill_id)
);

-- team_preferred_languages
CREATE TABLE public.team_preferred_languages (
    team_id uuid not null references public.teams(id) on delete cascade,
    language_code text not null,
    primary key (team_id, language_code)
);
