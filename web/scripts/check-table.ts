/**
 * probe-schema.ts — Discover what tables and columns actually exist in the live DB.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const tables = [
    "users",
    "events",
    "event_members",
    "teams",
    "team_members",
    "workspaces",
    "workspace_members",
    "invitations",
    "submissions",
    "evaluations",
    "evaluation_criteria",
    "rubrics",
    "skills",
    "user_skills",
    "wallets",
    "team_invitations",
    "team_join_requests",
  ];

  console.log("\n🔍  Live Schema Probe\n");
  for (const t of tables) {
    const { data, error } = await sb.from(t).select("*").limit(0);
    const exists = !error;
    const hint = error?.hint ?? error?.message ?? "";
    console.log(`  ${exists ? "✅" : "❌"} ${t.padEnd(25)} ${exists ? "" : hint.slice(0, 60)}`);
  }

  // Also check what columns the users table has
  console.log("\n── users table (one row, all columns):");
  const { data: u } = await sb.from("users").select("*").limit(1).single();
  if (u) console.log("  columns:", Object.keys(u).join(", "));
}

main().catch(console.error);
