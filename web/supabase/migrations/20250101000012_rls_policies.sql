-- Migration: rls_policies
-- Enables RLS on every table and adds policies mirroring the permission matrix.
-- Requirements: 2.3, 2.5, 27.10, 31.3, 31.8
--
-- Uses (select auth.uid()) for planner caching (per Supabase best practices).
-- Append-only enforcement for audit_records via BEFORE triggers.

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================
alter table public.users enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_challenges enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.escrow_accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_versions enable row level security;
alter table public.submission_files enable row level security;
alter table public.evaluations enable row level security;
alter table public.winners enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_evidence enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.audit_records enable row level security;
alter table public.notifications enable row level security;
alter table public.sponsors enable row level security;
alter table public.milestones enable row level security;
alter table public.invitations enable row level security;
alter table public.legal_acceptances enable row level security;

-- ============================================================================
-- users
-- ============================================================================
create policy "users_select_own" on public.users
  for select using ((select auth.uid()) = id);

create policy "users_select_public" on public.users
  for select using (deactivated_at is null);

create policy "users_update_own" on public.users
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ============================================================================
-- wallets
-- ============================================================================
create policy "wallets_select_own" on public.wallets
  for select using ((select auth.uid()) = user_id);

create policy "wallets_insert_own" on public.wallets
  for insert with check ((select auth.uid()) = user_id);

create policy "wallets_update_own" on public.wallets
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "wallets_delete_own" on public.wallets
  for delete using ((select auth.uid()) = user_id);

-- ============================================================================
-- wallet_challenges
-- ============================================================================
create policy "wallet_challenges_select_own" on public.wallet_challenges
  for select using ((select auth.uid()) = user_id);

create policy "wallet_challenges_insert_own" on public.wallet_challenges
  for insert with check ((select auth.uid()) = user_id);

-- ============================================================================
-- workspaces
-- ============================================================================
create policy "workspaces_select_member" on public.workspaces
  for select using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = id and wm.user_id = (select auth.uid())
    )
  );

create policy "workspaces_insert_authenticated" on public.workspaces
  for insert with check ((select auth.uid()) is not null);

create policy "workspaces_update_admin" on public.workspaces
  for update using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = id
        and wm.user_id = (select auth.uid())
        and wm.role in ('Owner', 'Admin')
    )
  );

create policy "workspaces_delete_owner" on public.workspaces
  for delete using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = id
        and wm.user_id = (select auth.uid())
        and wm.role = 'Owner'
    )
  );

-- ============================================================================
-- workspace_members
-- ============================================================================
create policy "workspace_members_select" on public.workspace_members
  for select using (
    exists (
      select 1 from public.workspace_members wm2
      where wm2.workspace_id = workspace_id and wm2.user_id = (select auth.uid())
    )
  );

create policy "workspace_members_insert_admin" on public.workspace_members
  for insert with check (
    exists (
      select 1 from public.workspace_members wm2
      where wm2.workspace_id = workspace_id
        and wm2.user_id = (select auth.uid())
        and wm2.role in ('Owner', 'Admin')
    )
  );

create policy "workspace_members_update_admin" on public.workspace_members
  for update using (
    exists (
      select 1 from public.workspace_members wm2
      where wm2.workspace_id = workspace_id
        and wm2.user_id = (select auth.uid())
        and wm2.role in ('Owner', 'Admin')
    )
  );

create policy "workspace_members_delete_admin" on public.workspace_members
  for delete using (
    exists (
      select 1 from public.workspace_members wm2
      where wm2.workspace_id = workspace_id
        and wm2.user_id = (select auth.uid())
        and wm2.role in ('Owner', 'Admin')
    )
  );

-- ============================================================================
-- events
-- ============================================================================
-- Public non-draft events are readable by everyone (discovery, Req 37)
create policy "events_select_public" on public.events
  for select using (
    state not in ('Draft')
    or organizer_id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = events.workspace_id and wm.user_id = (select auth.uid())
    )
  );

create policy "events_insert_member" on public.events
  for insert with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id and wm.user_id = (select auth.uid())
    )
  );

create policy "events_update_organizer" on public.events
  for update using (
    organizer_id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = events.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role in ('Owner', 'Admin')
    )
  );

create policy "events_delete_organizer" on public.events
  for delete using (
    organizer_id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = events.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role = 'Owner'
    )
  );

-- ============================================================================
-- event_members
-- ============================================================================
create policy "event_members_select" on public.event_members
  for select using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.events e
      where e.id = event_id and (
        e.organizer_id = (select auth.uid())
        or exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = e.workspace_id and wm.user_id = (select auth.uid())
        )
      )
    )
  );

create policy "event_members_insert" on public.event_members
  for insert with check (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.events e
      where e.id = event_id and (
        e.organizer_id = (select auth.uid())
        or exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = e.workspace_id
            and wm.user_id = (select auth.uid())
            and wm.role in ('Owner', 'Admin')
        )
      )
    )
  );

create policy "event_members_delete" on public.event_members
  for delete using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.events e
      where e.id = event_id and (
        e.organizer_id = (select auth.uid())
        or exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = e.workspace_id
            and wm.user_id = (select auth.uid())
            and wm.role in ('Owner', 'Admin')
        )
      )
    )
  );

-- ============================================================================
-- escrow_accounts — deny-by-default modification for secret data
-- ============================================================================
create policy "escrow_accounts_select" on public.escrow_accounts
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_id and (
        e.organizer_id = (select auth.uid())
        or exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = e.workspace_id and wm.user_id = (select auth.uid())
        )
      )
    )
  );

-- No insert/update/delete policies for escrow via RLS — only the service-role client can modify

-- ============================================================================
-- transactions
-- ============================================================================
create policy "transactions_select" on public.transactions
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_id and (
        e.organizer_id = (select auth.uid())
        or exists (
          select 1 from public.event_members em
          where em.event_id = e.id and em.user_id = (select auth.uid())
        )
      )
    )
  );

-- ============================================================================
-- teams
-- ============================================================================
create policy "teams_select" on public.teams
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_id and (
        e.state not in ('Draft')
        or e.organizer_id = (select auth.uid())
      )
    )
  );

create policy "teams_insert" on public.teams
  for insert with check (
    captain_id = (select auth.uid())
  );

create policy "teams_update_captain" on public.teams
  for update using (captain_id = (select auth.uid()));

create policy "teams_delete_captain" on public.teams
  for delete using (captain_id = (select auth.uid()));

-- ============================================================================
-- team_members
-- ============================================================================
create policy "team_members_select" on public.team_members
  for select using (
    exists (
      select 1 from public.teams t
      join public.events e on e.id = t.event_id
      where t.id = team_id and e.state not in ('Draft')
    )
  );

create policy "team_members_insert_captain" on public.team_members
  for insert with check (
    exists (
      select 1 from public.teams t
      where t.id = team_id and t.captain_id = (select auth.uid())
    )
    or user_id = (select auth.uid())
  );

create policy "team_members_delete" on public.team_members
  for delete using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.teams t
      where t.id = team_id and t.captain_id = (select auth.uid())
    )
  );

-- ============================================================================
-- submissions
-- ============================================================================
create policy "submissions_select_visible" on public.submissions
  for select using (
    -- Draft submissions are visible only to the submitter / team members
    status = 'Submitted'
    or submitter_id = (select auth.uid())
    or exists (
      select 1 from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where t.id = submissions.team_id and tm.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.organizer_id = (select auth.uid())
    )
  );

create policy "submissions_insert" on public.submissions
  for insert with check (
    submitter_id = (select auth.uid())
  );

create policy "submissions_update_owner" on public.submissions
  for update using (
    submitter_id = (select auth.uid())
    or exists (
      select 1 from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where t.id = submissions.team_id and tm.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- submission_versions (append-only via service client)
-- ============================================================================
create policy "submission_versions_select" on public.submission_versions
  for select using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_id and (
        s.submitter_id = (select auth.uid())
        or s.status = 'Submitted'
      )
    )
  );

-- ============================================================================
-- submission_files
-- ============================================================================
create policy "submission_files_select" on public.submission_files
  for select using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_id and (
        s.submitter_id = (select auth.uid())
        or s.status = 'Submitted'
      )
    )
  );

-- ============================================================================
-- evaluations
-- ============================================================================
create policy "evaluations_select" on public.evaluations
  for select using (
    judge_id = (select auth.uid())
    or exists (
      select 1 from public.submissions s
      join public.events e on e.id = s.event_id
      where s.id = submission_id and (
        e.organizer_id = (select auth.uid())
        or exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = e.workspace_id and wm.user_id = (select auth.uid())
        )
      )
    )
  );

create policy "evaluations_insert_judge" on public.evaluations
  for insert with check (judge_id = (select auth.uid()));

create policy "evaluations_update_judge" on public.evaluations
  for update using (judge_id = (select auth.uid()));

-- ============================================================================
-- winners (read-only for non-admins)
-- ============================================================================
create policy "winners_select" on public.winners
  for select using (
    recipient_id = (select auth.uid())
    or exists (
      select 1 from public.events e
      where e.id = event_id and (
        e.organizer_id = (select auth.uid())
        or exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = e.workspace_id and wm.user_id = (select auth.uid())
        )
      )
    )
  );

-- ============================================================================
-- disputes
-- ============================================================================
create policy "disputes_select" on public.disputes
  for select using (
    filed_by = (select auth.uid())
    or exists (
      select 1 from public.events e
      where e.id = event_id and (
        e.organizer_id = (select auth.uid())
        or exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = e.workspace_id and wm.user_id = (select auth.uid())
        )
      )
    )
  );

create policy "disputes_insert" on public.disputes
  for insert with check (filed_by = (select auth.uid()));

-- ============================================================================
-- dispute_evidence
-- ============================================================================
create policy "dispute_evidence_select" on public.dispute_evidence
  for select using (
    exists (
      select 1 from public.disputes d
      where d.id = dispute_id and (
        d.filed_by = (select auth.uid())
        or exists (
          select 1 from public.events e
          where e.id = d.event_id and e.organizer_id = (select auth.uid())
        )
      )
    )
  );

-- ============================================================================
-- idempotency_keys (service client only for writes; reads for debugging)
-- ============================================================================
create policy "idempotency_keys_select_own" on public.idempotency_keys
  for select using (user_id = (select auth.uid()));

-- ============================================================================
-- audit_records — APPEND-ONLY enforcement (Req 31.3, 31.8)
-- No UPDATE or DELETE grants via RLS; trigger blocks modifications.
-- ============================================================================
create policy "audit_records_select" on public.audit_records
  for select using (
    actor_id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members wm
      join public.events e on e.workspace_id = wm.workspace_id
      where e.id = audit_records.event_id
        and wm.user_id = (select auth.uid())
        and wm.role in ('Owner', 'Admin')
    )
  );

-- Append-only trigger: block UPDATE and DELETE on audit_records
create or replace function public.audit_records_immutable()
returns trigger as $$
begin
  raise exception 'audit_records are immutable — UPDATE and DELETE are forbidden (Req 31.3, 31.8)';
  return null;
end;
$$ language plpgsql;

drop trigger if exists audit_records_no_update on public.audit_records;
create trigger audit_records_no_update
  before update on public.audit_records
  for each row execute function public.audit_records_immutable();

drop trigger if exists audit_records_no_delete on public.audit_records;
create trigger audit_records_no_delete
  before delete on public.audit_records
  for each row execute function public.audit_records_immutable();

-- ============================================================================
-- notifications
-- ============================================================================
create policy "notifications_select_own" on public.notifications
  for select using (user_id = (select auth.uid()));

create policy "notifications_update_own" on public.notifications
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ============================================================================
-- sponsors
-- ============================================================================
create policy "sponsors_select" on public.sponsors
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.state not in ('Draft')
    )
    or exists (
      select 1 from public.events e
      join public.workspace_members wm on wm.workspace_id = e.workspace_id
      where e.id = event_id and wm.user_id = (select auth.uid())
    )
  );

create policy "sponsors_insert" on public.sponsors
  for insert with check (
    exists (
      select 1 from public.events e
      where e.id = event_id and (
        e.organizer_id = (select auth.uid())
        or exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = e.workspace_id
            and wm.user_id = (select auth.uid())
            and wm.role in ('Owner', 'Admin')
        )
      )
    )
  );

create policy "sponsors_update" on public.sponsors
  for update using (
    exists (
      select 1 from public.events e
      where e.id = event_id and (
        e.organizer_id = (select auth.uid())
        or exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = e.workspace_id
            and wm.user_id = (select auth.uid())
            and wm.role in ('Owner', 'Admin')
        )
      )
    )
  );

create policy "sponsors_delete" on public.sponsors
  for delete using (
    exists (
      select 1 from public.events e
      where e.id = event_id and (
        e.organizer_id = (select auth.uid())
        or exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = e.workspace_id
            and wm.user_id = (select auth.uid())
            and wm.role in ('Owner', 'Admin')
        )
      )
    )
  );

-- ============================================================================
-- milestones
-- ============================================================================
create policy "milestones_select" on public.milestones
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.state not in ('Draft')
    )
    or exists (
      select 1 from public.events e
      join public.workspace_members wm on wm.workspace_id = e.workspace_id
      where e.id = event_id and wm.user_id = (select auth.uid())
    )
  );

create policy "milestones_insert" on public.milestones
  for insert with check (
    exists (
      select 1 from public.events e
      where e.id = event_id and (
        e.organizer_id = (select auth.uid())
        or exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = e.workspace_id
            and wm.user_id = (select auth.uid())
            and wm.role in ('Owner', 'Admin')
        )
      )
    )
  );

create policy "milestones_update" on public.milestones
  for update using (
    exists (
      select 1 from public.events e
      where e.id = event_id and (
        e.organizer_id = (select auth.uid())
        or exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = e.workspace_id
            and wm.user_id = (select auth.uid())
            and wm.role in ('Owner', 'Admin')
        )
      )
    )
  );

create policy "milestones_delete" on public.milestones
  for delete using (
    exists (
      select 1 from public.events e
      where e.id = event_id and (
        e.organizer_id = (select auth.uid())
        or exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = e.workspace_id
            and wm.user_id = (select auth.uid())
            and wm.role in ('Owner', 'Admin')
        )
      )
    )
  );

-- ============================================================================
-- invitations
-- ============================================================================
create policy "invitations_select" on public.invitations
  for select using (
    invitee_email = (select auth.email())
    or inviter_id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = invitations.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role in ('Owner', 'Admin')
    )
  );

create policy "invitations_insert" on public.invitations
  for insert with check (
    inviter_id = (select auth.uid())
  );

create policy "invitations_delete" on public.invitations
  for delete using (
    inviter_id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = invitations.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role in ('Owner', 'Admin')
    )
  );

-- ============================================================================
-- legal_acceptances
-- ============================================================================
create policy "legal_acceptances_select_own" on public.legal_acceptances
  for select using (user_id = (select auth.uid()));

create policy "legal_acceptances_insert_own" on public.legal_acceptances
  for insert with check (user_id = (select auth.uid()));

-- ============================================================================
-- REALTIME PUBLICATION (Req 2.5)
-- Add tables to supabase_realtime publication for realtime subscriptions.
-- ============================================================================
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.teams;
