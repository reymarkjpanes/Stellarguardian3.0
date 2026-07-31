/**
 * Event registration page — dedicated page for participant signup flow.
 */
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { BackButton } from "@/components/ui/back-button";

export default function EventRegisterPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/login?redirect=/events/${eventId}/register`);
        return;
      }

      const { data: eventData } = await supabase
        .from("events")
        .select(
          "id, title, description, state, category, format, registration_deadline, team_size_min, team_size_max, prize_pool_target",
        )
        .eq("id", eventId)
        .single();

      if (!eventData) {
        router.push("/discover");
        return;
      }

      if (!ignore) {
        setEvent(eventData);

        // Check existing registration
        const { data: existing } = await supabase
          .from("event_members")
          .select("role")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existing) setAlreadyRegistered(true);
        setLoading(false);
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [eventId, router]);

  async function handleRegister() {
    setRegistering(true);
    setError(null);

    const res = await fetch(`/api/events/${eventId}/register`, {
      method: "POST",
    });

    if (!res.ok) {
      const { error: err } = await res.json();
      setError(err?.message ?? "Registration failed.");
      setRegistering(false);
      return;
    }

    setSuccess(true);
    setRegistering(false);
  }

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div>
          <div className="h-4 w-24 bg-[var(--bg-muted)] rounded mb-6" />
          <div className="h-8 w-64 bg-[var(--bg-muted)] rounded" />
          <div className="h-4 w-48 bg-[var(--bg-muted)] rounded mt-2" />
        </div>
        <div className="card p-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="h-3 w-16 bg-[var(--bg-muted)] rounded" />
              <div className="h-4 w-24 bg-[var(--bg-muted)] rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-20 bg-[var(--bg-muted)] rounded" />
              <div className="h-4 w-24 bg-[var(--bg-muted)] rounded" />
            </div>
          </div>
          <div className="h-16 w-full bg-[var(--bg-muted)] rounded" />
          <div className="h-10 w-full bg-[var(--bg-muted)] rounded" />
        </div>
      </main>
    );
  }

  if (!event) return null;

  const isOpen = event.state === "RegistrationOpen";

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <div>
        <BackButton href={`/events/${eventId}`} label="Back to Event" />
        <h1 className="text-2xl font-semibold tracking-tight mt-3">
          Register for {String(event.title)}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {String(event.category)} · {String(event.format)}
        </p>
      </div>

      <div className="card p-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-[var(--text-muted)]">Team Size</p>
            <p className="text-sm font-medium">
              {String(event.team_size_min)}–{String(event.team_size_max)} members
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Prize Pool</p>
            <p className="text-sm font-medium">
              {event.prize_pool_target ? `${String(event.prize_pool_target)} XLM` : "TBD"}
            </p>
          </div>
          {event.registration_deadline ? (
            <div>
              <p className="text-xs text-[var(--text-muted)]">Deadline</p>
              <p className="text-sm font-medium">
                {new Date(String(event.registration_deadline)).toLocaleDateString()}
              </p>
            </div>
          ) : null}
        </div>

        {success ? (
          <div className="rounded-md bg-green-50 border border-green-200 p-6 dark:bg-green-900/20 dark:border-green-800 text-center space-y-3">
            <div className="text-2xl">🎉</div>
            <p className="text-base font-medium text-green-800 dark:text-green-300">
              You have successfully registered for {String(event.title)}!
            </p>
            <p className="text-sm text-green-700 dark:text-green-400 max-w-sm mx-auto">
              Your next step is to form a team. You can create a new team or request to join an
              existing one.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <a
                href={`/events/${eventId}/teams`}
                className="inline-block bg-green-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-green-700 transition-colors"
              >
                Go to Teams
              </a>
              <a
                href={`/events/${eventId}`}
                className="inline-block text-green-700 hover:underline text-sm font-medium"
              >
                Event Overview
              </a>
            </div>
          </div>
        ) : alreadyRegistered ? (
          <div className="rounded-md bg-blue-50 border border-blue-200 p-6 dark:bg-blue-900/20 dark:border-blue-800 text-center space-y-3">
            <p className="text-base font-medium text-blue-800 dark:text-blue-300">
              You&apos;re already registered for this event.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={`/events/${eventId}/teams`}
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-blue-700 transition-colors"
              >
                Manage Team
              </a>
              <a
                href={`/events/${eventId}`}
                className="inline-block text-blue-700 hover:underline text-sm font-medium"
              >
                Event Overview
              </a>
            </div>
          </div>
        ) : !isOpen ? (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-4 dark:bg-amber-900/20 dark:border-amber-800">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Registration is not currently open (state: {String(event.state)}).
            </p>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              if (!formData.get("terms")) {
                setError("You must accept the event rules and terms to register.");
                return;
              }
              handleRegister();
            }}
          >
            <div className="flex items-start gap-2 p-3 border border-[var(--border)] rounded-md bg-[var(--bg-muted)]/50">
              <input
                type="checkbox"
                id="terms"
                name="terms"
                className="mt-1 rounded border-gray-300 text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              <label
                htmlFor="terms"
                className="text-sm text-[var(--text-secondary)] leading-relaxed cursor-pointer"
              >
                I agree to participate in good faith and abide by the{" "}
                <a
                  href={`/events/${eventId}`}
                  className="text-[var(--accent)] hover:underline"
                  target="_blank"
                >
                  event rules
                </a>{" "}
                and the platform&apos;s{" "}
                <a href="/terms" className="text-[var(--accent)] hover:underline" target="_blank">
                  Terms of Service
                </a>
                .
              </label>
            </div>

            {error && <p className="text-sm text-[var(--error)]">{error}</p>}

            <button
              type="submit"
              disabled={registering}
              className="btn-primary w-full py-2.5 text-sm font-medium rounded-md disabled:opacity-50"
            >
              {registering ? "Registering..." : "Confirm Registration"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
