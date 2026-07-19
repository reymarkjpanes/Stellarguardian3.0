-- Migration: extensions
-- Enables Postgres extensions required by later migrations.
-- Requirements: 2.1, 2.2

-- uuid-ossp / pgcrypto provide gen_random_uuid(); pgcrypto is bundled with
-- Supabase Postgres images and is the recommended source for gen_random_uuid().
create extension if not exists "pgcrypto";

-- pg_trgm is not required by the current schema but is commonly needed
-- alongside full-text search trigram lookups; omitted intentionally to keep
-- this migration minimal and scoped to what Data Models requires.
-- Migration: users_and_wallets
-- Tables: users, wallets, wallet_challenges
-- Requirements: 2.2, 2.4, 2.7, 5.1, 5.5, 5.6, 25, 33.15, 34.1
--
-- `users` extends Supabase `auth.users` (design.md Core Tables: users). RLS
-- and append-only/permission enforcement are added in task 3.3.

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  email text not null,
  deactivated_at timestamptz,
  terms_accepted_version text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.users is
  'Public profile fields extending auth.users (Req 34.1 terms acceptance).';

-- wallets — Req 5, 25, 33.15
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  public_key text not null check (public_key ~ '^G[A-Z2-7]{55}$'),
  provider text not null check (char_length(provider) > 0),
  verification_status text not null default 'Unverified'
    check (verification_status in ('Unverified', 'Pending', 'Verified')),
  verified_at timestamptz,
  network_mode text not null check (network_mode in ('testnet', 'mainnet')),
  constraint wallets_user_public_key_unique unique (user_id, public_key)
);

create index idx_wallets_user_id on public.wallets (user_id);

comment on table public.wallets is
  'Wallet ownership records; promoted to Verified only via completed challenge-response (Req 5.6).';

-- wallet_challenges — Req 5.1, 5.5
create table public.wallet_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  claimed_public_key text not null check (claimed_public_key ~ '^G[A-Z2-7]{55}$'),
  nonce bytea not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_wallet_challenges_user_id on public.wallet_challenges (user_id);
create index idx_wallet_challenges_expires_at on public.wallet_challenges (expires_at);

comment on table public.wallet_challenges is
  '32-byte nonce challenges with a 5-minute expiry window (Req 5.1, 5.5).';
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
-- to_tsvector is STABLE (not IMMUTABLE) so we use a trigger-maintained column.
alter table public.events add column if not exists fts tsvector;

create index idx_events_fulltext on public.events using gin (fts);

create or replace function public.events_fts_update()
returns trigger
language plpgsql as $$
begin
  new.fts := to_tsvector('english', coalesce(new.title, '') || ' ' || coalesce(new.description, '') || ' ' || coalesce(array_to_string(new.tags, ' '), ''));
  return new;
end;
$$;

create trigger trg_events_fts
  before insert or update of title, description, tags on public.events
  for each row execute function public.events_fts_update();

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
-- Migration: escrow_and_transactions
-- Tables: escrow_accounts, transactions
-- Requirements: 2.2, 2.4, 2.7, 4, 8, 9, 19.1, 25.7, 26

-- escrow_accounts — Req 4, 26
-- state CHECK mirrors the 9 canonical EscrowState values in
-- web/types/enums.ts (EscrowStateSchema) exactly.
create table public.escrow_accounts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete restrict,
  stellar_public_key text not null check (stellar_public_key ~ '^G[A-Z2-7]{55}$'),
  encrypted_secret_key bytea not null,
  state text not null default 'PendingFunding' check (
    state in (
      'PendingFunding',
      'PartiallyFunded',
      'FullyFunded',
      'Locked',
      'PendingRelease',
      'Released',
      'Refunded',
      'Failed',
      'Cancelled'
    )
  ),
  expected_balance numeric not null default 0 check (expected_balance >= 0),
  last_reconciled_balance numeric check (last_reconciled_balance is null or last_reconciled_balance >= 0),
  last_reconciled_block bigint,
  funding_wallet text check (funding_wallet is null or funding_wallet ~ '^G[A-Z2-7]{55}$'),
  inconsistent boolean not null default false,
  version int not null default 0
);

create index idx_escrow_accounts_event_id on public.escrow_accounts (event_id);
create index idx_escrow_accounts_state on public.escrow_accounts (state);

comment on table public.escrow_accounts is
  'Per-event escrow keypair; only the public key is queryable via API (Req 4.2). Secret key is KMS-envelope-encrypted and never exposed to read APIs.';
comment on column public.escrow_accounts.encrypted_secret_key is
  'KMS-envelope-encrypted secret key. Deny-by-default RLS is added in task 3.3; never selected by client-facing views.';

-- transactions — Req 4.4, 9.3, 25.7
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  escrow_id uuid references public.escrow_accounts (id) on delete set null,
  type text not null check (type in ('fund', 'disbursement', 'refund', 'escrow_op')),
  tx_hash text not null unique,
  amount numeric not null check (amount >= 0),
  from_address text not null check (from_address ~ '^G[A-Z2-7]{55}$'),
  to_address text not null check (to_address ~ '^G[A-Z2-7]{55}$'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  network_mode text not null check (network_mode in ('testnet', 'mainnet')),
  created_at timestamptz not null default now()
);

create index idx_transactions_event_id on public.transactions (event_id);

comment on table public.transactions is
  'On-chain tx_hash is the canonical funding/disbursement/refund reference (Req 4.4).';
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
-- Migration: evaluations_and_winners
-- Tables: evaluations, winners
-- Requirements: 2.2, 2.4, 2.7, 8, 11, 19.1

-- evaluations — Req 11
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  judge_id uuid not null references public.users (id) on delete restrict,
  scores jsonb not null,
  conflict_of_interest boolean not null default false,
  created_at timestamptz not null default now(),
  constraint evaluations_unique_submission_judge unique (submission_id, judge_id)
);

create index idx_evaluations_submission_id on public.evaluations (submission_id);
create index idx_evaluations_judge_id on public.evaluations (judge_id);

comment on column public.evaluations.conflict_of_interest is
  'Excluded from averages when true (Req 11.4).';

-- winners — Req 8
create table public.winners (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  recipient_id uuid not null references public.users (id) on delete restrict,
  team_id uuid references public.teams (id) on delete set null,
  prize_amount numeric not null check (prize_amount >= 0),
  disbursement_tx_hash text,
  status text not null default 'pending' check (status in ('pending', 'disbursed', 'held', 'skipped')),
  version int not null default 0
);

create index idx_winners_event_id on public.winners (event_id);
create index idx_winners_recipient_id on public.winners (recipient_id);
-- Migration: disputes
-- Tables: disputes, dispute_evidence
-- Requirements: 2.2, 2.4, 2.7, 7, 19.1, 30.6, 39

-- disputes — Req 7, 39
-- state CHECK mirrors the 5 canonical DisputeState values in
-- web/types/enums.ts (DisputeStateSchema) exactly.
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  filer_id uuid not null references public.users (id) on delete restrict,
  state text not null default 'Open' check (state in ('Open', 'UnderReview', 'Upheld', 'Dismissed', 'Withdrawn')),
  reason text not null check (char_length(reason) between 1 and 5000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  version int not null default 0
);

create index idx_disputes_event_id on public.disputes (event_id);
create index idx_disputes_state on public.disputes (state);

-- dispute_evidence — Req 30.6
create table public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  storage_path text not null check (char_length(storage_path) > 0),
  mime_type text not null check (char_length(mime_type) > 0),
  size_bytes bigint not null check (size_bytes >= 0)
);

create index idx_dispute_evidence_dispute_id on public.dispute_evidence (dispute_id);
-- Migration: idempotency_and_audit
-- Tables: idempotency_keys, audit_records
-- Requirements: 2.2, 2.4, 2.7, 13, 19.1, 28, 31
--
-- Append-only enforcement (no UPDATE/DELETE grants + BEFORE UPDATE/DELETE
-- triggers) for audit_records is added in task 3.3 alongside RLS policies.
-- This migration only establishes table shape, constraints, and indexes.

-- idempotency_keys — Req 13
create table public.idempotency_keys (
  key text primary key check (char_length(key) between 1 and 255),
  endpoint text not null check (char_length(endpoint) > 0),
  request_hash text not null check (char_length(request_hash) > 0),
  response_payload jsonb,
  status_code int not null check (status_code between 100 and 599),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index idx_idempotency_keys_expires_at on public.idempotency_keys (expires_at);

comment on table public.idempotency_keys is
  'Primary key on key provides the DB unique constraint required to insert-before-execute (Req 13.5). expires_at = created_at + 24h (Req 13.3).';

-- audit_records — Req 28, 31 (append-only; enforcement added in task 3.3)
create table public.audit_records (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users (id) on delete set null,
  actor_name text,
  occurred_at timestamptz(3) not null default now(),
  action_type text not null check (char_length(action_type) > 0),
  target_type text not null check (char_length(target_type) > 0),
  target_id text not null check (char_length(target_id) > 0),
  wallet_address text,
  tx_hash text,
  before_state jsonb,
  after_state jsonb,
  reason text,
  request_meta jsonb,
  onchain_status text
);

create index idx_audit_records_actor_id on public.audit_records (actor_id);
create index idx_audit_records_action_type on public.audit_records (action_type);
create index idx_audit_records_target_id on public.audit_records (target_id);
create index idx_audit_records_occurred_at on public.audit_records (occurred_at);

comment on table public.audit_records is
  'Immutable action log (Req 31.1-31.2). No UPDATE/DELETE grants and BEFORE UPDATE/DELETE triggers are added in task 3.3.';
-- Migration: notifications
-- Tables: notifications, notification_preferences
-- Requirements: 2.2, 2.4, 2.5, 2.7, 16, 19.1, 28
--
-- Adding these tables to the supabase_realtime publication (Req 2.5, 28.2)
-- is a deploy-time/RLS-adjacent concern handled alongside task 3.3, which
-- also configures the publication for events and teams.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  category text not null check (char_length(category) > 0),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  priority text not null default 'normal' check (priority in ('urgent', 'normal')),
  created_at timestamptz not null default now()
);

create index idx_notifications_user_id on public.notifications (user_id);
create index idx_notifications_created_at on public.notifications (created_at);

create table public.notification_preferences (
  user_id uuid not null references public.users (id) on delete cascade,
  category text not null check (char_length(category) > 0),
  email_enabled boolean not null default true,
  primary key (user_id, category)
);
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
-- Migration: schema_alignment
-- Aligns table schemas with the service-layer code.
-- This fixes column name mismatches between the original schema design
-- and the implemented service layer.

-- ============================================================================
-- audit_records — Align with lib/services/audit.ts
-- ============================================================================
alter table public.audit_records rename column action_type to action;
alter table public.audit_records rename column target_type to resource_type;
alter table public.audit_records rename column target_id to resource_id;
alter table public.audit_records rename column occurred_at to created_at;
alter table public.audit_records rename column onchain_status to on_chain_status;

-- Add missing columns
alter table public.audit_records add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.audit_records add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.audit_records add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.audit_records add column if not exists amount text;

-- Drop columns that are no longer needed (merged into metadata)
alter table public.audit_records drop column if exists before_state;
alter table public.audit_records drop column if exists after_state;
alter table public.audit_records drop column if exists reason;
alter table public.audit_records drop column if exists request_meta;
alter table public.audit_records drop column if exists actor_name;

-- Add indexes for new columns
create index if not exists idx_audit_records_event_id on public.audit_records (event_id);
create index if not exists idx_audit_records_workspace_id on public.audit_records (workspace_id);

-- ============================================================================
-- notifications — Align with lib/services/notification.ts
-- ============================================================================
-- Replace the jsonb payload approach with explicit columns
alter table public.notifications add column if not exists title text not null default '';
alter table public.notifications add column if not exists body text not null default '';
alter table public.notifications add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.notifications add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.notifications add column if not exists action_url text;
alter table public.notifications add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.notifications add column if not exists read boolean not null default false;
alter table public.notifications add column if not exists email_sent boolean not null default false;

-- Drop the old payload column (data now in explicit columns)
alter table public.notifications drop column if exists payload;

-- Add index for unread notifications
create index if not exists idx_notifications_user_unread on public.notifications (user_id) where read = false;

-- ============================================================================
-- idempotency_keys — Align with lib/services/idempotency.ts
-- ============================================================================
-- The service uses a different schema. Drop and recreate.
drop table if exists public.idempotency_keys;

create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  request_hash text not null,
  response_body jsonb,
  response_status int,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint idempotency_keys_user_key_unique unique (user_id, key)
);

create index idx_idempotency_keys_expires_at on public.idempotency_keys (expires_at);
create index idx_idempotency_keys_user_id on public.idempotency_keys (user_id);

-- ============================================================================
-- disputes — Align with lib/services/dispute.ts
-- ============================================================================
alter table public.disputes rename column filer_id to filed_by;
alter table public.disputes rename column reason to description;
alter table public.disputes add column if not exists title text not null default '';
alter table public.disputes add column if not exists resolved_by uuid references public.users(id) on delete set null;
alter table public.disputes add column if not exists resolution text;

-- ============================================================================
-- winners — Align with lib/services/escrow.ts (disbursement)
-- ============================================================================
alter table public.winners rename column status to disbursement_status;

-- ============================================================================
-- invitations — Add workspace_id reference for RLS
-- ============================================================================
alter table public.invitations add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

-- Backfill workspace_id from scope_id where scope = 'workspace'
update public.invitations set workspace_id = scope_id::uuid where scope = 'workspace' and workspace_id is null;
