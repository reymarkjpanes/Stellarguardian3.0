process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser,
  createTestEvent,
  getIntegrationClient,
} from "@/lib/test-utils/integration-runner";
import { EscrowRepository } from "@/lib/repositories/escrow.repository";
import crypto from "crypto";

// Integration tests require a running local Supabase instance (supabase start).
// They are skipped in CI unless INTEGRATION_TESTS=true is set.
// Run locally after applying all migrations: supabase db reset && supabase db push
const RUN_INTEGRATION = process.env.INTEGRATION_TESTS === "true";

// We use the real service client by setting the env var so that createServiceClient inside
// EscrowRepository will use the integration config.
// The integration runner handles test environment setup.

describe.skipIf(!RUN_INTEGRATION)("Escrow Integration Tests", () => {
  let organizerId: string;
  let eventId: string;
  let escrowId: string;
  let winnerId1: string;
  let winnerId2: string;
  let winnerUserId1: string;
  let winnerUserId2: string;

  beforeAll(async () => {
    // Setup data
    const user = await createTestUser();
    organizerId = user.id;

    eventId = await createTestEvent(organizerId);

    const supabase = getIntegrationClient();

    // The event trigger should have created an escrow account automatically when the event was created
    // Let's check if it exists. If not, create it (some triggers might be disabled in test or not implemented yet)
    const { data: escrowCheck } = await supabase
      .from("escrow_accounts")
      .select("id")
      .eq("event_id", eventId)
      .single();
    if (escrowCheck) {
      escrowId = escrowCheck.id;
    } else {
      escrowId = crypto.randomUUID();
      const { error: escrowError } = await supabase.from("escrow_accounts").insert({
        id: escrowId,
        event_id: eventId,
        state: "PendingFunding",
        stellar_public_key: "G" + "A".repeat(55),
        encrypted_secret_key: "\\x00",
      });
      if (escrowError) throw new Error("Failed to create escrow: " + JSON.stringify(escrowError));
    }

    // Create some winners for disbursement tests
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    winnerUserId1 = user1.id;
    winnerUserId2 = user2.id;
    winnerId1 = crypto.randomUUID();
    winnerId2 = crypto.randomUUID();

    await supabase.from("winners").insert([
      {
        id: winnerId1,
        event_id: eventId,
        recipient_id: winnerUserId1,
        prize_amount: 50,
        disbursement_status: "pending",
      },
      {
        id: winnerId2,
        event_id: eventId,
        recipient_id: winnerUserId2,
        prize_amount: 30,
        disbursement_status: "pending",
      },
    ]);
  }, 30000);

  afterAll(async () => {
    // Clean up if necessary, but DB resets often handle this
    const supabase = getIntegrationClient();
    await supabase.from("events").delete().eq("id", eventId);
  });

  it("should successfully fund an escrow account and update its state", async () => {
    const txHash = "tx_fund_" + Date.now();
    const result = await EscrowRepository.fundEscrow(
      eventId,
      txHash,
      organizerId,
      "G" + "E".repeat(55),
      "100",
    );

    expect(result.success).toBe(true);
    expect(result.newState).toBe("PartiallyFunded");
    expect(result.amount).toBe("100");

    // Verify in DB
    const supabase = getIntegrationClient();
    const { data: escrow } = await supabase
      .from("escrow_accounts")
      .select("state")
      .eq("id", escrowId)
      .single();
    expect(escrow?.state).toBe("PartiallyFunded");

    // Verify transaction recorded
    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("tx_hash", txHash)
      .single();
    expect(tx).toBeDefined();
    expect(tx?.amount).toBe(100);
  });

  it("should block duplicate funding tx (idempotency)", async () => {
    const txHash = "tx_fund_dup_" + Date.now();

    await EscrowRepository.fundEscrow(eventId, txHash, organizerId, "G" + "E".repeat(55), "50");

    // Try again with same hash
    await expect(
      EscrowRepository.fundEscrow(eventId, txHash, organizerId, "G" + "E".repeat(55), "50"),
    ).rejects.toThrow(); // Supabase RPC will throw a unique constraint error on tx_hash
  });

  it("should successfully disburse prizes via RPC", async () => {
    const payments = [
      {
        winnerId: winnerId1,
        recipientId: winnerUserId1,
        destination: "G" + "B".repeat(55),
        amount: "50",
        fundingWallet: "G" + "D".repeat(55),
        txHash: "tx_disburse_1_" + Date.now(),
      },
      {
        winnerId: winnerId2,
        recipientId: winnerUserId2,
        destination: "G" + "C".repeat(55),
        amount: "30",
        txHash: "tx_disburse_2_" + Date.now(),
      },
    ];

    const success = await EscrowRepository.disbursePrizes(eventId, escrowId, payments, "testnet");
    expect(success).toBe(true);

    const supabase = getIntegrationClient();

    // Check winners are updated
    const { data: w1 } = await supabase
      .from("winners")
      .select("disbursement_status")
      .eq("id", winnerId1)
      .single();
    expect(w1?.disbursement_status).toBe("disbursed");

    const { data: w2 } = await supabase
      .from("winners")
      .select("disbursement_status")
      .eq("id", winnerId2)
      .single();
    expect(w2?.disbursement_status).toBe("disbursed");

    // Check transactions created
    const { data: txs } = await supabase
      .from("transactions")
      .select("*")
      .in(
        "tx_hash",
        payments.map((p) => p.txHash),
      );
    expect(txs?.length).toBe(2);
    expect(txs?.[0].type).toBe("disbursement");
  });
});
