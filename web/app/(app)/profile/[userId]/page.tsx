/**
 * Public user profile page.
 */
import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createServerClient();

  const { data: profile } = await supabase
    .from("users")
    .select("id, display_name, created_at")
    .eq("id", userId)
    .single();

  if (!profile) redirect("/discover");

  // Get event participations
  const { data: memberships } = await supabase
    .from("event_members")
    .select("event_id, role, status")
    .eq("user_id", userId)
    .limit(20);

  const eventIds = (memberships ?? []).map((m) => m.event_id);
  const { data: events } = eventIds.length > 0
    ? await supabase.from("events").select("id, title, state").in("id", eventIds)
    : { data: [] };

  const eventsMap = new Map((events ?? []).map((e) => [e.id, e]));

  // Get verified wallet (public info only)
  const { data: wallet } = await supabase
    .from("wallets")
    .select("public_key, network_mode")
    .eq("user_id", userId)
    .eq("verification_status", "Verified")
    .maybeSingle();

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-[var(--bg-muted)] flex items-center justify-center text-xl font-bold text-[var(--text)]">
          {profile.display_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{profile.display_name}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Member since {new Date(profile.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
          </p>
        </div>
      </div>

      {wallet && (
        <div className="card p-4 flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            {wallet.public_key.slice(0, 8)}…{wallet.public_key.slice(-8)}
          </span>
          <span className="text-xs text-[var(--text-muted)]">{wallet.network_mode}</span>
        </div>
      )}

      <section>
        <h2 className="text-lg font-medium mb-3">Event Participation</h2>
        {memberships && memberships.length > 0 ? (
          <div className="space-y-2">
            {memberships.map((m) => {
              const event = eventsMap.get(m.event_id);
              return (
                <a
                  key={`${m.event_id}-${m.role}`}
                  href={`/events/${m.event_id}`}
                  className="block card p-4 hover:border-[var(--accent)] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[var(--text)]">{event?.title ?? "Event"}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{event?.state}</p>
                    </div>
                    <span className="rounded-full bg-[var(--bg-muted)] px-2.5 py-0.5 text-xs font-medium">
                      {m.role}
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No event participation yet.</p>
        )}
      </section>
    </main>
  );
}
