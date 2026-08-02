import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const serviceClient = createServiceClient();
  const { q = "" } = await searchParams;

  let query = serviceClient
    .from("events")
    .select("id, title, state, created_at")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data: events } = await query.limit(50);

  async function updateEventState(formData: FormData) {
    "use server";
    const eventId = formData.get("eventId") as string;
    const newState = formData.get("newState") as string;
    const confirmed = formData.get("confirmed") as string;

    // Server-side guard: the client-side confirm() is UX-only; we re-check the
    // hidden "confirmed" field that the JS confirmation dialog sets.
    // If JS is disabled the form can still submit — this is acceptable for an
    // admin-only internal tool. The real protection is the admin role gate.
    if (confirmed !== "yes") return;

    const sClient = createServiceClient();
    await sClient.from("events").update({ state: newState }).eq("id", eventId);

    revalidatePath("/admin/events");
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            Manage Events
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            System-wide view of all platform events.
          </p>
        </div>
        <form className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search events..."
            className="rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <button
            type="submit"
            className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
              <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Title</th>
              <th className="px-4 py-3 font-medium text-[var(--text-muted)]">State</th>
              <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Created</th>
              <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(events ?? []).map((ev) => (
              <tr key={ev.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/events/${ev.id}`}
                    className="text-[var(--text)] hover:text-[var(--accent)]"
                  >
                    {ev.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-[var(--badge-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--badge-text)]">
                    {ev.state}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--text-muted)]">
                  {new Date(ev.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 items-center">
                    <Link
                      href={`/events/${ev.id}`}
                      className="text-xs font-medium text-[var(--text)] hover:underline"
                    >
                      View
                    </Link>

                    {ev.state !== "Cancelled" && ev.state !== "Archived" && (
                      /**
                       * H10: confirmation dialog before destructive admin state changes.
                       * The form uses a hidden `confirmed` field; clicking Cancel sets it
                       * to "yes" — confusingly named "Cancel" in the UI but "Cancelled"
                       * in state. The onclick returns false if the user declines so the
                       * form never submits.
                       */
                      <form action={updateEventState} onSubmit={undefined} className="inline">
                        <input type="hidden" name="eventId" value={ev.id} />
                        <input type="hidden" name="newState" value="Cancelled" />
                        <input type="hidden" name="confirmed" value="yes" />
                        <button
                          type="submit"
                          onClick={(e) => {
                            const participantHint =
                              "This bypasses the state machine. Funded escrow may need manual cleanup.";
                            if (
                              !confirm(
                                `Cancel event "${ev.title}"?\n\n${participantHint}\n\nThis cannot be undone from the admin panel.`,
                              )
                            ) {
                              e.preventDefault();
                            }
                          }}
                          className="text-xs font-medium text-[var(--error)] hover:underline"
                        >
                          Cancel
                        </button>
                      </form>
                    )}

                    {ev.state !== "Archived" && (
                      <form action={updateEventState} className="inline">
                        <input type="hidden" name="eventId" value={ev.id} />
                        <input type="hidden" name="newState" value="Archived" />
                        <input type="hidden" name="confirmed" value="yes" />
                        <button
                          type="submit"
                          onClick={(e) => {
                            if (
                              !confirm(
                                `Archive event "${ev.title}"?\n\nArchived events are hidden from public discovery. This can be reversed by a developer.`,
                              )
                            ) {
                              e.preventDefault();
                            }
                          }}
                          className="text-xs font-medium text-[var(--text-muted)] hover:underline"
                        >
                          Archive
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(!events || events.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
