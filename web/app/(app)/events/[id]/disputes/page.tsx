/**
 * Event disputes page — Server Component.
 * Fetches all data in parallel server-side, passes to client component for form interactions.
 */
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/user";
import { getEventById } from "@/lib/data/event";
import { DisputesClient } from "./disputes-client";

export default async function EventDisputesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, event] = await Promise.all([getCurrentUser(), getEventById(id)]);
  if (!event) notFound();

  const supabase = await createServerClient();

  const [{ data: disputesRaw }, { data: membership }] = await Promise.all([
    supabase
      .from("disputes")
      .select("id, filed_by, state, description, created_at")
      .eq("event_id", id)
      .order("created_at", { ascending: false }),
    user
      ? supabase
          .from("event_members")
          .select("role")
          .eq("event_id", id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Enrich disputes with filer display names
  type EnrichedDispute = {
    id: string;
    filed_by: string;
    state: string;
    description: string;
    created_at: string;
    filer_name: string;
  };

  let disputes: EnrichedDispute[] = [];

  if (disputesRaw && disputesRaw.length > 0) {
    const filerIds = [...new Set(disputesRaw.map((d) => d.filed_by))];
    const { data: usersData } = await supabase
      .from("users")
      .select("id, display_name")
      .in("id", filerIds);

    const usersMap = new Map((usersData ?? []).map((u) => [u.id, u.display_name]));

    disputes = disputesRaw.map((d) => ({
      ...d,
      filer_name: usersMap.get(d.filed_by) ?? "Unknown",
    }));
  }

  return (
    <DisputesClient
      eventId={id}
      eventState={event.state}
      disputes={disputes}
      userRole={membership?.role ?? null}
    />
  );
}
