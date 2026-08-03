/**
 * Webhook Manager — CRUD interface for workspace webhooks (L11).
 */
"use client";

import { useState, useEffect, useCallback } from "react";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
}

export function WebhookManager({ workspaceSlug }: { workspaceSlug: string }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["event.state_changed"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadWebhooks = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/webhooks`);
      if (res.ok) {
        const { data } = await res.json();
        setWebhooks(data ?? []);
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWebhooks();
  }, [loadWebhooks]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/workspaces/${workspaceSlug}/webhooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, events }),
    });

    if (!res.ok) {
      const { error: apiErr } = await res.json();
      setError(apiErr?.message ?? "Failed to create webhook.");
    } else {
      setUrl("");
      setShowForm(false);
      loadWebhooks();
    }
    setSubmitting(false);
  }

  async function executeDelete(id: string) {
    setConfirmDeleteId(null);
    await fetch(`/api/workspaces/${workspaceSlug}/webhooks/${id}`, { method: "DELETE" });
    loadWebhooks();
  }

  async function handleToggle(id: string, active: boolean) {
    await fetch(`/api/workspaces/${workspaceSlug}/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    loadWebhooks();
  }

  const AVAILABLE_EVENTS = [
    "event.state_changed",
    "member.joined",
    "submission.created",
    "evaluation.created",
    "dispute.filed",
    "escrow.funded",
    "winner.assigned",
  ];

  if (loading) {
    return <div className="h-24 bg-[var(--bg-muted)] rounded animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text)]">Webhooks</h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm font-medium text-[var(--accent)] hover:underline"
          >
            + Add webhook
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-4 space-y-3">
          <div>
            <label htmlFor="webhook-url" className="block text-xs text-[var(--text-muted)] mb-1">
              Endpoint URL (HTTPS only)
            </label>
            <input
              id="webhook-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              pattern="https://.*"
              placeholder="https://your-server.com/webhook"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-2">Events to subscribe:</p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_EVENTS.map((ev) => (
                <label
                  key={ev}
                  className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"
                >
                  <input
                    type="checkbox"
                    checked={events.includes(ev)}
                    onChange={(e) => {
                      if (e.target.checked) setEvents([...events, ev]);
                      else setEvents(events.filter((x) => x !== ev));
                    }}
                    className="rounded"
                  />
                  {ev}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-[var(--error)]">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary px-3 py-1.5 text-xs font-medium rounded-md disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-[var(--text-muted)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {webhooks.length === 0 && !showForm && (
        <p className="text-sm text-[var(--text-muted)]">No webhooks configured.</p>
      )}

      {webhooks.length > 0 && (
        <div className="space-y-2">
          {webhooks.map((wh) => (
            <div key={wh.id} className="card p-3 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${wh.active ? "bg-green-400" : "bg-[var(--text-muted)]"}`}
                  />
                  <p className="text-sm font-mono text-[var(--text)] truncate">{wh.url}</p>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{wh.events.length} events</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleToggle(wh.id, wh.active)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  {wh.active ? "Disable" : "Enable"}
                </button>
                {confirmDeleteId === wh.id ? (
                  <div
                    role="alertdialog"
                    aria-label="Confirm webhook deletion"
                    className="flex items-center gap-1.5 rounded-md border border-[var(--error)]/40 bg-[var(--error-bg,#fef2f2)] px-2 py-1"
                  >
                    <span className="text-[10px] text-[var(--error)]">Delete?</span>
                    <button
                      onClick={() => executeDelete(wh.id)}
                      className="text-[10px] font-medium text-[var(--error)] hover:underline"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(wh.id)}
                    className="text-xs text-[var(--error)] hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
