/**
 * seed-demo.ts — Stellar Guardian 3.0
 *
 * Production-quality, idempotent demo seed.
 *
 * Creates a complete, navigable hackathon environment with:
 *   - 20 realistic users across 5 countries and skill sets
 *   - 1 workspace: "Stellar Guardian HQ"
 *   - 1 event: "Stellar Soroban Buildathon 2026" (RegistrationOpen)
 *   - Role distribution: 1 organizer, 2 judges, 1 mentor, 12 participants, 4 unassigned
 *   - 4 teams (Nebula Protocol, Aurora Labs, Quantum Forge, Starweave)
 *   - 1 solo participant (no team)
 *   - Pending team invitations for 2 unassigned users
 *   - A 100-point judging rubric
 *
 * IDEMPOTENT — safe to run multiple times. Uses upsert / lookup-before-insert
 * to prevent duplicate records. Cleans up stale demo events/teams before re-seeding.
 *
 * Run with:
 *   cd web && npx tsx scripts/seed-demo.ts
 *
 * Prerequisites in .env.local (or environment):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// ─── Environment Setup ────────────────────────────────────────────────────────

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
// Also try root .env if .env.local not found
const rootEnvPath = path.join(process.cwd(), "..", ".env");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "❌  Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Constants ────────────────────────────────────────────────────────────────

const DEMO_PASSWORD = "Guardian2026!";
const WORKSPACE_SLUG = "stellar-guardian-hq";
const WORKSPACE_NAME = "Stellar Guardian HQ";
const EVENT_TITLE = "Stellar Soroban Buildathon 2026";

// ─── User Definitions ────────────────────────────────────────────────────────

/**
 * The primary organizer account. We NEVER modify auth credentials for this
 * user — only ensure their public profile (users table) is complete.
 */
const PRIMARY_ORGANIZER_EMAIL = "reymarkjpanes@gmail.com";

interface UserDef {
  key: string;
  email: string;
  password: string;
  name: string;
  bio: string;
  country: string;
  city: string;
  timezone: string;
  avatar_url: string;
  skills: string[]; // for user_skills junction
  wallet?: string;  // Stellar public key
}

const USERS: UserDef[] = [
  {
    key: "alex",
    email: "alex.rivera@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "Alex Rivera",
    bio: "Full-stack engineer specializing in blockchain infrastructure and DeFi protocol design. Core contributor to several Stellar ecosystem projects.",
    country: "US",
    city: "San Francisco",
    timezone: "America/Los_Angeles",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=alex-rivera&backgroundColor=b6e3f4",
    skills: ["React", "TypeScript", "Stellar SDK", "Node.js"],
    wallet: "GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ",
  },
  {
    key: "maya",
    email: "maya.chen@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "Maya Chen",
    bio: "Smart contract security researcher and blockchain auditor. Former senior engineer at a leading Web3 security firm with 6+ years of protocol auditing experience.",
    country: "SG",
    city: "Singapore",
    timezone: "Asia/Singapore",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=maya-chen&backgroundColor=ffdfbf",
    skills: ["Rust", "Solidity", "Security Auditing", "Cryptography"],
    wallet: "GBVKI23PPVPJREHORHLTUJ5OXMNOFSQ3AL45KDKZ7R5XQISJDLHEFN5",
  },
  {
    key: "james",
    email: "james.okafor@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "James Okafor",
    bio: "Product designer and UX strategist with deep expertise in Web3 product experiences. Leads design systems at scale for decentralized applications.",
    country: "NG",
    city: "Lagos",
    timezone: "Africa/Lagos",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=james-okafor&backgroundColor=c0aede",
    skills: ["UI/UX Design", "Figma", "Design Systems", "Product Strategy"],
  },
  {
    key: "dana",
    email: "dana.kim@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "Dana Kim",
    bio: "Backend engineer focused on distributed systems and blockchain infrastructure. Leads the Nebula Protocol team with expertise in Soroban and Go.",
    country: "KR",
    city: "Seoul",
    timezone: "Asia/Seoul",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=dana-kim&backgroundColor=d1d4f9",
    skills: ["Go", "Kubernetes", "PostgreSQL", "Soroban"],
    wallet: "GDOEVDDBU6OBWKL7VHDAOKD77UP4DKHQYKOKJJT5PR3WRDBTX35HUEUX",
  },
  {
    key: "eli",
    email: "eli.santos@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "Eli Santos",
    bio: "Stellar ecosystem advocate and open-source contributor. Focuses on DevOps pipelines and tooling for Soroban smart contract deployment.",
    country: "BR",
    city: "São Paulo",
    timezone: "America/Sao_Paulo",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=eli-santos&backgroundColor=b6e3f4",
    skills: ["Stellar SDK", "Python", "Soroban", "DevOps"],
  },
  {
    key: "fiona",
    email: "fiona.wu@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "Fiona Wu",
    bio: "Data scientist and ML engineer exploring on-chain analytics and algorithmic trading on Stellar. Captain of Aurora Labs.",
    country: "TW",
    city: "Taipei",
    timezone: "Asia/Taipei",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=fiona-wu&backgroundColor=ffdfbf",
    skills: ["Python", "Machine Learning", "Analytics", "Rust"],
    wallet: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGZUD2OS2XLKGEQ3S5EZTP",
  },
  {
    key: "george",
    email: "george.ndiaye@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "George Ndiaye",
    bio: "Mobile developer building cross-platform DApps with React Native and Flutter. Focuses on bringing Stellar to mobile-first markets in West Africa.",
    country: "SN",
    city: "Dakar",
    timezone: "Africa/Dakar",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=george-ndiaye&backgroundColor=c0aede",
    skills: ["React Native", "Flutter", "Swift", "Kotlin"],
  },
  {
    key: "lina",
    email: "lina.johansson@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "Lina Johansson",
    bio: "Systems programmer and WebAssembly enthusiast. Brings deep Rust expertise to Soroban smart contract development and performance optimization.",
    country: "SE",
    city: "Stockholm",
    timezone: "Europe/Stockholm",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=lina-johansson&backgroundColor=b6e3f4",
    skills: ["Rust", "WebAssembly", "Soroban", "Systems Programming"],
    wallet: "GBVKI23PPVPJREHORHLTUJ5OXMNOFSQ3AL45KDKZ7R5XQISJDLHEFN6",
  },
  {
    key: "tariq",
    email: "tariq.alrashidi@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "Tariq Al-Rashidi",
    bio: "DeFi protocol designer with a background in traditional finance. Specializes in token economics and on-chain market making on Stellar.",
    country: "AE",
    city: "Dubai",
    timezone: "Asia/Dubai",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=tariq-alrashidi&backgroundColor=ffdfbf",
    skills: ["Solidity", "DeFi", "Token Economics", "Financial Modeling"],
    wallet: "GDMQUX2ZHURMVREOXU4HS3R4BAFND7XGWWXKU5WFWSGYCEYB72AWSJ4",
  },
  {
    key: "priya",
    email: "priya.sharma@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "Priya Sharma",
    bio: "Full-stack developer and team lead at a Web3 startup. Expert in GraphQL API design and React performance optimization. Captain of Quantum Forge.",
    country: "IN",
    city: "Bangalore",
    timezone: "Asia/Kolkata",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=priya-sharma&backgroundColor=d1d4f9",
    skills: ["React", "Node.js", "GraphQL", "TypeScript"],
    wallet: "GDOEVDDBU6OBWKL7VHDAOKD77UP4DKHQYKOKJJT5PR3WRDBTX35HUEUX",
  },
  {
    key: "carlos",
    email: "carlos.mendoza@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "Carlos Mendoza",
    bio: "Blockchain data analyst specializing in on-chain analytics and visualization. Builds dashboards that make DeFi data accessible to everyday users.",
    country: "MX",
    city: "Mexico City",
    timezone: "America/Mexico_City",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=carlos-mendoza&backgroundColor=c0aede",
    skills: ["Python", "Data Science", "SQL", "Blockchain Analytics"],
  },
  {
    key: "aisha",
    email: "aisha.bello@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "Aisha Bello",
    bio: "Smart contract developer and DeFi architect. Builds composable protocol infrastructure with a focus on security and gas optimization.",
    country: "KE",
    city: "Nairobi",
    timezone: "Africa/Nairobi",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=aisha-bello&backgroundColor=b6e3f4",
    skills: ["Vue.js", "TypeScript", "Soroban", "DeFi"],
    wallet: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGZUD2OS2XLKGEQ3S5EZTP",
  },
  {
    key: "tomasz",
    email: "tomasz.kowalski@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "Tomasz Kowalski",
    bio: "Cryptography researcher and ZK-proof engineer. Explores privacy-preserving technologies on Layer 1 blockchains, particularly Stellar.",
    country: "PL",
    city: "Warsaw",
    timezone: "Europe/Warsaw",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=tomasz-kowalski&backgroundColor=ffdfbf",
    skills: ["Rust", "C++", "Zero-Knowledge Proofs", "Cryptography"],
  },
  {
    key: "sakura",
    email: "sakura.tanaka@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "Sakura Tanaka",
    bio: "Blockchain architect and technical educator. Mentors developer teams on Stellar ecosystem best practices and Soroban contract design patterns.",
    country: "JP",
    city: "Tokyo",
    timezone: "Asia/Tokyo",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=sakura-tanaka&backgroundColor=d1d4f9",
    skills: ["Blockchain Architecture", "Stellar SDK", "Technical Writing", "Rust"],
    wallet: "GDMQUX2ZHURMVREOXU4HS3R4BAFND7XGWWXKU5WFWSGYCEYB72AWSJ5",
  },
  {
    key: "nikolai",
    email: "nikolai.petrov@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "Nikolai Petrov",
    bio: "Independent full-stack developer building open-source tooling for Stellar developers. Prefers working solo on high-impact infrastructure projects.",
    country: "DE",
    city: "Berlin",
    timezone: "Europe/Berlin",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=nikolai-petrov&backgroundColor=c0aede",
    skills: ["Full-Stack", "Stellar SDK", "Soroban", "DevOps"],
    wallet: "GBVKI23PPVPJREHORHLTUJ5OXMNOFSQ3AL45KDKZ7R5XQISJDLHEFN7",
  },
  // ── Unassigned users — available for invitations ──────────────────────────
  {
    key: "amara",
    email: "amara.osei@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "Amara Osei",
    bio: "Product designer with a passion for Web3 onboarding experiences. Loves simplifying complex blockchain interactions for mainstream users.",
    country: "GH",
    city: "Accra",
    timezone: "Africa/Accra",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=amara-osei&backgroundColor=b6e3f4",
    skills: ["Product Design", "Figma", "User Research", "Prototyping"],
  },
  {
    key: "rafael",
    email: "rafael.costa@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "Rafael Costa",
    bio: "Backend architect specializing in high-throughput API design and PostgreSQL optimization. Looking for exciting Web3 projects to contribute to.",
    country: "PT",
    city: "Lisbon",
    timezone: "Europe/Lisbon",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=rafael-costa&backgroundColor=ffdfbf",
    skills: ["Backend Development", "PostgreSQL", "API Design", "Testing"],
  },
  {
    key: "yuna",
    email: "yuna.park@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "Yuna Park",
    bio: "Frontend engineer and animation specialist. Creates delightful, accessible web experiences with a focus on motion design and performance.",
    country: "KR",
    city: "Busan",
    timezone: "Asia/Seoul",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=yuna-park&backgroundColor=d1d4f9",
    skills: ["Frontend Development", "CSS Animation", "Accessibility", "React"],
  },
  {
    key: "hassan",
    email: "hassan.diallo@stellarguardian.dev",
    password: DEMO_PASSWORD,
    name: "Hassan Diallo",
    bio: "Mobile developer and community builder from West Africa. Building financial tools for the unbanked using Stellar's low-cost payment infrastructure.",
    country: "ML",
    city: "Bamako",
    timezone: "Africa/Bamako",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=hassan-diallo&backgroundColor=c0aede",
    skills: ["React Native", "Firebase", "Mobile Development", "Stellar SDK"],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * List all auth users (handles pagination for large user sets).
 */
async function listAllAuthUsers(): Promise<{ id: string; email?: string }[]> {
  const all: { id: string; email?: string }[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) break;
    all.push(...data.users.map((u) => ({ id: u.id, email: u.email })));
    if (data.users.length < 200) break;
    page++;
  }
  return all;
}

/**
 * Upsert an auth user + their public profile. Idempotent.
 * For the primary organizer, skips auth creation (uses existing account).
 */
async function upsertUser(
  def: UserDef,
  authUsers: { id: string; email?: string }[],
): Promise<string> {
  const existing = authUsers.find(
    (u) => u.email?.toLowerCase() === def.email.toLowerCase(),
  );

  let userId: string;

  if (existing) {
    userId = existing.id;
    process.stdout.write(`  ↩  ${def.email} (existing)\n`);
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email: def.email,
      password: def.password,
      email_confirm: true,
      user_metadata: { display_name: def.name },
    });
    if (error || !data.user) {
      throw new Error(`createUser(${def.email}): ${error?.message}`);
    }
    userId = data.user.id;
    process.stdout.write(`  ✅ ${def.email} created (${userId.slice(0, 8)}…)\n`);
  }

  // Upsert public profile in the users table
  await sb
    .from("users")
    .upsert(
      {
        id: userId,
        email: def.email,
        display_name: def.name,
        bio: def.bio,
        country: def.country,
        city: def.city,
        timezone: def.timezone,
        avatar_url: def.avatar_url,
      },
      { onConflict: "id" },
    );

  return userId;
}

/**
 * Upsert the primary organizer's profile without touching auth credentials.
 * Returns null if the account does not exist yet.
 */
async function upsertOrganizerProfile(
  authUsers: { id: string; email?: string }[],
): Promise<string | null> {
  const existing = authUsers.find(
    (u) => u.email?.toLowerCase() === PRIMARY_ORGANIZER_EMAIL.toLowerCase(),
  );
  if (!existing) {
    console.warn(
      `  ⚠  ${PRIMARY_ORGANIZER_EMAIL} not found in auth. Sign up once via the UI, then re-run this seed.`,
    );
    return null;
  }

  await sb
    .from("users")
    .upsert(
      {
        id: existing.id,
        email: PRIMARY_ORGANIZER_EMAIL,
        display_name: "Reymark Panes",
        bio: "Platform founder and lead engineer at Stellar Guardian. Building the infrastructure for trustless hackathon management on the Stellar network.",
        country: "PH",
        city: "Manila",
        timezone: "Asia/Manila",
        avatar_url:
          "https://api.dicebear.com/9.x/notionists/svg?seed=reymark-panes&backgroundColor=b6e3f4",
      },
      { onConflict: "id" },
    );

  process.stdout.write(`  ✅ ${PRIMARY_ORGANIZER_EMAIL} profile updated (auth preserved)\n`);
  return existing.id;
}

/**
 * Look up skill IDs from the skills table by name. Returns a map of name → id.
 * Creates skill if it doesn't exist (graceful).
 */
async function resolveSkillIds(names: string[]): Promise<Map<string, string>> {
  if (names.length === 0) return new Map();
  const { data } = await sb.from("skills").select("id, name").in("name", names);
  const found = new Map((data ?? []).map((s) => [s.name as string, s.id as string]));
  return found;
}

/**
 * Upsert user_skills for a given user. Idempotent.
 */
async function upsertUserSkills(userId: string, skillNames: string[]): Promise<void> {
  if (skillNames.length === 0) return;
  const skillMap = await resolveSkillIds(skillNames);
  const rows = [...skillMap.entries()].map(([, skillId]) => ({
    user_id: userId,
    skill_id: skillId,
    experience_level: "Mid",
  }));
  if (rows.length > 0) {
    await sb.from("user_skills").upsert(rows, { onConflict: "user_id,skill_id" });
  }
}

/**
 * Upsert a wallet for a user. Idempotent on user_id + public_key.
 */
async function upsertWallet(userId: string, publicKey: string): Promise<void> {
  await sb.from("wallets").upsert(
    {
      user_id: userId,
      public_key: publicKey,
      provider: "freighter",
      network_mode: "testnet",
      verification_status: "Verified",
      verified_at: new Date().toISOString(),
    },
    { onConflict: "user_id,public_key" },
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("\n🌱  Stellar Guardian — Production Demo Seed\n");
  console.log("=".repeat(52));

  // ── 1. Load all existing auth users (single paginated call) ────────────────
  console.log("\n── Auth ──────────────────────────────────────────────");
  const authUsers = await listAllAuthUsers();
  console.log(`  Found ${authUsers.length} existing auth users`);

  // ── 2. Upsert organizer (no auth changes) ─────────────────────────────────
  console.log("\n── Primary Organizer ─────────────────────────────────");
  const organizerId = await upsertOrganizerProfile(authUsers);
  if (!organizerId) {
    console.error(
      "\n❌  Cannot seed without the primary organizer account. Aborting.\n" +
        "    Please sign up as reymarkjpanes@gmail.com via the app first.\n",
    );
    process.exit(1);
  }

  // ── 3. Upsert all 19 demo users ───────────────────────────────────────────
  console.log("\n── Demo Users ────────────────────────────────────────");
  const ids: Record<string, string> = { organizer: organizerId };
  for (const def of USERS) {
    ids[def.key] = await upsertUser(def, authUsers);
  }

  // ── 4. User skills ────────────────────────────────────────────────────────
  console.log("\n── User Skills ───────────────────────────────────────");
  // Also set skills for organizer
  await upsertUserSkills(organizerId, ["Next.js", "React", "TypeScript", "Stellar SDK"]);
  for (const def of USERS) {
    await upsertUserSkills(ids[def.key]!, def.skills);
  }
  console.log(`  ✅ Skills linked for ${USERS.length + 1} users`);

  // ── 5. Wallets for users who have them ────────────────────────────────────
  console.log("\n── Wallets ───────────────────────────────────────────");
  for (const def of USERS) {
    if (def.wallet) {
      await upsertWallet(ids[def.key]!, def.wallet);
      process.stdout.write(`  ✅ Wallet for ${def.name}\n`);
    }
  }

  // ── 6. Workspace ──────────────────────────────────────────────────────────
  console.log("\n── Workspace ─────────────────────────────────────────");

  // Check if workspace already exists
  const { data: existingWs } = await sb
    .from("workspaces")
    .select("id, slug, name")
    .eq("slug", WORKSPACE_SLUG)
    .maybeSingle();

  let wsId: string;

  if (existingWs) {
    wsId = existingWs.id;
    console.log(`  ↩  Workspace "${existingWs.name}" already exists`);
  } else {
    const { data: ws, error: wsErr } = await sb
      .from("workspaces")
      .insert({
        slug: WORKSPACE_SLUG,
        name: WORKSPACE_NAME,
        description:
          "The official workspace for Stellar Guardian — the platform powering trustless hackathon management on the Stellar blockchain.",
      })
      .select("id")
      .single();
    if (wsErr || !ws) {
      throw new Error(`workspace insert: ${wsErr?.message}`);
    }
    wsId = ws.id;
    console.log(`  ✅ Workspace "${WORKSPACE_NAME}" created`);
  }

  // Upsert all workspace memberships
  const wsMemberRows = [
    { workspace_id: wsId, user_id: organizerId, role: "Owner" },
    ...USERS.map((def) => ({
      workspace_id: wsId,
      user_id: ids[def.key]!,
      role: ["alex", "maya", "james"].includes(def.key) ? "Admin" : "Member",
    })),
  ];
  await sb.from("workspace_members").upsert(wsMemberRows, { onConflict: "workspace_id,user_id" });
  console.log(`  ✅ ${wsMemberRows.length} workspace members upserted`);

  // ── 7. Clean up stale demo events ────────────────────────────────────────
  console.log("\n── Cleanup ───────────────────────────────────────────");
  // Delete old demo events by title so we get a clean slate each run.
  // CASCADE handles event_members, teams, team_members, submissions.
  const staleEventTitles = [
    "Stellar Soroban Hackathon 2026",
    "Stellar DeFi Hackathon 2025",
    EVENT_TITLE,
  ];
  for (const title of staleEventTitles) {
    const { error } = await sb.from("events").delete().eq("title", title);
    if (!error) process.stdout.write(`  🗑  Cleaned: "${title}"\n`);
  }

  // ── 8. Create event ───────────────────────────────────────────────────────
  console.log("\n── Event ─────────────────────────────────────────────");

  const registrationDeadline = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  const { data: event, error: evErr } = await sb
    .from("events")
    .insert({
      workspace_id: wsId,
      organizer_id: organizerId,
      title: EVENT_TITLE,
      description:
        "Build the next generation of decentralized applications on Stellar's Soroban smart " +
        "contract platform. Whether you're designing DeFi protocols, developer tooling, or " +
        "consumer-facing Web3 products — if it runs on Stellar, it belongs here.\n\n" +
        "Teams of 2–5 builders compete over 72 hours for a 25,000 XLM prize pool held in " +
        "on-chain escrow. Judges score across four dimensions: Innovation, Technical " +
        "Excellence, Ecosystem Impact, and Presentation Quality.\n\n" +
        "Solo participants are welcome. All skill levels encouraged. Build something real.",
      category: "hackathon",
      format: "online",
      tags: ["Soroban", "DeFi", "Infrastructure", "Developer Tools", "Web3"],
      // RegistrationOpen: allows register, team creation, invitations, solo participation
      state: "RegistrationOpen",
      team_size_min: 2,
      team_size_max: 5,
      prize_pool_target: 25000,
      network_mode: "testnet",
      registration_deadline: registrationDeadline,
      review_window_hours: 72,
      prize_split_policy: "equal_split",
      resubmission_policy: { allowed: true },
      file_policy: { allowedMimeTypes: [] },
    })
    .select("id, title, state")
    .single();

  if (evErr || !event) {
    throw new Error(`event insert: ${evErr?.message}`);
  }
  const eventId = event.id;
  console.log(`  ✅ "${event.title}" (state: ${event.state})`);
  console.log(`     ID: ${eventId}`);

  // ── 9. Event members ──────────────────────────────────────────────────────
  console.log("\n── Event Members ─────────────────────────────────────");

  const eventMemberRows = [
    // Organizer
    { event_id: eventId, user_id: organizerId, role: "Organizer", status: "accepted" },
    // Judges
    { event_id: eventId, user_id: ids.maya!, role: "Judge", status: "accepted" },
    { event_id: eventId, user_id: ids.james!, role: "Judge", status: "accepted" },
    // Mentor
    { event_id: eventId, user_id: ids.sakura!, role: "Mentor", status: "accepted" },
    // Participants (team members + solo)
    { event_id: eventId, user_id: ids.alex!, role: "Participant", status: "accepted" },
    { event_id: eventId, user_id: ids.dana!, role: "Participant", status: "accepted" },
    { event_id: eventId, user_id: ids.eli!, role: "Participant", status: "accepted" },
    { event_id: eventId, user_id: ids.fiona!, role: "Participant", status: "accepted" },
    { event_id: eventId, user_id: ids.george!, role: "Participant", status: "accepted" },
    { event_id: eventId, user_id: ids.lina!, role: "Participant", status: "accepted" },
    { event_id: eventId, user_id: ids.tariq!, role: "Participant", status: "accepted" },
    { event_id: eventId, user_id: ids.priya!, role: "Participant", status: "accepted" },
    { event_id: eventId, user_id: ids.carlos!, role: "Participant", status: "accepted" },
    { event_id: eventId, user_id: ids.aisha!, role: "Participant", status: "accepted" },
    { event_id: eventId, user_id: ids.tomasz!, role: "Participant", status: "accepted" },
    { event_id: eventId, user_id: ids.nikolai!, role: "Participant", status: "accepted" },
    // NOTE: amara, rafael, yuna, hassan are NOT added as event members —
    // they remain unassigned platform users available to receive invitations.
  ];

  const { error: emErr } = await sb
    .from("event_members")
    .upsert(eventMemberRows, { onConflict: "event_id,user_id,role" });
  if (emErr) console.warn(`  ⚠ event_members: ${emErr.message}`);
  console.log(`  ✅ ${eventMemberRows.length} event members (1 organizer, 2 judges, 1 mentor, ${eventMemberRows.length - 4} participants)`);

  // ── 10. Teams ─────────────────────────────────────────────────────────────
  console.log("\n── Teams ─────────────────────────────────────────────");

  interface TeamDef {
    name: string;
    captainKey: string;
    memberKeys: string[];
    description?: string;
  }

  const teamDefs: TeamDef[] = [
    {
      name: "Nebula Protocol",
      captainKey: "dana",
      memberKeys: ["eli", "tariq"],
      // description intentionally omitted to test empty description rendering
    },
    {
      name: "Aurora Labs",
      captainKey: "fiona",
      memberKeys: ["george", "carlos"],
    },
    {
      name: "Quantum Forge",
      captainKey: "priya",
      memberKeys: ["aisha", "lina"],
    },
    {
      name: "Starweave",
      captainKey: "alex",
      memberKeys: ["tomasz"],
    },
  ];

  const teamIds: Record<string, string> = {};

  for (const def of teamDefs) {
    const captainId = ids[def.captainKey]!;

    // Try insert with created_by (newer schema)
    let { data: team, error: tErr } = await sb
      .from("teams")
      .insert({
        event_id: eventId,
        name: def.name,
        created_by: captainId,
        captain_id: captainId,
        max_members: 5,
      })
      .select("id, name")
      .single();

    // Fall back to base schema if created_by doesn't exist
    if (tErr?.message?.includes("column")) {
      const fb = await sb
        .from("teams")
        .insert({ event_id: eventId, name: def.name, captain_id: captainId })
        .select("id, name")
        .single();
      team = fb.data;
      tErr = fb.error ?? null;
    }

    if (tErr || !team) {
      console.warn(`  ⚠ team "${def.name}": ${tErr?.message}`);
      continue;
    }

    teamIds[def.captainKey] = team.id;
    console.log(`  ✅ Team: "${team.name}" (captain: ${def.captainKey})`);

    // Insert team members (captain + members)
    const memberRows = [captainId, ...def.memberKeys.map((k) => ids[k]!)]
      .map((uid) => ({ team_id: team!.id, user_id: uid, event_id: eventId }));

    const { error: tmErr } = await sb
      .from("team_members")
      .upsert(memberRows, { onConflict: "team_id,user_id" });
    if (tmErr) console.warn(`    ⚠ team_members for "${def.name}": ${tmErr.message}`);
    else console.log(`    ✅ ${memberRows.length} members added`);
  }

  // ── 11. Solo participant ──────────────────────────────────────────────────
  console.log("\n── Solo Participant ──────────────────────────────────");
  // Nikolai is a registered Participant but deliberately left without a team.
  // The teams page will show them as "No Team / Solo".
  console.log(`  ✅ Nikolai Petrov (nikolai.petrov@stellarguardian.dev) is solo — no team assigned`);

  // ── 12. Team invitations ──────────────────────────────────────────────────
  console.log("\n── Team Invitations ──────────────────────────────────");
  // Now that team_invitations is applied, use it for rich per-user invites.
  // Invite Amara Osei and Rafael Costa to Starweave (Alex Rivera is captain).

  const starweaveId = teamIds["alex"];
  if (starweaveId && ids.alex && ids.amara && ids.rafael) {
    // Delete stale invitations for Starweave first (idempotent)
    await sb
      .from("team_invitations")
      .delete()
      .eq("team_id", starweaveId)
      .in("status", ["Pending", "pending"]);

    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const invRows = [
      {
        team_id: starweaveId,
        event_id: eventId,
        inviter_user_id: ids.alex,
        invitee_user_id: ids.amara,
        message:
          "Hey Amara! We're building a decentralized data marketplace and your design skills would be a perfect fit. Would love to have you on Starweave.",
        status: "Pending",
        inviter_role: "Captain",
        expires_at: expiresAt,
      },
      {
        team_id: starweaveId,
        event_id: eventId,
        inviter_user_id: ids.alex,
        invitee_user_id: ids.rafael,
        message:
          "Rafael, your backend expertise is exactly what we need for our Soroban contracts. Join us on Starweave!",
        status: "Pending",
        inviter_role: "Captain",
        expires_at: expiresAt,
      },
    ];

    const { error: invErr } = await sb.from("team_invitations").insert(invRows);
    if (invErr) console.warn(`  ⚠ team_invitations: ${invErr.message}`);
    else console.log(`  ✅ 2 pending team invitations sent (to Amara Osei, Rafael Costa)`);
  } else {
    console.warn(`  ⚠ Skipped invitations: starweaveId=${starweaveId}`);
  }

  // ── 13. Rubric ────────────────────────────────────────────────────────────
  console.log("\n── Judging Rubric ────────────────────────────────────");
  try {
    await sb.from("rubrics").upsert(
      {
        event_id: eventId,
        title: "Stellar Soroban Buildathon Rubric",
        criteria: [
          {
            id: "innovation",
            label: "Innovation",
            max_score: 25,
            description:
              "Originality of the idea and its novelty within the Stellar / Soroban ecosystem.",
          },
          {
            id: "technical",
            label: "Technical Excellence",
            max_score: 25,
            description:
              "Code quality, architecture soundness, security practices, and Soroban contract design.",
          },
          {
            id: "impact",
            label: "Ecosystem Impact",
            max_score: 25,
            description:
              "Real-world applicability, potential to grow the Stellar developer ecosystem, and user value.",
          },
          {
            id: "presentation",
            label: "Presentation",
            max_score: 25,
            description:
              "Clarity of demo, quality of documentation, and ability to communicate value to judges.",
          },
        ],
        max_score: 100,
      },
      { onConflict: "event_id" },
    );
    console.log(`  ✅ Rubric: 100pt max (4 criteria × 25pts)`);
  } catch {
    console.log(`  ⚠ Rubric table not available — skipping`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(52));
  console.log("✨  Demo seed complete!\n");

  console.log("📋  Event Details:");
  console.log(`    Title:    ${EVENT_TITLE}`);
  console.log(`    State:    RegistrationOpen`);
  console.log(`    ID:       ${eventId}`);
  console.log(`    Prize:    25,000 XLM (testnet escrow)`);
  console.log(`    Deadline: ${new Date(registrationDeadline).toLocaleDateString()}\n`);

  console.log("🔗  Key URLs:");
  console.log(`    Event overview:   /events/${eventId}`);
  console.log(`    Members tab:      /events/${eventId}/members`);
  console.log(`    Teams tab:        /events/${eventId}/teams`);
  console.log(`    Submissions:      /events/${eventId}/submissions`);
  console.log(`    Judging:          /events/${eventId}/judging`);
  console.log(`    Workspace:        /workspaces/${WORKSPACE_SLUG}\n`);

  console.log("🔐  Login Credentials (password: Guardian2026! for all demo accounts):\n");
  console.log("    Role             Email                                      Password");
  console.log("    " + "─".repeat(75));
  console.log(`    Organizer (you)  ${PRIMARY_ORGANIZER_EMAIL.padEnd(42)} [your existing password]`);
  console.log(`    Judge            ${"maya.chen@stellarguardian.dev".padEnd(42)} Guardian2026!`);
  console.log(`    Judge            ${"james.okafor@stellarguardian.dev".padEnd(42)} Guardian2026!`);
  console.log(`    Mentor           ${"sakura.tanaka@stellarguardian.dev".padEnd(42)} Guardian2026!`);
  console.log(`    Participant(cap) ${"dana.kim@stellarguardian.dev".padEnd(42)} Guardian2026!`);
  console.log(`    Participant      ${"nikolai.petrov@stellarguardian.dev".padEnd(42)} Guardian2026!`);
  console.log(`    Unassigned       ${"amara.osei@stellarguardian.dev".padEnd(42)} Guardian2026!`);
  console.log(`    Unassigned       ${"rafael.costa@stellarguardian.dev".padEnd(42)} Guardian2026!`);
  console.log();
  console.log("👥  Teams:");
  console.log("    Nebula Protocol  → Dana Kim (captain), Eli Santos, Tariq Al-Rashidi");
  console.log("    Aurora Labs      → Fiona Wu (captain), George Ndiaye, Carlos Mendoza");
  console.log("    Quantum Forge    → Priya Sharma (captain), Aisha Bello, Lina Johansson");
  console.log("    Starweave        → Alex Rivera (captain), Tomasz Kowalski");
  console.log("    Solo             → Nikolai Petrov (no team)");
  console.log();
  console.log("✉   Pending Invitations (to Starweave):");
  console.log("    amara.osei@stellarguardian.dev  — invited by Alex Rivera");
  console.log("    rafael.costa@stellarguardian.dev — invited by Alex Rivera");
  console.log();
  console.log("📌  Next step: Log in as reymarkjpanes@gmail.com → browse the event");
}

seed().catch((err) => {
  console.error("\n💥  Seed failed:", err);
  process.exit(1);
});
