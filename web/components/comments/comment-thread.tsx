/**
 * Comment Thread — reusable threaded comments component.
 * Can be used on events, submissions, or disputes (M14).
 */
"use client";

import { useState, useEffect, useCallback } from "react";

interface Comment {
  id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  users?: { display_name: string } | null;
}

interface CommentThreadProps {
  eventId?: string;
  submissionId?: string;
  disputeId?: string;
}

export function CommentThread({ eventId, submissionId, disputeId }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    const params = new URLSearchParams();
    if (eventId) params.set("event_id", eventId);
    if (submissionId) params.set("submission_id", submissionId);
    if (disputeId) params.set("dispute_id", disputeId);

    try {
      const res = await fetch(`/api/comments?${params.toString()}`);
      if (res.ok) {
        const { data } = await res.json();
        setComments(data ?? []);
      }
    } catch {
      // Non-critical — comments silently fail
    } finally {
      setLoading(false);
    }
  }, [eventId, submissionId, disputeId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadComments();
  }, [loadComments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    setError(null);

    const body: Record<string, string> = { body: newComment };
    if (eventId) body.event_id = eventId;
    if (submissionId) body.submission_id = submissionId;
    if (disputeId) body.dispute_id = disputeId;

    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const { error: apiErr } = await res.json();
      setError(apiErr?.message ?? "Failed to post comment.");
    } else {
      setNewComment("");
      loadComments();
    }
    setSubmitting(false);
  }

  if (loading) {
    return <div className="h-16 bg-[var(--bg-muted)] rounded animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-[var(--text)]">Comments ({comments.length})</h3>

      {/* Comment list */}
      {comments.length > 0 && (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="h-6 w-6 rounded-full bg-[var(--bg-muted)] flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)] shrink-0">
                {(comment.users?.display_name ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-[var(--text)]">
                    {comment.users?.display_name ?? "Anonymous"}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {formatTime(comment.created_at)}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5 whitespace-pre-wrap">
                  {comment.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New comment form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment…"
          className="flex-1 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={submitting || !newComment.trim()}
          className="btn-primary px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50"
        >
          {submitting ? "…" : "Post"}
        </button>
      </form>
      {error && <p className="text-xs text-[var(--error)]">{error}</p>}
    </div>
  );
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return new Date(iso).toLocaleDateString();
}
