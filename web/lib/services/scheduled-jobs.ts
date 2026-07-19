/**
 * Scheduled jobs service — background tasks for deadline enforcement,
 * challenge expiry, digest emails, and retention cleanup.
 *
 * These run via a cron-triggered API route (e.g., Vercel Cron or external
 * scheduler hitting /api/cron/* endpoints).
 */
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

/**
 * Clean up expired wallet challenges (>5 min past expiry).
 */
export async function cleanupExpiredChallenges(): Promise<number> {
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("wallet_challenges")
    .delete()
    .lt("expires_at", cutoff)
    .is("consumed_at", null)
    .select("id");

  if (error) {
    logger.error("Failed to cleanup expired challenges", { error: error.message });
    return 0;
  }

  const count = data?.length ?? 0;
  if (count > 0) logger.info("Cleaned up expired challenges", { count });
  return count;
}

/**
 * Auto-transition events past their registration deadline.
 * Moves RegistrationOpen → RegistrationClosed when deadline passes.
 */
export async function enforceDeadlines(): Promise<number> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: events } = await supabase
    .from("events")
    .select("id, state, registration_deadline, version")
    .eq("state", "RegistrationOpen")
    .lt("registration_deadline", now)
    .not("registration_deadline", "is", null);

  if (!events || events.length === 0) return 0;

  let transitioned = 0;
  for (const event of events) {
    const { error } = await supabase
      .from("events")
      .update({ state: "RegistrationClosed", version: event.version + 1, updated_at: now })
      .eq("id", event.id)
      .eq("version", event.version);

    if (!error) transitioned++;
  }

  if (transitioned > 0) {
    logger.info("Auto-transitioned events past deadline", { count: transitioned });
  }
  return transitioned;
}

/**
 * Enforce data retention — archive old completed events.
 * Events completed more than retention_days ago get archived.
 */
export async function enforceRetention(): Promise<number> {
  const supabase = createServiceClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, retention_days, updated_at, version")
    .eq("state", "Completed");

  if (!events || events.length === 0) return 0;

  let archived = 0;
  const now = new Date();

  for (const event of events) {
    const completedAt = new Date(event.updated_at);
    const retentionMs = (event.retention_days ?? 90) * 24 * 60 * 60 * 1000;

    if (now.getTime() - completedAt.getTime() > retentionMs) {
      const { error } = await supabase
        .from("events")
        .update({ state: "Archived", version: event.version + 1, updated_at: now.toISOString() })
        .eq("id", event.id)
        .eq("version", event.version);

      if (!error) archived++;
    }
  }

  if (archived > 0) {
    logger.info("Archived events past retention", { count: archived });
  }
  return archived;
}

/**
 * Cleanup expired idempotency records (>24h old).
 */
export async function cleanupIdempotencyRecords(): Promise<number> {
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("idempotency_keys")
    .delete()
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    logger.error("Failed to cleanup idempotency records", { error: error.message });
    return 0;
  }

  return data?.length ?? 0;
}
