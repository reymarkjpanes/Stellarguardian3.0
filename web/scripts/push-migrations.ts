/**
 * push-migrations.ts
 *
 * Applies all pending migrations to the remote Supabase project via the
 * Supabase Management API.
 *
 * REQUIREMENTS
 * ─────────────────────────────────────────────────────────────────────────────
 * You need a SUPABASE_ACCESS_TOKEN (personal access token) from:
 *   https://supabase.com/dashboard/account/tokens
 *
 * Add it to .env.local:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxx
 *
 * Then run:
 *   cd web && npx tsx scripts/push-migrations.ts
 *
 * Or pass it inline (no .env.local modification needed):
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx npx tsx scripts/push-migrations.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * This script applies the following migrations that are missing from the live DB:
 *   1. users: add bio, avatar_url, timezone, country, city columns
 *   2. skills + user_skills tables
 *   3. user_links + user_presence tables
 *   4. evaluation_criteria table (judging rubrics)
 *   5. team_join_requests table
 *   6. team_invitations table + user_id columns
 *   7. rubrics table (JSONB-based alternative judging config)
 *   8. invitations: rename scope→type, scope_id→target_id
 *   9. Various supporting tables (user_reputation, audit_logs, etc.)
 *
 * All statements are idempotent (uses ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS, etc.)
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? "";

// Extract project ref from URL
const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "";

if (!SUPABASE_URL || !PROJECT_REF) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}

if (!ACCESS_TOKEN) {
  console.error(`
❌  SUPABASE_ACCESS_TOKEN is not set.

To apply pending migrations, you need a personal access token:

  1. Open: https://supabase.com/dashboard/account/tokens
  2. Click "Generate new token" → name it "local-migration"
  3. Copy the token (starts with sbp_...)
  4. Add to web/.env.local:
       SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  5. Re-run: npx tsx scripts/push-migrations.ts

Alternatively, you can apply the migrations manually in the Supabase SQL Editor:
  https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new

  Run the contents of:
    web/supabase/migrations/20250101000024_module2_improvements.sql
    web/supabase/migrations/20250101000016_rubrics_join_requests_comments.sql
    web/supabase/migrations/20250101000026_team_tables.sql
    web/supabase/migrations/20250722000007_team_invitations_user_ids.sql
`);
  process.exit(1);
}

// ─── SQL Migrations (idempotent) ──────────────────────────────────────────────

const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: "01_users_profile_columns",
    sql: `
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio text;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS timezone text;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS country text;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city text;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferred_language text;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    `,
  },
  {
    name: "02_skills_tables",
    sql: `
      CREATE TABLE IF NOT EXISTS public.skills (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL UNIQUE CHECK (char_length(name) > 0),
        category text NOT NULL DEFAULT 'General' CHECK (char_length(category) > 0)
      );

      CREATE TABLE IF NOT EXISTS public.user_skills (
        user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
        level int NOT NULL DEFAULT 3 CHECK (level BETWEEN 1 AND 5),
        experience_level text DEFAULT 'Mid',
        years_experience numeric(4,1),
        PRIMARY KEY (user_id, skill_id)
      );

      ALTER TABLE public.user_skills ADD COLUMN IF NOT EXISTS experience_level text DEFAULT 'Mid';
    `,
  },
  {
    name: "03_user_links_presence",
    sql: `
      CREATE TABLE IF NOT EXISTS public.user_links (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        type text NOT NULL,
        url text NOT NULL,
        CONSTRAINT user_links_user_type_key UNIQUE (user_id, type)
      );

      CREATE TABLE IF NOT EXISTS public.user_presence (
        user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'Offline' CHECK (status IN ('Online', 'Away', 'Offline')),
        device text NOT NULL DEFAULT 'web' CHECK (device IN ('web', 'mobile', 'desktop')),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
  {
    name: "04_evaluation_criteria",
    sql: `
      CREATE TABLE IF NOT EXISTS public.evaluation_criteria (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
        description text NOT NULL DEFAULT '',
        max_score int NOT NULL DEFAULT 25 CHECK (max_score > 0),
        weight numeric NOT NULL DEFAULT 1.0 CHECK (weight > 0),
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_evaluation_criteria_event ON public.evaluation_criteria (event_id, sort_order);
    `,
  },
  {
    name: "05_team_join_requests",
    sql: `
      CREATE TABLE IF NOT EXISTS public.team_join_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
        event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
        message text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        resolved_at timestamptz,
        resolved_by uuid REFERENCES public.users(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS team_join_requests_unique ON public.team_join_requests (team_id, user_id) WHERE status = 'pending';
      CREATE INDEX IF NOT EXISTS idx_team_join_requests_team ON public.team_join_requests (team_id, status);
      CREATE INDEX IF NOT EXISTS idx_team_join_requests_user ON public.team_join_requests (user_id);
    `,
  },
  {
    name: "06_team_invitations",
    sql: `
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_invitation_status') THEN
          CREATE TYPE public.team_invitation_status AS ENUM ('Pending', 'Accepted', 'Declined', 'Cancelled', 'pending', 'accepted', 'declined', 'cancelled');
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      CREATE TABLE IF NOT EXISTS public.team_invitations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
        event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
        invited_by uuid REFERENCES public.users(id),
        inviter_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
        invitee_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
        message text,
        status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Accepted','Declined','Cancelled','pending','accepted','declined','cancelled')),
        inviter_role text DEFAULT 'Captain' CHECK (inviter_role IN ('Captain', 'Member')),
        expires_at timestamptz,
        responded_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        deleted_by uuid REFERENCES public.users(id),
        delete_reason text
      );

      CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_pending_unique
        ON public.team_invitations (team_id, invitee_user_id)
        WHERE status IN ('pending', 'Pending');

      CREATE INDEX IF NOT EXISTS idx_team_invitations_invitee
        ON public.team_invitations (invitee_user_id, event_id, status);

      CREATE INDEX IF NOT EXISTS idx_team_invitations_team_status
        ON public.team_invitations (team_id, status);
    `,
  },
  {
    name: "07_rubrics_jsonb",
    sql: `
      CREATE TABLE IF NOT EXISTS public.rubrics (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE UNIQUE,
        title text NOT NULL DEFAULT 'Judging Rubric',
        criteria jsonb NOT NULL DEFAULT '[]',
        max_score int NOT NULL DEFAULT 100,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
  {
    name: "08_audit_logs",
    sql: `
      CREATE TABLE IF NOT EXISTS public.audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
        event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
        actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
        target_type text NOT NULL,
        target_id uuid,
        action text NOT NULL,
        old_value jsonb,
        new_value jsonb,
        reason text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON public.audit_logs(event_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace ON public.audit_logs(workspace_id);
    `,
  },
  {
    name: "09_user_reputation_tables",
    sql: `
      CREATE TABLE IF NOT EXISTS public.user_reputation (
        user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
        projects_completed int DEFAULT 0,
        wins int DEFAULT 0,
        hackathons_attended int DEFAULT 0,
        mentoring_hours numeric(6,2) DEFAULT 0,
        reviews_completed int DEFAULT 0,
        trust_score int DEFAULT 100,
        contribution_score int DEFAULT 0,
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.user_activity (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
        activity_type text NOT NULL,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.user_badges (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
        badge_name text NOT NULL,
        awarded_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
  {
    name: "10_invitations_type_target_columns",
    sql: `
      -- The invitations table was originally created with scope/scope_id.
      -- Migration 24 renamed them to type/target_id. Apply if still scope/scope_id.
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'scope'
        ) THEN
          ALTER TABLE public.invitations RENAME COLUMN scope TO type;
        END IF;
      EXCEPTION WHEN others THEN NULL; END $$;

      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'scope_id'
        ) THEN
          ALTER TABLE public.invitations RENAME COLUMN scope_id TO target_id;
        END IF;
      EXCEPTION WHEN others THEN NULL; END $$;

      ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS payload jsonb;

      -- Update check constraint to use type column
      ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_scope_check;
      ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_type_check;
      ALTER TABLE public.invitations ADD CONSTRAINT invitations_type_check
        CHECK (type IN ('workspace', 'event', 'team', 'judge_assignment', 'mentor_assignment'));
    `,
  },
];

// ─── Execute via Management API ───────────────────────────────────────────────

async function execSQL(sql: string, name: string): Promise<void> {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res.ok) {
    console.log(`  ✅ ${name}`);
    return;
  }

  const body = await res.json().catch(() => ({ message: "unknown error" }));
  // Some errors are acceptable (e.g., column already exists)
  const msg = JSON.stringify(body);
  if (msg.includes("already exists") || msg.includes("duplicate")) {
    console.log(`  ↩  ${name} (already applied)`);
  } else {
    throw new Error(`Migration "${name}" failed (HTTP ${res.status}): ${msg}`);
  }
}

async function main() {
  console.log(`\n🔧  Applying Pending Migrations → ${PROJECT_REF}\n`);

  for (const m of MIGRATIONS) {
    try {
      await execSQL(m.sql, m.name);
    } catch (err: unknown) {
      console.error(`  ❌  ${(err as Error).message}`);
    }
  }

  console.log(`\n✅  Done! Re-run the seed script to populate profile data:\n`);
  console.log(`    npx tsx scripts/seed-demo.ts\n`);
}

main().catch((err) => {
  console.error("💥  push-migrations failed:", err.message);
  process.exit(1);
});
