-- Migration: workspaces
-- Tables: workspaces, workspace_members
-- Requirements: 2.2, 2.4, 2.7, 19.1, 24

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 200),
  description text check (char_length(description) <= 2000),
  logo_url text,
  settings jsonb not null default '{}'::jsonb,
  billing jsonb not null default '{"plan": "free"}'::jsonb,
  white_label jsonb not null default '{}'::jsonb,
  feature_flags jsonb not null default '{}'::jsonb,
  version int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.workspaces is
  'Organizational unit owning events; unique slug for URL routing (Req 24.10).';

-- workspace_members — Req 24.3
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('Owner', 'Admin', 'Member')),
  primary key (workspace_id, user_id)
);

create index idx_workspace_members_user_id on public.workspace_members (user_id);

-- Exactly one Owner per workspace: a partial unique index enforces "at most
-- one Owner row per workspace_id" at the database layer. The complementary
-- "at least one Owner" invariant (a workspace must always have an Owner) is
-- enforced by the workspace-creation service, which creates the Owner
-- membership row in the same transaction as the workspace itself, and by the
-- ownership-transfer flow, which reassigns Owner atomically (Req 24.2, 24.5).
create unique index workspace_members_one_owner_per_workspace
  on public.workspace_members (workspace_id)
  where role = 'Owner';
