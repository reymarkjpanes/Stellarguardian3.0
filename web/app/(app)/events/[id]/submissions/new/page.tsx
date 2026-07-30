import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/user";
import { getEventById } from "@/lib/data/event";
import { HackathonSubmissionClient } from "./hackathon-submission-client";

export default async function NewSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, event] = await Promise.all([getCurrentUser(), getEventById(id)]);
  if (!user || !event) notFound();

  const supabase = await createServerClient();

  // Find user's team for this event
  const { data: teamMembership } = await supabase
    .from("team_members")
    .select("team_id, teams(name)")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!teamMembership?.team_id) {
    // Cannot create submission without a team
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="card p-8 text-center space-y-4">
          <h2 className="text-xl font-semibold">Team Required</h2>
          <p className="text-[var(--text-muted)]">
            You must be in a team to submit a project for this event.
          </p>
          <a
            href={`/events/${id}/teams`}
            className="inline-block bg-[var(--accent)] text-white px-4 py-2 rounded-md font-medium"
          >
            Go to Teams
          </a>
        </div>
      </div>
    );
  }

  // Check if a submission already exists for this team
  const { data: existingSubmission } = await supabase
    .from("submissions")
    .select("*")
    .eq("event_id", id)
    .eq("team_id", teamMembership.team_id)
    .maybeSingle();

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text)]">
          {existingSubmission ? "Edit Project Submission" : "New Project Submission"}
        </h1>
        <p className="text-[var(--text-muted)] mt-1">
          Event: {event.title} • Team: {(teamMembership.teams as any)?.name}
        </p>
      </div>

      <HackathonSubmissionClient
        eventId={id}
        teamId={teamMembership.team_id}
        initialData={existingSubmission || undefined}
      />
    </div>
  );
}
