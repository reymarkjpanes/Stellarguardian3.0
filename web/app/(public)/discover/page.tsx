/**
 * Public event discovery page (Req 37).
 *
 * Server Component that fetches and displays public non-terminal events
 * matching filters with search, category, and format options.
 */
import { createServiceClient } from "@/lib/supabase/service";

interface SearchParams {
  search?: string;
  category?: string;
  format?: string;
  page?: string;
}

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
    .select("id, title, description, tags, category, format, state, prize_pool_target, registration_deadline, created_at")
    .not("state", "in", `(${excludedStates.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (params.category) query = query.eq("category", params.category);
  if (params.format) query = query.eq("format", params.format);

  const { data: events } = await query;

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Discover Events</h1>
          <p className="mt-2 text-neutral-500">
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
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
          <select
            name="category"
            defaultValue={params.category}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            <option value="hackathon">Hackathon</option>
            <option value="challenge">Challenge</option>
            <option value="bounty">Bounty</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Search
          </button>
        </form>

        {/* Event Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events && events.length > 0 ? (
            events.map((event) => (
              <a
                key={event.id}
                href={`/events/${event.id}`}
                className="group rounded-lg border border-neutral-200 p-5 transition-colors hover:border-neutral-400"
              >
                <div className="space-y-2">
                  <span className="inline-block rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                    {event.category}
                  </span>
                  <h2 className="text-lg font-medium group-hover:text-neutral-700">
                    {event.title}
                  </h2>
                  <p className="text-sm text-neutral-500 line-clamp-2">
                    {event.description}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-3 text-xs text-neutral-400">
                  <span>{event.state}</span>
                  {event.prize_pool_target && (
                    <span>Prize: {event.prize_pool_target} XLM</span>
                  )}
                </div>
              </a>
            ))
          ) : (
            <p className="col-span-full text-center text-neutral-500 py-12">
              No events found. Check back soon.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
