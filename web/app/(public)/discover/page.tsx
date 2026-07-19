/**
 * Public event discovery page (Req 37).
 *
 * Server Component with cursor-based pagination.
 * Displays public non-terminal events with search/filter/pagination.
 */
import { createServiceClient } from "@/lib/supabase/service";

interface SearchParams {
  search?: string;
  category?: string;
  format?: string;
  cursor?: string;
}

const PAGE_SIZE = 12;

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = createServiceClient();

  const excludedStates = ["Draft", "Cancelled"];

  let query = supabase
    .from("events")
    .select("id, title, description, tags, category, format, state, prize_pool_target, registration_deadline, created_at", { count: "exact" })
    .not("state", "in", `(${excludedStates.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1); // Fetch one extra to detect "has more"

  if (params.category) query = query.eq("category", params.category);
  if (params.format) query = query.eq("format", params.format);
  if (params.cursor) query = query.lt("created_at", params.cursor);

  // Full-text search via the fts column
  if (params.search) {
    query = query.textSearch("fts", params.search, { type: "websearch" });
  }

  const { data: rawEvents, count } = await query;
  const events = rawEvents?.slice(0, PAGE_SIZE) ?? [];
  const hasMore = (rawEvents?.length ?? 0) > PAGE_SIZE;
  const nextCursor = hasMore && events.length > 0
    ? events[events.length - 1]!.created_at
    : null;

  // Build "next page" URL
  function buildPageUrl(cursor: string | null) {
    const base = new URLSearchParams();
    if (params.search) base.set("search", params.search);
    if (params.category) base.set("category", params.category);
    if (params.format) base.set("format", params.format);
    if (cursor) base.set("cursor", cursor);
    const qs = base.toString();
    return qs ? `/discover?${qs}` : "/discover";
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">Discover Events</h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            Browse hackathons, challenges, and competitions on Stellar Guardian.
          </p>
        </div>

        {/* Filters */}
        <form className="flex flex-wrap gap-3" method="get">
          <input
            type="text"
            name="search"
            defaultValue={params.search}
            placeholder="Search events…"
            className="rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--input-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
          />
          <select
            name="category"
            defaultValue={params.category}
            className="rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)]"
          >
            <option value="">All categories</option>
            <option value="hackathon">Hackathon</option>
            <option value="challenge">Challenge</option>
            <option value="bounty">Bounty</option>
            <option value="competition">Competition</option>
          </select>
          <select
            name="format"
            defaultValue={params.format}
            className="rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)]"
          >
            <option value="">All formats</option>
            <option value="online">Online</option>
            <option value="in-person">In-person</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <button
            type="submit"
            className="btn-primary px-4 py-2 text-sm font-medium rounded-md"
          >
            Search
          </button>
          {(params.search || params.category || params.format) && (
            <a href="/discover" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] self-center">
              Clear filters
            </a>
          )}
        </form>

        {/* Result count */}
        {count !== null && (
          <p className="text-xs text-[var(--text-muted)]">
            {count} event{count !== 1 ? "s" : ""} found
          </p>
        )}

        {/* Event Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.length > 0 ? (
            events.map((event) => (
              <a
                key={event.id}
                href={`/e/${event.id}`}
                className="group card p-5 transition-colors hover:border-[var(--accent)]"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[var(--badge-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--badge-text)]">
                      {event.category}
                    </span>
                    <span className="rounded-full bg-[var(--badge-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--badge-text)]">
                      {event.state}
                    </span>
                  </div>
                  <h2 className="text-base font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                    {event.title}
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                    {event.description}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  <span>{event.format}</span>
                  {event.prize_pool_target && (
                    <span className="font-medium text-[var(--accent)]">{event.prize_pool_target} XLM</span>
                  )}
                  <span className="ml-auto">{new Date(event.created_at).toLocaleDateString()}</span>
                </div>
              </a>
            ))
          ) : (
            <div className="col-span-full card p-12 text-center">
              <p className="text-[var(--text-muted)]">No events found. Check back soon.</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {hasMore && nextCursor && (
          <div className="flex justify-center pt-4">
            <a
              href={buildPageUrl(nextCursor)}
              className="rounded-md border border-[var(--border)] px-5 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
            >
              Load more events
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
