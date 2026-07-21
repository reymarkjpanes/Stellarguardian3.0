/**
 * Cron: Auto-transition events (H9 — registration deadline enforcement).
 *
 * Runs every 5 minutes via Vercel Cron or external scheduler.
 * - Closes expired registrations (RegistrationOpen → RegistrationClosed)
 *
 * Authentication: Requires Bearer CRON_SECRET in Authorization header.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyCronAuth } from "@/lib/cron-auth";
import { writeAuditRecord } from "@/lib/services/audit";

export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceClient();
  const results: string[] = [];

  // --- Registration deadline enforcement ---
  const { data: expired } = await supabase
    .from("events")
    .select("id, version, title")
    .eq("state", "RegistrationOpen")
    .lt("registration_deadline", new Date().toISOString())
    .not("registration_deadline", "is", null);

  for (const event of expired ?? []) {
    const { error } = await supabase
      .from("events")
      .update({ state: "RegistrationClosed", version: event.version + 1 })
      .eq("id", event.id)
      .eq("version", event.version); // Optimistic lock — skip if already changed

    if (!error) {
      results.push(`Closed registration: ${event.title} (${event.id})`);
      await writeAuditRecord({
        action: "event.state_transition",
        actor_id: "system",
        event_id: event.id,
        resource_type: "events",
        resource_id: event.id,
        metadata: {
          from_state: "RegistrationOpen",
          to_state: "RegistrationClosed",
          trigger: "registration_deadline_passed",
        },
      });
    }
  }

  // --- Dispute auto-dismiss (M8) ---
  const { data: expiredDisputes } = await supabase
    .from("disputes")
    .select("id, event_id, filed_by")
    .eq("state", "Open")
    .lt("deadline", new Date().toISOString())
    .not("deadline", "is", null);

  for (const dispute of expiredDisputes ?? []) {
    const { error } = await supabase
      .from("disputes")
      .update({
        state: "Dismissed",
        resolution: "Auto-dismissed: deadline expired without resolution.",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", dispute.id)
      .eq("state", "Open"); // Guard: only dismiss if still Open

    if (!error) {
      results.push(`Auto-dismissed dispute: ${dispute.id}`);
      await writeAuditRecord({
        action: "dispute.transition",
        actor_id: "system",
        event_id: dispute.event_id,
        resource_type: "disputes",
        resource_id: dispute.id,
        metadata: {
          from_state: "Open",
          to_state: "Dismissed",
          trigger: "deadline_expired",
        },
      });
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    details: results,
    timestamp: new Date().toISOString(),
  });
}
