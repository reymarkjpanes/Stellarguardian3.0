/**
 * Role-specific dashboard (Req 29.1-29.8).
 *
 * Server Component that displays role-appropriate KPIs and quick actions.
 * Aggregates across roles with clear role-context labels.
 */
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { OrganizerActionCenter } from "@/components/dashboard/organizer-action-center";
import { EventListFilter } from "@/components/dashboard/event-list-filter";
import { ParticipantSubmissionsList } from "@/components/dashboard/participant-submissions-list";
import { SponsorEventList } from "@/components/dashboard/sponsor-event-list";
import { EmptyState } from "@/components/ui/empty-state";

interface EventMembership {
  event_id: string;
  role: string;
  status: string;
  event_title: string;
  event_state: string;
}

interface WorkspaceMembership {
  workspace_id: string;
  role: string;
  workspace_name: string;
  workspace_slug: string;
}

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // --- Fast shell data (2 queries) ---
  const [{ data: profile }, { data: rawEventMemberships }, { data: rawWorkspaceMemberships }] =
    await Promise.all([
      supabase.from("users").select("display_name").eq("id", user.id).single(),
      supabase
        .from("event_members")
        .select("event_id, role, status")
        .eq("user_id", user.id)
        .limit(20),
      supabase.from("workspace_members").select("workspace_id, role").eq("user_id", user.id),
    ]);

  if (
    !profile?.display_name ||
    profile.display_name === user.email ||
    (rawWorkspaceMemberships ?? []).length === 0
  ) {
    redirect("/onboarding");
  }

  const displayName = profile?.display_name ?? user.email ?? "User";

  // Fetch event details for memberships
  const eventIds = (rawEventMemberships ?? []).map((m) => m.event_id);
  const { data: eventsData } =
    eventIds.length > 0
      ? await supabase
          .from("events")
          .select("id, title, state, prize_pool_target, review_window_hours")
          .in("id", eventIds)
      : { data: [] };

  const eventsMap = new Map((eventsData ?? []).map((e) => [e.id, e]));

  const events: EventMembership[] = (rawEventMemberships ?? []).map((m) => {
    const event = eventsMap.get(m.event_id);
    return {
      event_id: m.event_id,
      role: m.role,
      status: m.status,
      event_title: event?.title ?? "Unknown",
      event_state: event?.state ?? "Unknown",
    };
  });

  // Fetch rich data for organizer events — needed for OrganizerActionCenter
  const organizerEventIds = (rawEventMemberships ?? [])
    .filter((m) => m.role === "Organizer")
    .map((m) => m.event_id);

  // Participant data setup
  const participantEventIds = (rawEventMemberships ?? [])
    .filter((m) => m.role === "Participant")
    .map((m) => m.event_id);

  // Sponsor data setup
  const sponsorEventIds = (rawEventMemberships ?? [])
    .filter((m) => m.role === "Sponsor")
    .map((m) => m.event_id);

  // Combined for escrow query
  const organizerSponsorParticipantEventIds = Array.from(
    new Set([...organizerEventIds, ...sponsorEventIds, ...participantEventIds]),
  );

  // --- Organizer enrichment: parallel fetch ---
  const [
    { data: pendingMembers },
    { data: judgeMembers },
    { data: userWallet },
    { data: escrowAccounts },
    { data: submissionsData },
    { data: userTeamsData },
  ] = await Promise.all([
    organizerEventIds.length > 0
      ? supabase
          .from("event_members")
          .select("event_id")
          .in("event_id", organizerEventIds)
          .eq("status", "pending")
      : Promise.resolve({ data: [] }),
    organizerEventIds.length > 0
      ? supabase
          .from("event_members")
          .select("event_id")
          .in("event_id", organizerEventIds)
          .eq("role", "Judge")
      : Promise.resolve({ data: [] }),
    supabase
      .from("wallets")
      .select("id")
      .eq("user_id", user.id)
      .eq("verification_status", "Verified")
      .limit(1)
      .maybeSingle(),
    organizerSponsorParticipantEventIds.length > 0
      ? supabase
          .from("escrow_accounts")
          .select("event_id, state, expected_balance")
          .in("event_id", organizerSponsorParticipantEventIds)
      : Promise.resolve({ data: [] }),
    organizerEventIds.length > 0
      ? supabase.from("submissions").select("id, event_id").in("event_id", organizerEventIds)
      : Promise.resolve({ data: [] }),
    participantEventIds.length > 0
      ? supabase
          .from("team_members")
          .select("event_id, team_id, teams(name)")
          .eq("user_id", user.id)
          .in("event_id", participantEventIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Fix: evaluations query — fetch by submission_id instead of broken PostgREST join filter
  const submissionIds = (submissionsData ?? []).map((s) => s.id);
  const submissionEventMap = new Map((submissionsData ?? []).map((s) => [s.id, s.event_id]));

  const { data: evaluationsData } =
    submissionIds.length > 0
      ? await supabase
          .from("evaluations")
          .select("submission_id")
          .in("submission_id", submissionIds)
      : { data: [] };

  // --- Build per-event counts ---
  const pendingByEvent = new Map<string, number>();
  for (const m of pendingMembers ?? []) {
    pendingByEvent.set(m.event_id, (pendingByEvent.get(m.event_id) ?? 0) + 1);
  }

  const judgesByEvent = new Map<string, number>();
  for (const m of judgeMembers ?? []) {
    judgesByEvent.set(m.event_id, (judgesByEvent.get(m.event_id) ?? 0) + 1);
  }

  interface EscrowInfo {
    event_id: string;
    state: string;
    expected_balance?: string;
  }
  const escrowByEvent = new Map<string, EscrowInfo>();
  for (const e of escrowAccounts ?? []) {
    escrowByEvent.set(e.event_id, e as EscrowInfo);
  }

  const submissionsByEvent = new Map<string, number>();
  for (const s of submissionsData ?? []) {
    submissionsByEvent.set(s.event_id, (submissionsByEvent.get(s.event_id) ?? 0) + 1);
  }

  // Build eval count per event using the submission→event map
  const evalsByEvent = new Map<string, number>();
  for (const ev of evaluationsData ?? []) {
    const eventId = submissionEventMap.get(ev.submission_id);
    if (eventId) evalsByEvent.set(eventId, (evalsByEvent.get(eventId) ?? 0) + 1);
  }

  // Build event summaries for OrganizerActionCenter
  const organizerEventSummaries = organizerEventIds.map((eid) => {
    const eventRecord = eventsMap.get(eid);
    return {
      id: eid,
      title: eventRecord?.title ?? "Unknown",
      state: eventRecord?.state ?? "Unknown",
      pendingMemberCount: pendingByEvent.get(eid) ?? 0,
      judgeCount: judgesByEvent.get(eid) ?? 0,
      hasWallet: !!userWallet,
      escrowState: escrowByEvent.get(eid)?.state ?? null,
      prizePoolTarget: Number(eventRecord?.prize_pool_target ?? 0) || null,
      submissionCount: submissionsByEvent.get(eid) ?? 0,
      evaluationCount: evalsByEvent.get(eid) ?? 0,
    };
  });

  // Participant Enrichment
  const participantTeamMap = new Map();
  const participantTeamIds = [];

  for (const tm of userTeamsData ?? []) {
    const teamName = Array.isArray(tm.teams)
      ? tm.teams[0]?.name
      : (tm.teams as { name: string })?.name;
    participantTeamMap.set(tm.event_id, { team_id: tm.team_id, team_name: teamName });
    participantTeamIds.push(tm.team_id);
  }

  // Fetch submissions for those participant teams
  const { data: participantSubmissionsData } =
    participantTeamIds.length > 0
      ? await supabase
          .from("submissions")
          .select("id, event_id, status, title, github_url, demo_url")
          .in("team_id", participantTeamIds)
      : { data: [] };

  const participantSubMap = new Map();
  for (const s of participantSubmissionsData ?? []) {
    participantSubMap.set(s.event_id, s);
  }

  // Fetch workspace details
  const workspaceIds = (rawWorkspaceMemberships ?? []).map((m) => m.workspace_id);
  const { data: workspacesData } =
    workspaceIds.length > 0
      ? await supabase.from("workspaces").select("id, name, slug").in("id", workspaceIds)
      : { data: [] };

  const workspacesMap = new Map((workspacesData ?? []).map((w) => [w.id, w]));

  const workspaces: WorkspaceMembership[] = (rawWorkspaceMemberships ?? []).map((m) => {
    const ws = workspacesMap.get(m.workspace_id);
    return {
      workspace_id: m.workspace_id,
      role: m.role,
      workspace_name: ws?.name ?? "Unknown",
      workspace_slug: ws?.slug ?? "",
    };
  });

  const isOrganizer = events.some((e) => e.role === "Organizer");
  const isJudge = events.some((e) => e.role === "Judge");
  const isParticipant = events.some((e) => e.role === "Participant");
  const isSponsor = events.some((e) => e.role === "Sponsor");
  const terminalStates = new Set(["Completed", "Cancelled", "Archived"]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {displayName}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {isOrganizer && "Organizer"}
            {isOrganizer && isJudge && " · "}
            {isJudge && "Judge"}
            {(isOrganizer || isJudge) && (isParticipant || isSponsor) && " · "}
            {isParticipant && "Participant"}
            {isParticipant && isSponsor && " · "}
            {isSponsor && "Sponsor"}
            {!isOrganizer &&
              !isJudge &&
              !isParticipant &&
              !isSponsor &&
              "Get started by joining an event"}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Workspaces" value={String(workspaces.length)} />
          <KpiCard
            label="Active Events"
            value={String(events.filter((e) => !terminalStates.has(e.event_state)).length)}
          />
          <KpiCard label="Roles Held" value={String(new Set(events.map((e) => e.role)).size)} />
          <KpiCard
            label="Completed"
            value={String(events.filter((e) => e.event_state === "Completed").length)}
          />
        </div>

        {/* Organizer Action Center — only shown when there are actionable tasks */}
        {isOrganizer && organizerEventSummaries.length > 0 && (
          <OrganizerActionCenter events={organizerEventSummaries} />
        )}

        <section>
          <h2 className="text-lg font-medium mb-3">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <QuickAction href="/workspaces/new" label="Create Workspace" />
            <QuickAction href="/events/new" label="Create Event" />
            <QuickAction href="/discover" label="Discover Events" />
          </div>
        </section>

        {events.length === 0 && (
          <section className="mt-8">
            <EmptyState
              title="No events yet"
              description="You aren't participating, judging, or organizing any events yet."
              action={{ label: "Discover Events", href: "/discover" }}
            />
          </section>
        )}

        {/* Role-aware Event Lists */}
        {events.filter((e) => e.role === "Participant").length > 0 && (
          <section>
            <h2 className="text-lg font-medium mb-3">My Submissions</h2>
            <ParticipantSubmissionsList
              events={events
                .filter((e) => e.role === "Participant")
                .map((e) => ({
                  event_id: e.event_id,
                  role: e.role,
                  status: e.status,
                  event_title: e.event_title,
                  event_state: e.event_state,
                  team_name: participantTeamMap.get(e.event_id)?.team_name,
                  submission_status: participantSubMap.get(e.event_id)?.status,
                  submission_title: participantSubMap.get(e.event_id)?.title,
                  submission_id: participantSubMap.get(e.event_id)?.id,
                  escrow_state: escrowByEvent.get(e.event_id)?.state,
                }))}
            />
          </section>
        )}

        {events.filter((e) => e.role === "Judge").length > 0 && (
          <section>
            <h2 className="text-lg font-medium mb-3">Judging Assignments</h2>
            <EventListFilter
              events={events
                .filter((e) => e.role === "Judge")
                .map((e) => ({
                  event_id: e.event_id,
                  role: e.role,
                  status: e.status,
                  event_title: e.event_title,
                  event_state: e.event_state,
                }))}
            />
          </section>
        )}

        {events.filter((e) => e.role === "Organizer").length > 0 && (
          <section>
            <h2 className="text-lg font-medium mb-3">Organizing</h2>
            <EventListFilter
              events={events
                .filter((e) => e.role === "Organizer")
                .map((e) => ({
                  event_id: e.event_id,
                  role: e.role,
                  status: e.status,
                  event_title: e.event_title,
                  event_state: e.event_state,
                }))}
            />
          </section>
        )}

        {events.filter((e) => e.role === "Sponsor").length > 0 && (
          <section>
            <h2 className="text-lg font-medium mb-3">Sponsoring (Funded Events)</h2>
            <SponsorEventList
              events={events
                .filter((e) => e.role === "Sponsor")
                .map((e) => {
                  const escrowInfo = (escrowByEvent.get(e.event_id) || {}) as Record<
                    string,
                    unknown
                  >;
                  return {
                    id: e.event_id,
                    title: e.event_title,
                    state: e.event_state,
                    prizePoolTarget:
                      Number(eventsMap.get(e.event_id)?.prize_pool_target ?? 0) || null,
                    escrowState: (escrowInfo.state as string) ?? null,
                    expectedBalance: (escrowInfo.expected_balance as string) ?? null,
                  };
                })}
            />
          </section>
        )}

        {workspaces.length > 0 && (
          <section>
            <h2 className="text-lg font-medium mb-3">Your Workspaces</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((ws) => (
                <a
                  key={ws.workspace_id}
                  href={
                    ws.workspace_slug
                      ? `/workspaces/${ws.workspace_slug}`
                      : `/workspaces/id/${ws.workspace_id}`
                  }
                  className="rounded-lg card p-4 hover:border-[var(--accent)] transition-colors"
                >
                  <p className="font-medium">{ws.workspace_name}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{ws.role}</p>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5 relative overflow-hidden group hover:border-[var(--accent)] hover:shadow-md transition-all duration-500 ease-out">
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-muted)]/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out" />
      <div className="relative z-10">
        <p className="text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-[0.15em] mb-2">
          {label}
        </p>
        <p className="text-3xl font-extrabold tracking-tight text-[var(--text)]">{value}</p>
      </div>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-full border border-[var(--border)] px-6 py-2.5 text-sm font-semibold text-[var(--text)] bg-[var(--bg)] hover:bg-[var(--text)] hover:text-[var(--bg)] hover:border-[var(--text)] hover:scale-105 active:scale-95 transition-all duration-300 shadow-sm"
    >
      {label}
    </a>
  );
}
