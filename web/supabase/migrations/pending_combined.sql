-- ============================================================================
-- Stellar Guardian 3.0 — Pending Migrations (Combined, Idempotent)
-- 
-- Paste this entire file into the Supabase SQL Editor and click Run:
-- https://supabase.com/dashboard/project/zlkqzsgpagupkgnqkapk/sql/new
--
-- Safe to run multiple times — all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Extend Users table with profile fields
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url        text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio               text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS timezone          text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS country           text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city              text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferred_language text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Skills dictionary + user_skills junction
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.skills (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name     text NOT NULL UNIQUE CHECK (char_length(name) > 0),
  category text NOT NULL DEFAULT 'General'
);

CREATE TABLE IF NOT EXISTS public.user_skills (
  user_id          uuid NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  skill_id         uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  level            int  NOT NULL DEFAULT 3 CHECK (level BETWEEN 1 AND 5),
  experience_level text DEFAULT 'Mid',
  years_experience numeric(4,1),
  PRIMARY KEY (user_id, skill_id)
);

-- Add experience_level if the table existed without it
ALTER TABLE public.user_skills ADD COLUMN IF NOT EXISTS experience_level text DEFAULT 'Mid';


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Social links & presence
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_links (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type    text NOT NULL,
  url     text NOT NULL,
  CONSTRAINT user_links_user_type_key UNIQUE (user_id, type)
);

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id    uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'Offline' CHECK (status IN ('Online','Away','Offline')),
  device     text NOT NULL DEFAULT 'web'     CHECK (device IN ('web','mobile','desktop')),
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Evaluation criteria (configurable judging rubrics)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluation_criteria (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid    NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        text    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description text    NOT NULL DEFAULT '',
  max_score   int     NOT NULL DEFAULT 25  CHECK (max_score > 0),
  weight      numeric NOT NULL DEFAULT 1.0 CHECK (weight > 0),
  sort_order  int     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evaluation_criteria_event
  ON public.evaluation_criteria (event_id, sort_order);


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Rubrics (JSONB-based shorthand per event)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rubrics (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE UNIQUE,
  title      text NOT NULL DEFAULT 'Judging Rubric',
  criteria   jsonb NOT NULL DEFAULT '[]',
  max_score  int  NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Team join requests
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_join_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES public.teams(id)  ON DELETE CASCADE,
  event_id    uuid REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','accepted','rejected')),
  message     text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS team_join_requests_pending_unique
  ON public.team_join_requests (team_id, user_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_team_join_requests_team
  ON public.team_join_requests (team_id, status);
CREATE INDEX IF NOT EXISTS idx_team_join_requests_user
  ON public.team_join_requests (user_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 7. Team invitations (rich per-user invite table)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         uuid NOT NULL REFERENCES public.teams(id)  ON DELETE CASCADE,
  event_id        uuid REFERENCES public.events(id) ON DELETE CASCADE,
  invited_by      uuid REFERENCES public.users(id),
  inviter_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  invitee_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  message         text,
  status          text NOT NULL DEFAULT 'Pending'
                    CHECK (status IN ('Pending','Accepted','Declined','Cancelled',
                                      'pending','accepted','declined','cancelled')),
  inviter_role    text DEFAULT 'Captain'
                    CHECK (inviter_role IN ('Captain','Member')),
  expires_at      timestamptz,
  responded_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  deleted_by      uuid REFERENCES public.users(id),
  delete_reason   text
);

CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_pending_unique
  ON public.team_invitations (team_id, invitee_user_id)
  WHERE (status = 'pending' OR status = 'Pending');

CREATE INDEX IF NOT EXISTS idx_team_invitations_invitee
  ON public.team_invitations (invitee_user_id, event_id, status);

CREATE INDEX IF NOT EXISTS idx_team_invitations_team_status
  ON public.team_invitations (team_id, status);


-- ────────────────────────────────────────────────────────────────────────────
-- 8. Audit logs
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_id     uuid REFERENCES public.events(id)     ON DELETE CASCADE,
  actor_id     uuid REFERENCES public.users(id)      ON DELETE SET NULL,
  target_type  text NOT NULL,
  target_id    uuid,
  action       text NOT NULL,
  old_value    jsonb,
  new_value    jsonb,
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event     ON public.audit_logs (event_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace ON public.audit_logs (workspace_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 9. User reputation / activity / badges shell tables
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_reputation (
  user_id              uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  projects_completed   int DEFAULT 0,
  wins                 int DEFAULT 0,
  hackathons_attended  int DEFAULT 0,
  mentoring_hours      numeric(6,2) DEFAULT 0,
  reviews_completed    int DEFAULT 0,
  trust_score          int DEFAULT 100,
  contribution_score   int DEFAULT 0,
  updated_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_activity (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES public.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES public.users(id) ON DELETE CASCADE,
  badge_name text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now()
);


-- ────────────────────────────────────────────────────────────────────────────
-- 10. Fix invitations table (rename scope → type, scope_id → target_id if needed)
-- ────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'invitations'
      AND column_name  = 'scope'
  ) THEN
    ALTER TABLE public.invitations RENAME COLUMN scope TO type;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'invitations'
      AND column_name  = 'scope_id'
  ) THEN
    ALTER TABLE public.invitations RENAME COLUMN scope_id TO target_id;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS payload jsonb;

-- Drop old check constraint and re-add with correct column name
ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_scope_check;
ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_type_check;
ALTER TABLE public.invitations ADD CONSTRAINT invitations_type_check
  CHECK (type IN ('workspace','event','team','judge_assignment','mentor_assignment'));


-- ============================================================================
-- Done!
-- After running, go back to the terminal and run:
--   npx tsx scripts/seed-demo.ts
--   npx tsx scripts/verify-seed.ts
-- ============================================================================
