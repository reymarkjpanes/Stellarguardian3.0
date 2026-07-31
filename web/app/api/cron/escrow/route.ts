/**
 * Cron: Escrow Automation (Phase 6, Req 26).
 *
 * Runs every 5 minutes via Vercel Cron.
 * 1. Finds events in `PrizeApproved` state with no unresolved disputes.
 * 2. Checks if the escrow is `FullyFunded`.
 * 3. Transitions event to `EscrowRelease`.
 * 4. Generates a payout batch (if not already generated).
 * 5. Executes the on-chain payout batch (if not already released).
 *
 * Authentication: Requires Bearer CRON_SECRET in Authorization header.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyCronAuth } from "@/lib/cron-auth";
import { EscrowService } from "@/src/domains/escrow/services/EscrowService";
import { StellarEscrowAdapter } from "@/src/domains/escrow/adapters/StellarEscrowAdapter";
import { EnvKeyManager } from "@/src/domains/escrow/adapters/EnvKeyManager";
import { writeAuditRecord } from "@/lib/services/audit";
import { logger } from "@/lib/logger";

function getEscrowService() {
  const supabase = createServiceClient();
  const keyManager = new EnvKeyManager();
  const network = (process.env.STELLAR_NETWORK_MODE ?? "testnet") as "testnet" | "public";
  const adapter = new StellarEscrowAdapter(keyManager, network);
  return new EscrowService(supabase, adapter);
}

export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceClient();
  const service = getEscrowService();
  const results: string[] = [];
  let processed = 0;
  let failed = 0;

  try {
    // 1. Find eligible events
    // Must be in PrizeApproved state
    const { data: eligibleEvents, error: fetchError } = await supabase
      .from("events")
      .select("id, title, version")
      .eq("state", "PrizeApproved");

    if (fetchError) {
      throw fetchError;
    }

    for (const event of eligibleEvents ?? []) {
      try {
        // Verify no unresolved disputes exist for this event
        const { data: openDisputes } = await supabase
          .from("disputes")
          .select("id")
          .eq("event_id", event.id)
          .in("state", ["Open", "UnderReview"])
          .limit(1);

        if (openDisputes && openDisputes.length > 0) {
          logger.info(`[cron/escrow] Event ${event.id} skipped: Unresolved disputes`);
          continue;
        }

        // Verify the escrow is FullyFunded and fetch the account
        const { data: escrow } = await supabase
          .from("escrow_accounts")
          .select("id, state, prize_allocation_batch_id")
          .eq("event_id", event.id)
          .single();

        if (!escrow || escrow.state !== "FullyFunded") {
          logger.info(
            `[cron/escrow] Event ${event.id} skipped: Escrow not FullyFunded (is ${escrow?.state})`,
          );
          continue;
        }

        logger.info(`[cron/escrow] Processing payout for event ${event.id}`);

        // A. Transition Event to EscrowRelease (optimistic locking)
        const { error: transitionError } = await supabase
          .from("events")
          .update({ state: "EscrowRelease", version: event.version + 1 })
          .eq("id", event.id)
          .eq("version", event.version);

        if (transitionError) {
          logger.warn(`[cron/escrow] Event ${event.id} transition failed (concurrent update)`);
          continue;
        }

        await writeAuditRecord({
          action: "event.state_transition",
          actor_id: "system",
          event_id: event.id,
          resource_type: "events",
          resource_id: event.id,
          metadata: {
            from_state: "PrizeApproved",
            to_state: "EscrowRelease",
            trigger: "escrow_automation_cron",
          },
        });

        // B. Generate Payout Batch (Idempotent: uses the prize_allocation_batch_id as idempotency key)
        const batchId = escrow.prize_allocation_batch_id;
        if (!batchId) {
          throw new Error("Missing prize_allocation_batch_id on escrow");
        }

        try {
          await service.generatePayoutBatch(escrow.id, "system", batchId);
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          if (errMsg.includes("already exists")) {
            // Idempotent success
            logger.info(
              `[cron/escrow] Payout batch ${batchId} already exists, proceeding to execution`,
            );
          } else {
            throw e;
          }
        }

        // C. Execute Payout Batch (release funds)
        const txHash = await service.executePayoutBatch(batchId);

        results.push(
          `Processed payout for ${event.title} (${event.id}). Batch: ${batchId}, TxHash: ${txHash}`,
        );
        processed++;
      } catch (err) {
        logger.error(`[cron/escrow] Error processing event ${event.id}`, { error: String(err) });
        failed++;
      }
    }
  } catch (err) {
    logger.error("[cron/escrow] Fatal error running escrow cron", { error: String(err) });
    return NextResponse.json(
      { success: false, error: "Fatal error", details: String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    processed,
    failed,
    details: results,
    timestamp: new Date().toISOString(),
  });
}
