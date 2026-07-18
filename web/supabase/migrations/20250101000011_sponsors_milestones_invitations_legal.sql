-- Migration: sponsors_milestones_invitations_legal
-- Tables: sponsors, milestones, invitations, legal_acceptances
-- Requirements: 2.2, 2.4, 2.7, 10.3, 19.1, 21, 24.4, 34

-- sponsors / milestones — Req 21
create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  logo_url text,
  tier text not null check (tier in ('Gold', 'Silver', 'Bronze'))
);

create index idx_sponsors_event_id on public.sponsors (event_id);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  date timestamptz not null,
  description text check (description is null or char_length(description) <= 2000)
);

create index idx_milestones_event_id on public.milestones (event_id);

-- invitations — Req 10.3, 24.4
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('workspace', 'team')),
  scope_id uuid not null,
  inviter_id uuid not null references public.users (id) on delete restrict,
  invitee_email text not null,
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_invitations_scope on public.invitations (scope, scope_id);
create index idx_invitations_invitee_email on public.invitations (invitee_email);

comment on column public.invitations.scope_id is
  'References workspaces.id when scope = ''workspace'' or teams.id when scope = ''team''. Polymorphic target, so no single FK constraint applies; validated at the service layer.';

-- legal_acceptances — Req 34
create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  document_type text not null check (char_length(document_type) > 0),
  document_version text not null check (char_length(document_version) > 0),
  accepted_at timestamptz not null default now()
);

create index idx_legal_acceptances_user_id on public.legal_acceptances (user_id);
create index idx_legal_acceptances_user_doc on public.legal_acceptances (user_id, document_type, document_version);
