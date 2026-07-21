-- Performance indexes for high-frequency query patterns
-- Generated from query audit — each index justified below

-- event_members: most-queried join pattern (event + user lookup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_members_event_user
  ON public.event_members (event_id, user_id);

-- event_members: role-filtered lookups (judge count, organizer checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_members_event_role
  ON public.event_members (event_id, role);

-- event_members: pending approval queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_members_event_status
  ON public.event_members (event_id, status) WHERE status = 'pending';

-- team_members: per-event team membership
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_team_id
  ON public.team_members (team_id, user_id);

-- submissions: per-event submission list
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_event_status
  ON public.submissions (event_id, status);

-- evaluations: per-submission evaluation lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evaluations_submission_judge
  ON public.evaluations (submission_id, judge_id);

-- wallets: verification check (used on every page load in app layout)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_user_verified
  ON public.wallets (user_id, verification_status) WHERE verification_status = 'Verified';

-- disputes: open dispute check for disbursement blocking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disputes_event_state
  ON public.disputes (event_id, state) WHERE state IN ('Open', 'UnderReview');

-- winners: per-event winner list
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_winners_event_disbursement
  ON public.winners (event_id, disbursement_status);
