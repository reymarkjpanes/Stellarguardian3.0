"use client";

/**
 * Submissions client component — handles submit project form interaction only.
 * All data is passed as props from the Server Component parent; no Supabase calls here.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Submission {
  id: string;
  team_id: string | null;
  submitter_id: string;
  status: string;
  current_version: number;
  updated_at: string;
  team_name?: string;
  submitter_name?: string;
}

interface SubmissionsClientProps {
  eventId: string;
  eventState: string;
  submissions: Submission[];
  userRole: string | null;
}

export function SubmissionsClient({
  eventId,
  eventState,
  submissions,
  userRole,
}: SubmissionsClientProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = userRole === "Participant" && eventState === "SubmissionOpen";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          project_url: projectUrl || undefined,
        }),
      });

      if (!res.ok) {
        let message = "Failed to submit.";
        try {
          const body = await res.json();
          message = body?.error?.message ?? message;
        } catch {
          message = `Server error (${res.status})`;
        }
        setError(message);
        setSubmitting(false);
        return;
      }

      setTitle("");
      setDescription("");
      setProjectUrl("");
      setShowForm(false);
      setSubmitting(false);
      // Refresh server data
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Submissions</h2>
        {canSubmit && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary px-4 py-1.5 text-sm font-medium rounded-md"
          >
            Submit Project
          </button>
        )}
      </div>

      {/* Submission form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label
              htmlFor="sub-title"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              Project Title
            </label>
            <input
              id="sub-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label
              htmlFor="sub-url"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              Project URL (GitHub, demo, etc.)
            </label>
            <input
              id="sub-url"
              type="url"
              value={projectUrl}
              onChange={(e) => setProjectUrl(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label
              htmlFor="sub-desc"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              Description
            </label>
            <textarea
              id="sub-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          {error && <p className="text-sm text-[var(--error)]">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary px-5 py-2 text-sm font-medium rounded-md disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Submissions list */}
      {submissions.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            {eventState === "SubmissionOpen"
              ? "No submissions yet."
              : "Submissions will be accepted during the SubmissionOpen phase."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {submissions.map((sub) => (
            <div key={sub.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[var(--text)]">
                    {sub.team_name ?? sub.submitter_name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    v{sub.current_version} · {sub.status} · Updated{" "}
                    {new Date(sub.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    sub.status === "Submitted"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-[var(--bg-muted)] text-[var(--text-secondary)]"
                  }`}
                >
                  {sub.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
