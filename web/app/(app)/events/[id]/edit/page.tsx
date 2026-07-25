/**
 * Event edit page — modify event details (organizer only).
 */
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export default function EventEditPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [format, setFormat] = useState("");
  const [teamSizeMin, setTeamSizeMin] = useState(1);
  const [teamSizeMax, setTeamSizeMax] = useState(5);
  const [prizePool, setPrizePool] = useState("");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    async function loadEvent() {
      const supabase = createBrowserClient();
      const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();

      if (!event) {
        router.push("/dashboard");
        return;
      }

      setTitle(event.title);
      setDescription(event.description);
      setCategory(event.category);
      setFormat(event.format);
      setTeamSizeMin(event.team_size_min);
      setTeamSizeMax(event.team_size_max);
      setPrizePool(event.prize_pool_target?.toString() ?? "");
      setDeadline(event.registration_deadline?.slice(0, 16) ?? "");
      setLoading(false);
    }

    loadEvent();
  }, [eventId, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        category,
        format,
        team_size_min: teamSizeMin,
        team_size_max: teamSizeMax,
        prize_pool_target: prizePool ? Number(prizePool) : null,
        registration_deadline: deadline ? new Date(deadline).toISOString() : null,
      }),
    });

    if (!res.ok) {
      const { error: err } = await res.json();
      setError(err?.message ?? "Failed to save.");
    } else {
      router.push(`/events/${eventId}`);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse h-8 w-48 bg-[var(--bg-muted)] rounded" />
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit Event</h1>

      <form onSubmit={handleSave} className="space-y-6">
        <fieldset className="card p-6 space-y-4">
          <div>
            <label
              htmlFor="evt-title"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              Title
            </label>
            <input
              id="evt-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label
              htmlFor="evt-desc"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              Description
            </label>
            <textarea
              id="evt-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              required
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="evt-cat"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
              >
                Category
              </label>
              <input
                id="evt-cat"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div>
              <label
                htmlFor="evt-fmt"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
              >
                Format
              </label>
              <input
                id="evt-fmt"
                type="text"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                required
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="evt-min"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
              >
                Min Team Size
              </label>
              <input
                id="evt-min"
                type="number"
                min={1}
                value={teamSizeMin}
                onChange={(e) => setTeamSizeMin(+e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div>
              <label
                htmlFor="evt-max"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
              >
                Max Team Size
              </label>
              <input
                id="evt-max"
                type="number"
                min={1}
                value={teamSizeMax}
                onChange={(e) => setTeamSizeMax(+e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div>
              <label
                htmlFor="evt-prize"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
              >
                Prize Pool (XLM)
              </label>
              <input
                id="evt-prize"
                type="number"
                min={0}
                step="any"
                value={prizePool}
                onChange={(e) => setPrizePool(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="evt-deadline"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              Registration Deadline
            </label>
            <input
              id="evt-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        </fieldset>

        {error && <p className="text-sm text-[var(--error)]">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary px-5 py-2 text-sm font-medium rounded-md disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <a
            href={`/events/${eventId}`}
            className="rounded-md border border-[var(--border)] px-5 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)]"
          >
            Cancel
          </a>
        </div>
      </form>
    </main>
  );
}
