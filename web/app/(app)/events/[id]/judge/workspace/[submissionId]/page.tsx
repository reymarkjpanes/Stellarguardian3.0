import { notFound, redirect } from "next/navigation";
import { createServerClient as createClient } from "@/lib/supabase/server";
import { EvaluationWorkspaceClient } from "@/components/events/judging/EvaluationWorkspaceClient";
import type { EvaluationScores } from "@/src/domains/judging/domain/EvaluationAggregate";

export default async function JudgingWorkspacePage(props: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  const params = await props.params;
  const { id: eventId, submissionId } = params;

  const supabase = await createClient();

  // 1. Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Fetch the Evaluation Assignment
  const { data: evaluation, error: evalError } = await supabase
    .from("evaluations")
    .select("*")
    .eq("submission_id", submissionId)
    .eq("judge_id", user.id)
    .single();

  if (evalError || !evaluation) {
    // If not assigned, or submission doesn't exist
    return notFound();
  }

  // 3. Fetch Submission Details and Assets
  const { data: submission, error: subError } = await supabase
    .from("submissions")
    .select("id, teams(name)")
    .eq("id", submissionId)
    .single();

  if (subError || !submission) {
    return notFound();
  }

  const { data: assets } = await supabase
    .from("submission_assets")
    .select("*, submission_requirements(name)")
    .eq("submission_id", submissionId);

  const assetMap = (assets || []).reduce(
    (acc, asset) => {
      const reqName = (asset.submission_requirements as { name?: string })?.name?.toLowerCase();
      if (reqName) {
        acc[reqName] = asset;
      }
      return acc;
    },
    {} as Record<string, { text_value?: string; url_value?: string }>,
  );

  const title = (submission.teams as { name?: string })?.name || "Untitled";
  const tagline = assetMap["tagline"]?.text_value || assetMap["tagline"]?.url_value;
  const description =
    assetMap["description"]?.text_value || assetMap["project description"]?.text_value;
  const repoUrl =
    assetMap["github repository"]?.url_value ||
    assetMap["repository"]?.url_value ||
    assetMap["source code"]?.url_value;
  const demoUrl =
    assetMap["demo link"]?.url_value ||
    assetMap["demo"]?.url_value ||
    assetMap["live demo"]?.url_value;
  const videoUrl =
    assetMap["video demonstration"]?.url_value ||
    assetMap["video"]?.url_value ||
    assetMap["pitch video"]?.url_value;

  // 4. Fetch Event Rubric
  const { data: criteria, error: critError } = await supabase
    .from("evaluation_criteria")
    .select("id, name, max_score, weight")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (critError) {
    throw new Error("Failed to load rubric");
  }

  // 5. Fetch all assignments for this judge in this event to determine Prev/Next navigation
  const { data: allAssignments } = await supabase
    .from("evaluations")
    .select("submission_id")
    .eq("judge_id", user.id)
    // .eq('event_id', eventId) // Optional: If we track event_id directly on evaluations
    .order("created_at", { ascending: true });

  const assignments = allAssignments || [];
  const currentIndex = assignments.findIndex((a) => a.submission_id === submissionId);
  const prevSubmissionId = currentIndex > 0 ? assignments[currentIndex - 1]?.submission_id : null;
  const nextSubmissionId =
    currentIndex < assignments.length - 1 ? assignments[currentIndex + 1]?.submission_id : null;

  // Format the data for the Client Component
  const formattedSubmission = {
    id: submission.id,
    eventId,
    title,
    tagline,
    short_description: tagline,
    detailed_description: description,
    problem_statement: assetMap["problem statement"]?.text_value,
    github_url: repoUrl,
    live_demo_url: demoUrl,
    video_url: videoUrl,
    presentation_url: assetMap["presentation"]?.url_value,
    tech_stack: assetMap["tech stack"]?.text_value
      ? assetMap["tech stack"].text_value.split(",")
      : undefined,
    screenshots: assetMap["screenshots"]?.url_value ? [assetMap["screenshots"].url_value] : [],
    teamName: title,
    status: "Submitted",
  };

  const formattedRubric = criteria.map((c) => ({
    id: c.id,
    name: c.name,
    maxScore: c.max_score,
    weight: c.weight,
    required: false, // Default fallback since column is missing on remote DB
  }));

  const initialScores: EvaluationScores = (evaluation.scores as EvaluationScores) ?? {
    criteria: [],
  };

  return (
    <EvaluationWorkspaceClient
      eventId={eventId}
      submission={formattedSubmission}
      scoring={{
        evaluationId: evaluation.id,
        eventId,
        submissionId,
        initialScores,
        expectedVersion: evaluation.version || 1, // Fallback since column missing
        rubric: formattedRubric,
        isConflict: evaluation.conflict_of_interest ?? false,
        isReadOnly:
          evaluation.status === "Submitted" ||
          evaluation.status === "Finalized" ||
          evaluation.conflict_of_interest, // Will be false if undefined
      }}
      navigation={{
        prevSubmissionId,
        nextSubmissionId,
        currentIndex: currentIndex + 1,
        totalAssigned: assignments.length,
      }}
    />
  );
}
