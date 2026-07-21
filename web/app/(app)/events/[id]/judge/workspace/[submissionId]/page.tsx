import { notFound, redirect } from 'next/navigation';
import { createServerClient as createClient } from '@/lib/supabase/server';
import { EvaluationWorkspaceClient } from '@/components/events/judging/EvaluationWorkspaceClient';

export default async function JudgingWorkspacePage(props: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  const params = await props.params;
  const { id: eventId, submissionId } = params;

  const supabase = await createClient();

  // 1. Get the current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // 2. Fetch the Evaluation Assignment
  const { data: evaluation, error: evalError } = await supabase
    .from('evaluations')
    .select('*')
    .eq('submission_id', submissionId)
    .eq('judge_id', user.id)
    .single();

  if (evalError || !evaluation) {
    // If not assigned, or submission doesn't exist
    return notFound();
  }

  // 3. Fetch Submission Details
  const { data: submission, error: subError } = await supabase
    .from('submissions')
    .select('id, title, tagline, description, repo_url, demo_url, video_url')
    .eq('id', submissionId)
    .single();

  if (subError || !submission) {
    return notFound();
  }

  // 4. Fetch Event Rubric
  const { data: criteria, error: critError } = await supabase
    .from('evaluation_criteria')
    .select('id, name, max_score, weight, required')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (critError) {
    throw new Error('Failed to load rubric');
  }

  // 5. Fetch all assignments for this judge in this event to determine Prev/Next navigation
  const { data: allAssignments } = await supabase
    .from('evaluations')
    .select('submission_id')
    .eq('judge_id', user.id)
    // .eq('event_id', eventId) // Optional: If we track event_id directly on evaluations
    .order('created_at', { ascending: true });

  const assignments = allAssignments || [];
  const currentIndex = assignments.findIndex(a => a.submission_id === submissionId);
  const prevSubmissionId = currentIndex > 0 ? assignments[currentIndex - 1]?.submission_id : null;
  const nextSubmissionId = currentIndex < assignments.length - 1 ? assignments[currentIndex + 1]?.submission_id : null;

  // Format the data for the Client Component
  const formattedSubmission = {
    id: submission.id,
    title: submission.title,
    tagline: submission.tagline || undefined,
    description: submission.description || undefined,
    repoUrl: submission.repo_url || undefined,
    demoUrl: submission.demo_url || undefined,
    videoUrl: submission.video_url || undefined,
  };

  const formattedRubric = criteria.map(c => ({
    id: c.id,
    name: c.name,
    maxScore: c.max_score,
    weight: c.weight,
    required: c.required
  }));

  const initialScores = (evaluation.scores as any) || { criteria: [] };

  return (
    <EvaluationWorkspaceClient
      eventId={eventId}
      submission={formattedSubmission}
      scoring={{
        evaluationId: evaluation.id,
        eventId,
        submissionId,
        initialScores,
        expectedVersion: evaluation.version,
        rubric: formattedRubric,
        isReadOnly: evaluation.status === 'Submitted' || evaluation.status === 'Finalized'
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
