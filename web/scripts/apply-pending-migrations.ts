/**
 * apply-pending-migrations.ts
 *
 * Applies the team_invitations migration (and any other pending migrations)
 * directly to the remote Supabase project via the Management API.
 *
 * Does NOT require `supabase login` or Docker.
 *
 * Run with:
 *   cd web && npx tsx scripts/apply-pending-migrations.ts
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_DB_PASSWORD   (the database password set in Supabase dashboard)
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Extract project ref from URL: https://PROJECTREF.supabase.co
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error("❌  Could not extract project ref from SUPABASE_URL:", SUPABASE_URL);
  process.exit(1);
}

console.log(`🔗  Project ref: ${projectRef}`);

/**
 * Execute raw SQL against the project via the Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN (personal access token) — OR we can use
 * the pg REST endpoint if available.
 *
 * Fallback: use the /rest/v1/rpc endpoint if we have an exec_sql RPC defined,
 * otherwise use the pg driver directly.
 */
async function execSQL(sql: string, label: string): Promise<void> {
  // Try via Management API first
  const mgmtUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN ?? "";

  if (accessToken) {
    const res = await fetch(mgmtUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      console.log(`  ✅ ${label}`);
      return;
    }
    console.warn(`  ⚠ Management API failed (${res.status}):`, JSON.stringify(body));
  }

  // Fallback: use the Supabase REST API exec_sql RPC if it exists
  const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`;
  const rpcRes = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (rpcRes.ok) {
    console.log(`  ✅ ${label} (via RPC)`);
    return;
  }

  const rpcBody = await rpcRes.text();
  throw new Error(`SQL exec failed for "${label}": ${rpcBody}`);
}

/**
 * The specific migrations we need to apply for the team_invitations table
 * to gain inviter_user_id, invitee_user_id, event_id, and inviter_role columns.
 */
const MIGRATIONS: { label: string; sql: string }[] = [
  {
    label: "team_invitations: add user_id columns",
    sql: `
      ALTER TABLE public.team_invitations
        ADD COLUMN IF NOT EXISTS inviter_user_id  uuid REFERENCES public.users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS invitee_user_id  uuid REFERENCES public.users(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS event_id         uuid REFERENCES public.events(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS responded_at     timestamptz;
    `,
  },
  {
    label: "team_invitations: add inviter_role column",
    sql: `
      ALTER TABLE public.team_invitations
        ADD COLUMN IF NOT EXISTS inviter_role text
          CHECK (inviter_role IN ('Captain', 'Member'))
          DEFAULT 'Captain';
    `,
  },
  {
    label: "team_invitations: extend status ENUM with lowercase variants",
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumtypid = 'public.team_invitation_status'::regtype
          AND enumlabel = 'pending'
        ) THEN
          ALTER TYPE public.team_invitation_status ADD VALUE IF NOT EXISTS 'pending';
          ALTER TYPE public.team_invitation_status ADD VALUE IF NOT EXISTS 'accepted';
          ALTER TYPE public.team_invitation_status ADD VALUE IF NOT EXISTS 'declined';
          ALTER TYPE public.team_invitation_status ADD VALUE IF NOT EXISTS 'cancelled';
        END IF;
      END;
      $$;
    `,
  },
  {
    label: "team_invitations: add indexes",
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_pending_unique
        ON public.team_invitations (team_id, invitee_user_id)
        WHERE status = 'pending' OR status = 'Pending';

      CREATE INDEX IF NOT EXISTS idx_team_invitations_invitee
        ON public.team_invitations (invitee_user_id, event_id, status);

      CREATE INDEX IF NOT EXISTS idx_team_invitations_team_status
        ON public.team_invitations (team_id, status);
    `,
  },
];

async function main() {
  console.log("\n🔧  Applying pending migrations\n");

  for (const migration of MIGRATIONS) {
    await execSQL(migration.sql, migration.label);
  }

  console.log("\n✨  All migrations applied successfully!\n");
  console.log("📌  Re-run the seed script to insert the invitations:");
  console.log("    npx tsx scripts/seed-demo.ts\n");
}

main().catch((err) => {
  console.error("\n💥  Migration failed:", err.message);
  process.exit(1);
});
