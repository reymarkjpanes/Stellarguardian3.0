/**
 * verify-seed.ts — Live API smoke tests for the seeded demo event.
 *
 * Uses the service role key (bypasses RLS) to verify the DB state is
 * exactly what we expect after seed-demo.ts completes.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const EVENT_TITLE = "Stellar Soroban Buildathon 2026";
const WORKSPACE_SLUG = "stellar-guardian-hq";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  let pass = 0;
  let fail = 0;

  function check(label: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`  ✅ ${label}`);
      pass++;
    } else {
      console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
      fail++;
    }
  }

  console.log("\n🧪  Verify Demo Seed\n" + "=".repeat(52));

  // ── Event ─────────────────────────────────────────────
  console.log("\n── Event ─────────────────────────────────────────────");
  const { data: event } = await sb
    .from("events")
    .select("id, title, state, team_size_min, team_size_max, prize_pool_target, registration_deadline")
    .eq("title", EVENT_TITLE)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const EVENT_ID = event?.id ?? "";

  check("Event exists", !!event);
  check("State is RegistrationOpen", event?.state === "RegistrationOpen", event?.state);
  check("Team size 2–5", event?.team_size_min === 2 && event?.team_size_max === 5);
  check("Prize pool set", event?.prize_pool_target === 25000);
  check("Registration deadline in future", event?.registration_deadline ? new Date(event.registration_deadline) > new Date() : false);

  // ── Workspace ─────────────────────────────────────────
  console.log("\n── Workspace ─────────────────────────────────────────");
  const { data: ws } = await sb
    .from("workspaces")
    .select("id, name, slug")
    .eq("slug", WORKSPACE_SLUG)
    .single();

  check("Workspace exists", !!ws);
  check("Workspace name correct", ws?.name === "Stellar Guardian HQ");

  if (ws) {
    const { data: _wsMembers, count } = await sb
      .from("workspace_members")
      .select("*", { count: "exact" })
      .eq("workspace_id", ws.id);
    check(`Workspace has 20 members`, (count ?? 0) === 20, `got ${count}`);
  }

  // ── Event Members ─────────────────────────────────────
  console.log("\n── Event Members ─────────────────────────────────────");
  const { data: members } = await sb
    .from("event_members")
    .select("user_id, role, status")
    .eq("event_id", EVENT_ID);

  const totalMembers = members?.length ?? 0;
  check(`16 event members`, totalMembers === 16, `got ${totalMembers}`);

  const byRole = (role: string) => members?.filter((m) => m.role === role).length ?? 0;
  check("1 Organizer", byRole("Organizer") === 1);
  check("2 Judges", byRole("Judge") === 2);
  check("1 Mentor", byRole("Mentor") === 1);
  check("12 Participants", byRole("Participant") === 12);

  // ── Teams ─────────────────────────────────────────────
  console.log("\n── Teams ─────────────────────────────────────────────");
  const { data: teams } = await sb
    .from("teams")
    .select("id, name, captain_id")
    .eq("event_id", EVENT_ID);

  check("4 teams created", teams?.length === 4, `got ${teams?.length}`);

  const teamNames = (teams ?? []).map((t) => t.name).sort();
  check("All expected team names exist",
    ["Aurora Labs", "Nebula Protocol", "Quantum Forge", "Starweave"].every((n) => teamNames.includes(n)),
    teamNames.join(", ")
  );

  // ── Team Members ──────────────────────────────────────
  console.log("\n── Team Members ──────────────────────────────────────");
  const teamIds = (teams ?? []).map((t) => t.id);
  const { data: tmAll } = await sb
    .from("team_members")
    .select("team_id, user_id")
    .in("team_id", teamIds);

  check("11 total team members", tmAll?.length === 11, `got ${tmAll?.length}`);

  // Per-team counts
  for (const team of teams ?? []) {
    const count = tmAll?.filter((m) => m.team_id === team.id).length ?? 0;
    const expectedCount = team.name === "Starweave" ? 2 : 3;
    check(`${team.name}: ${expectedCount} member(s)`, count === expectedCount, `got ${count}`);
  }

  // ── Invitations ───────────────────────────────────────
  console.log("\n── Invitations ───────────────────────────────────────");
  const starweave = (teams ?? []).find((t) => t.name === "Starweave");
  if (starweave) {
    const { data: invs } = await sb
      .from("team_invitations")
      .select("id, invitee_user_id, team_id, status")
      .eq("team_id", starweave.id)
      .in("status", ["Pending", "pending"]);

    check("2 pending invitations for Starweave", invs?.length === 2, `got ${invs?.length}`);

    // Look up their user records to confirm by name
    if (invs && invs.length > 0) {
      const userIds = invs.map((i) => i.invitee_user_id).filter(Boolean);
      const { data: invitedUsers } = await sb
        .from("users")
        .select("id, display_name, email")
        .in("id", userIds);
      const emails = (invitedUsers ?? []).map((u) => u.email).sort();
      check("Amara Osei invited", emails.includes("amara.osei@stellarguardian.dev"));
      check("Rafael Costa invited", emails.includes("rafael.costa@stellarguardian.dev"));
    } else {
      check("Amara Osei invited", false, "no invitations found");
      check("Rafael Costa invited", false, "no invitations found");
    }
  }

  // ── Rubric ────────────────────────────────────────────
  console.log("\n── Rubric ────────────────────────────────────────────");
  const { data: rubric } = await sb
    .from("rubrics")
    .select("id, title, max_score, criteria")
    .eq("event_id", EVENT_ID)
    .maybeSingle();

  check("Rubric exists", !!rubric);
  check("Max score is 100", rubric?.max_score === 100);
  check("4 criteria", Array.isArray(rubric?.criteria) && (rubric!.criteria as unknown[]).length === 4, `got ${Array.isArray(rubric?.criteria) ? (rubric!.criteria as unknown[]).length : "not array"}`);

  // ── Users ─────────────────────────────────────────────
  console.log("\n── User Profiles ─────────────────────────────────────");
  const { data: users } = await sb
    .from("users")
    .select("id, display_name, bio, country, avatar_url")
    .in("email", [
      "reymarkjpanes@gmail.com",
      "alex.rivera@stellarguardian.dev",
      "maya.chen@stellarguardian.dev",
      "dana.kim@stellarguardian.dev",
      "sakura.tanaka@stellarguardian.dev",
      "nikolai.petrov@stellarguardian.dev",
    ]);

  check("6 key profiles present", users?.length === 6, `got ${users?.length}`);
  const allHaveBio = users?.every((u) => u.bio && u.bio.length > 10) ?? false;
  check("All sampled profiles have bio", allHaveBio);
  const allHaveCountry = users?.every((u) => u.country) ?? false;
  check("All sampled profiles have country", allHaveCountry);
  const allHaveAvatar = users?.every((u) => u.avatar_url) ?? false;
  check("All sampled profiles have avatar_url", allHaveAvatar);

  // ── Summary ───────────────────────────────────────────
  console.log("\n" + "=".repeat(52));
  console.log(`\n📊  Results: ${pass} passed, ${fail} failed\n`);

  if (fail === 0) {
    console.log("🎉  All checks passed! Demo environment is production-ready.\n");
  } else {
    console.log(`⚠️   ${fail} check(s) failed. Review the output above.\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("💥  Verify failed:", err);
  process.exit(1);
});
