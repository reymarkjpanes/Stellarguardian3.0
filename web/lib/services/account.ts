/**
 * Account Deactivation, Deletion, and Data Export (Req 35.1-35.5).
 *
 * Supports account deactivation (disable login, hide profile) preserving
 * financial/audit records. Blocks deletion with active financial obligations.
 * Anonymizes deletable fields. Provides GDPR-style data export.
 */
import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { writeAuditRecord } from "./audit";
import { BadRequestError } from "@/lib/errors";

/**
 * Deactivate an account (Req 35.1).
 * Disables login, hides profile. Financial/audit records preserved.
 */
export async function deactivateAccount(userId: string): Promise<void> {
  const supabase = createServiceClient();

  await supabase
    .from("users")
    .update({ deactivated_at: new Date().toISOString() })
    .eq("id", userId);

  await writeAuditRecord({
    action: "account.deactivate",
    actor_id: userId,
    resource_type: "users",
    resource_id: userId,
  });
}

/**
 * Check if an account can be deleted (Req 35.2).
 * Blocks if the user has active financial obligations.
 */
export async function canDeleteAccount(userId: string): Promise<{
  canDelete: boolean;
  blockers: string[];
}> {
  const supabase = createServiceClient();
  const blockers: string[] = [];

  // Check for pending escrow operations
  const { data: pendingEscrows } = await supabase
    .from("escrow_accounts")
    .select("id, events!inner(organizer_id)")
    .eq("events.organizer_id", userId)
    .in("state", ["PendingFunding", "PartiallyFunded", "FullyFunded", "Locked", "PendingRelease"]);

  if (pendingEscrows && pendingEscrows.length > 0) {
    blockers.push(`${pendingEscrows.length} active escrow account(s) require resolution.`);
  }

  // Check for pending disbursements
  const { data: pendingWins } = await supabase
    .from("winners")
    .select("id")
    .eq("recipient_id", userId)
    .eq("disbursement_status", "pending");

  if (pendingWins && pendingWins.length > 0) {
    blockers.push(`${pendingWins.length} pending prize disbursement(s).`);
  }

  return { canDelete: blockers.length === 0, blockers };
}

/**
 * Delete an account (Req 35.3, 35.4).
 * Anonymizes personal fields, retains immutable compliance data.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const { canDelete, blockers } = await canDeleteAccount(userId);
  if (!canDelete) {
    throw new BadRequestError(
      "Cannot delete account while financial obligations exist.",
      { blockers },
    );
  }

  const supabase = createServiceClient();

  // Anonymize user fields (Req 35.3)
  await supabase
    .from("users")
    .update({
      display_name: "[deleted]",
      email: `deleted_${userId.slice(0, 8)}@removed.invalid`,
      deactivated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  // Audit records, transaction records, and wallet addresses tied to
  // disbursements are retained as compliance data (Req 35.4)

  await writeAuditRecord({
    action: "account.delete",
    actor_id: userId,
    resource_type: "users",
    resource_id: userId,
    metadata: { anonymized: true },
  });
}

/**
 * Export personal data (Req 35.5). GDPR-style machine-readable export.
 */
export async function exportPersonalData(userId: string): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();

  const [
    { data: user },
    { data: wallets },
    { data: memberships },
    { data: submissions },
    { data: teams },
    { data: notifications },
  ] = await Promise.all([
    supabase.from("users").select("*").eq("id", userId).single(),
    supabase.from("wallets").select("*").eq("user_id", userId),
    supabase.from("event_members").select("*").eq("user_id", userId),
    supabase.from("submissions").select("*").eq("submitter_id", userId),
    supabase.from("team_members").select("*, teams!inner(name, event_id)").eq("user_id", userId),
    supabase.from("notifications").select("*").eq("user_id", userId).limit(1000),
  ]);

  return {
    exportDate: new Date().toISOString(),
    user,
    wallets: wallets ?? [],
    eventMemberships: memberships ?? [],
    submissions: submissions ?? [],
    teamMemberships: teams ?? [],
    notifications: notifications ?? [],
  };
}
