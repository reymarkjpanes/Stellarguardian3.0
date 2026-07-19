/**
 * Seed script for development/staging environments.
 * Run with: npx tsx scripts/seed.ts
 *
 * Creates sample users, workspaces, events, and teams for testing.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function seed() {
  console.log("🌱 Seeding database...");

  // Create test users via auth
  const testUsers = [
    { email: "admin@test.local", password: "password123", name: "Admin User" },
    { email: "organizer@test.local", password: "password123", name: "Org Smith" },
    { email: "judge@test.local", password: "password123", name: "Judge Jones" },
    { email: "participant@test.local", password: "password123", name: "Dev Johnson" },
  ];

  const userIds: string[] = [];

  for (const u of testUsers) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { display_name: u.name },
    });

    if (error) {
      if (error.message.includes("already been registered")) {
        const { data: existing } = await supabase.auth.admin.listUsers();
        const found = existing.users.find((x) => x.email === u.email);
        if (found) userIds.push(found.id);
        console.log(`  ⚠️  ${u.email} already exists`);
        continue;
      }
      console.error(`  ❌ Failed to create ${u.email}:`, error.message);
      continue;
    }

    userIds.push(data.user.id);

    // Create public.users profile
    await supabase.from("users").upsert({
      id: data.user.id,
      display_name: u.name,
      email: u.email,
    });

    console.log(`  ✅ Created ${u.email} (${data.user.id.slice(0, 8)}…)`);
  }

  if (userIds.length < 2) {
    console.log("Not enough users created. Stopping.");
    return;
  }

  // Create a workspace
  const { data: workspace } = await supabase
    .from("workspaces")
    .upsert({ slug: "stellar-labs", name: "Stellar Labs", description: "Demo workspace for testing" }, { onConflict: "slug" })
    .select()
    .single();

  if (workspace) {
    console.log(`  ✅ Workspace: ${workspace.name} (/${workspace.slug})`);

    // Add owner
    await supabase.from("workspace_members").upsert(
      { workspace_id: workspace.id, user_id: userIds[0], role: "Owner" },
      { onConflict: "workspace_id,user_id" },
    );

    // Add other members
    for (let i = 1; i < userIds.length; i++) {
      await supabase.from("workspace_members").upsert(
        { workspace_id: workspace.id, user_id: userIds[i], role: "Member" },
        { onConflict: "workspace_id,user_id" },
      );
    }

    // Create a sample event
    const { data: event } = await supabase
      .from("events")
      .insert({
        workspace_id: workspace.id,
        organizer_id: userIds[1],
        title: "Stellar DeFi Hackathon 2025",
        description: "Build the next generation of DeFi applications on Stellar. 72 hours, unlimited creativity.",
        category: "DeFi",
        format: "Online",
        tags: ["stellar", "defi", "blockchain"],
        state: "RegistrationOpen",
        team_size_min: 1,
        team_size_max: 5,
        prize_pool_target: 50000,
        network_mode: "testnet",
      })
      .select()
      .single();

    if (event) {
      console.log(`  ✅ Event: ${event.title}`);

      // Add organizer member
      await supabase.from("event_members").upsert(
        { event_id: event.id, user_id: userIds[1], role: "Organizer", status: "accepted" },
        { onConflict: "event_id,user_id,role" },
      );

      // Add judge
      if (userIds[2]) {
        await supabase.from("event_members").upsert(
          { event_id: event.id, user_id: userIds[2], role: "Judge", status: "accepted" },
          { onConflict: "event_id,user_id,role" },
        );
      }

      // Add participant
      if (userIds[3]) {
        await supabase.from("event_members").upsert(
          { event_id: event.id, user_id: userIds[3], role: "Participant", status: "accepted" },
          { onConflict: "event_id,user_id,role" },
        );
      }
    }
  }

  console.log("\n✨ Seeding complete!");
  console.log("\nTest credentials:");
  testUsers.forEach((u) => console.log(`  ${u.email} / ${u.password}`));
}

seed().catch(console.error);
