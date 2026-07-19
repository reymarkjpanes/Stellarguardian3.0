/**
 * Public event detail page — viewable without authentication.
 * Route: /e/[id] (short, shareable URL for public viewing)
 *
 * Server Component using service client (bypasses RLS for public read).
 * Includes dynamic metadata for SEO and Open Graph sharing (M21).
 */
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { createServerClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("title, description, category, prize_pool_target")
    .eq("id", id)
    .single();

  if (!event) return { title: "Event Not Found" };

  const description = event.description?.slice(0, 160) ?? "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    title: `${event.title} | Stellar Guardian`,
    description,
    openGraph: {
      title: event.title,
      description,
      type: "website",
      url: `${siteUrl}/e/${id}`,
      siteName: "Stellar Guardian",
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
    },
  };
}

export default async function PublicEventDetailPage({ params }: PageProps) {
  const { id: eventId } = await params;

  // If user is authenticated, redirect to the full event detail page
  const authSupabase = await createServerClient();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (user) {
    redirect(`/events/${eventId}`);
  }

  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, title, description, category, format, state, prize_pool_target, network_mode, team_size_min, team_size_max, registration_deadline, created_at")
    .eq("id", eventId)
    .not("state", "eq", "Draft")
    .single();

  if (!event) {
    notFound();
  }

  const { count: memberCount } = await supabase
    .from("event_members")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "accepted");

  const { count: teamCount } = await supabase
    .from("teams")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);

  const isRegistrationOpen = event.state === "RegistrationOpen";

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <div className="space-y-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <a href="/discover" className="hover:text-[var(--text)]">Events</a>
          <span>›</span>
          <span className="text-[var(--text)]">{event.title}</span>
        </div>

        {/* Header */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--badge-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--badge-text)]">
              {event.category}
            </span>
            <span className="rounded-full bg-[var(--badge-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--badge-text)]">
              {event.format}
            </span>
            <span className="rounded-full bg-[var(--badge-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--badge-text)]">
              {event.state}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text)]">
            {event.title}
          </h1>
        </div>

        {/* Key metrics */}
        <div className="grid gap-4 sm:grid-cols-4">
          <MetricCard label="Prize Pool" value={event.prize_pool_target ? `${event.prize_pool_target} XLM` : "TBD"} />
          <MetricCard label="Participants" value={String(memberCount ?? 0)} />
          <MetricCard label="Teams" value={String(teamCount ?? 0)} />
          <MetricCard label="Team Size" value={`${event.team_size_min}–${event.team_size_max}`} />
        </div>

        {/* Description */}
        <div className="card p-6">
          <h2 className="font-medium text-[var(--text)] mb-3">About this event</h2>
          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
            {event.description}
          </p>
        </div>

        {/* Details */}
        <div className="card p-6 space-y-3">
          <h2 className="font-medium text-[var(--text)] mb-2">Details</h2>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-[var(--text-muted)]">Network</p>
              <p className="text-[var(--text)] font-mono text-xs mt-0.5">{event.network_mode}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">Created</p>
              <p className="text-[var(--text)] mt-0.5">{new Date(event.created_at).toLocaleDateString()}</p>
            </div>
            {event.registration_deadline && (
              <div>
                <p className="text-[var(--text-muted)]">Registration deadline</p>
                <p className="text-[var(--text)] mt-0.5">{new Date(event.registration_deadline).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="card p-8 text-center space-y-4">
          {isRegistrationOpen ? (
            <>
              <h3 className="text-lg font-medium text-[var(--text)]">Registration is open</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Sign in or create an account to participate in this event.
              </p>
              <div className="flex items-center justify-center gap-3">
                <a
                  href={`/login?redirect=/events/${event.id}`}
                  className="rounded-md bg-[var(--btn-primary-bg)] px-5 py-2.5 text-sm font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors"
                >
                  Sign in to register
                </a>
                <a
                  href={`/signup?redirect=/events/${event.id}`}
                  className="rounded-md border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
                >
                  Create account
                </a>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-[var(--text)]">Want to participate?</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Sign in to view full event details and track progress.
              </p>
              <a
                href={`/login?redirect=/events/${event.id}`}
                className="inline-block rounded-md bg-[var(--btn-primary-bg)] px-5 py-2.5 text-sm font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors"
              >
                Sign in
              </a>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}
