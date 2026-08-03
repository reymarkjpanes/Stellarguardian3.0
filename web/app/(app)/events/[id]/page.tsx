import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { EventDetailClient } from "./event-detail-client";
import { getEventById } from "@/lib/data/event";
import { getCurrentUser } from "@/lib/data/user";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Both calls use the shared React.cache() — layout already called them,
  // so these return instantly from the per-request cache (zero extra DB queries).
  const [user, event] = await Promise.all([getCurrentUser(), getEventById(id)]);

  if (!event) notFound();

  const supabase = await createServerClient();

  // Parallel fetch of everything this page needs.
  const [{ data: members }, { data: teams }, { data: judgeMembers }, { data: organizerWallet }] =
    await Promise.all([
      supabase.from("event_members").select("user_id, role, availability").eq("event_id", id),
      supabase
        .from("teams")
        .select("id, name, captain_id, team_members(user_id, joined_at)")
        .eq("event_id", id),
      supabase.from("event_members").select("user_id").eq("event_id", id).eq("role", "Judge"),
      supabase
        .from("wallets")
        .select("id")
        .eq("user_id", event.organizer_id)
        .eq("verification_status", "Verified")
        .limit(1)
        .maybeSingle(),
    ]);

  const isOrganizer = user?.id === event.organizer_id;
  const myMembership = members?.find((m) => m.user_id === user?.id) ?? null;

  // Check if the current user has a verified wallet AND a submission (for milestone display)
  const [{ data: myWallet }, myTeamQuery, mySubmissionQuery] = await Promise.all([
    user
      ? supabase
          .from("wallets")
          .select("id")
          .eq("user_id", user.id)
          .eq("verification_status", "Verified")
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Find user's team in this event
    user
      ? supabase
          .from("team_members")
          .select("team_id")
          .eq("event_id", id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Check for any submission (draft or submitted)
    user
      ? supabase
          .from("submissions")
          .select("id, status")
          .eq("event_id", id)
          .eq("submitter_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // If submission is by team, also check team submissions
  const myTeamId = myTeamQuery.data?.team_id ?? null;
  let mySubmission = mySubmissionQuery.data;
  if (!mySubmission && myTeamId) {
    const { data: teamSub } = await supabase
      .from("submissions")
      .select("id, status")
      .eq("event_id", id)
      .eq("team_id", myTeamId)
      .maybeSingle();
    mySubmission = teamSub;
  }

  return (
    <EventDetailClient
      event={event}
      members={members ?? []}
      teams={teams ?? []}
      isOrganizer={isOrganizer}
      myMembership={myMembership}
      userId={user?.id ?? null}
      judgeCount={judgeMembers?.length ?? 0}
      hasVerifiedOrganizer={!!organizerWallet}
      hasVerifiedWallet={!!myWallet}
      submissionStatus={mySubmission?.status ?? null}
      reviewWindowHours={event.review_window_hours ?? 72}
    />
  );
}
