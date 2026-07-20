"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { BackButton } from "@/components/ui/back-button";
import { 
  createEscrowAction, 
  verifyFundingAction, 
  simulatePayoutBatchAction, 
  generatePayoutBatchAction,
  releaseEscrowAction, 
  reconcileSettlementAction,
  retryInstructionAction
} from "@/app/actions/escrow.actions";

export default function EventEscrowPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  
  const [eventData, setEventData] = useState<any>(null);
  const [prizeBatch, setPrizeBatch] = useState<any>(null);
  const [escrow, setEscrow] = useState<any>(null);
  const [payoutBatch, setPayoutBatch] = useState<any>(null);
  const [settlement, setSettlement] = useState<any>(null);
  
  const [fundAmount, setFundAmount] = useState("");
  const [fundingStep, setFundingStep] = useState<"idle" | "connecting" | "signing" | "done" | "error">("idle");
  const [fundingError, setFundingError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [eventId]);

  async function loadData() {
    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: evt }, { data: pb }] = await Promise.all([
        supabase.from("events").select("*").eq("id", eventId).single(),
        supabase.from("prize_allocation_batches").select("*").eq("event_id", eventId).eq("status", "Locked").maybeSingle()
      ]);

      setEventData(evt);
      setPrizeBatch(pb);

      if (pb) {
        const { data: esc } = await supabase.from("escrow_accounts").select("*").eq("prize_allocation_batch_id", pb.id).maybeSingle();
        setEscrow(esc);
        
        if (esc) {
          const { data: pbatch } = await supabase.from("payout_batches").select("*, payout_instructions(*)").eq("escrow_id", esc.id).maybeSingle();
          setPayoutBatch(pbatch);
          
          if (pbatch) {
            const { data: setl } = await supabase.from("settlements").select("*").eq("payout_batch_id", pbatch.id).maybeSingle();
            setSettlement(setl);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateEscrow() {
    if (!prizeBatch) return;
    setActionLoading("create");
    try {
      const createdEscrow = await createEscrowAction(eventId, prizeBatch.id, prizeBatch.total_amount || 0);
      await generatePayoutBatchAction(createdEscrow.escrowId, prizeBatch.id);
      await loadData();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleFundEscrow() {
    if (!escrow || !fundAmount) return;
    setFundingStep("connecting");
    setFundingError(null);

    try {
      const { FreighterAdapter } = await import("@/lib/wallet/freighter");
      const wallet = new FreighterAdapter();
      const available = await wallet.isAvailable();
      if (!available) throw new Error("Freighter wallet extension is not installed.");

      const { publicKey, network } = await wallet.connect();
      
      setFundingStep("signing");
      const { Horizon, TransactionBuilder, Operation, Asset, Networks } = await import("@stellar/stellar-sdk");
      const networkMode = escrow.network;
      const horizonUrl = networkMode === "public" ? "https://horizon.stellar.org" : "https://horizon-testnet.stellar.org";
      const networkPassphrase = networkMode === "public" ? Networks.PUBLIC : Networks.TESTNET;
      
      const server = new Horizon.Server(horizonUrl);
      const sourceAccount = await server.loadAccount(publicKey);

      const transaction = new TransactionBuilder(sourceAccount, { fee: "100", networkPassphrase })
        .addOperation(Operation.payment({ destination: escrow.contract_address, asset: Asset.native(), amount: fundAmount }))
        .setTimeout(60).build();

      const signedXdr = await wallet.signTransaction(transaction.toXDR(), networkMode as any);
      
      // We still submit from frontend for convenience, but rely on backend verification
      const signedTx = (await import("@stellar/stellar-sdk")).TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
      const submitResult = await server.submitTransaction(signedTx);
      if (!submitResult.successful) throw new Error("Transaction failed on Horizon.");
      
      setFundingStep("done");
      setFundAmount("");
      alert("Funding sent! Click 'Verify Funding' to confirm receipt on the backend.");
    } catch (err: any) {
      setFundingError(err.message);
      setFundingStep("error");
    }
  }

  async function handleVerifyFunding() {
    setActionLoading("verify");
    try {
      await verifyFundingAction(escrow.id);
      await loadData();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSimulate() {
    if (!payoutBatch) return;
    setActionLoading("simulate");
    try {
      const res = await simulatePayoutBatchAction(payoutBatch.id);
      setSimulationResult(res);
      await loadData(); // refresh status
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRelease() {
    if (!payoutBatch) return;
    setActionLoading("release");
    try {
      await releaseEscrowAction(payoutBatch.id);
      await loadData();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSettle() {
    if (!payoutBatch) return;
    setActionLoading("settle");
    try {
      await reconcileSettlementAction(payoutBatch.id);
      await loadData();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  }
  
  async function handleRetryInstruction(instructionId: string) {
    setActionLoading("retry");
    try {
      await retryInstructionAction(instructionId);
      // Wait a moment then trigger release again to execute the retried instructions
      if (payoutBatch) {
        await releaseEscrowAction(payoutBatch.id);
      }
      await loadData();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return <div className="p-8">Loading escrow data...</div>;
  }

  return (
    <div className="space-y-6">
      <BackButton href={`/events/${eventId}`} label="Back to Event" />
      <h2 className="text-2xl font-bold">Escrow & Execution</h2>

      {actionError && (
        <div className="bg-destructive/10 text-destructive border border-destructive rounded px-4 py-3 text-sm">
          {actionError}
        </div>
      )}

      {/* Aggregate Readiness Timeline (Audit Timeline) */}
      <div className="card p-6">
        <h3 className="font-medium mb-4">Financial Workflow Timeline</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <Badge active={!!prizeBatch} label="1. Prize Batch Locked" />
          <Badge active={!!escrow} label="2. Escrow Created" />
          <Badge active={escrow?.status === 'Funded' || escrow?.status === 'Verified' || escrow?.status === 'Locked' || escrow?.status === 'Releasing' || escrow?.status === 'Completed'} label="3. Funding Verified" />
          <Badge active={payoutBatch?.status === 'Preparing' || payoutBatch?.status === 'Signing' || payoutBatch?.status === 'Broadcast' || payoutBatch?.status === 'Confirmed' || payoutBatch?.status === 'Partially Completed'} label="4. Simulation Passed" />
          <Badge active={payoutBatch?.status === 'Broadcast' || payoutBatch?.status === 'Confirmed' || payoutBatch?.status === 'Partially Completed'} label="5. Payout Broadcast" />
          <Badge active={payoutBatch?.status === 'Confirmed' || payoutBatch?.status === 'Partially Completed'} label="6. Confirmed" />
          <Badge active={!!settlement} label="7. Settlement Completed" />
        </div>
      </div>

      {!prizeBatch ? (
        <div className="card p-8 text-center text-muted-foreground">
          Prize Allocation Batch must be Locked before Escrow can be initialized. Please complete Prize Allocations first.
        </div>
      ) : !escrow ? (
        <div className="card p-8 text-center space-y-4">
          <p>Prize allocations are locked. Escrow is ready to be created.</p>
          <button 
            onClick={handleCreateEscrow} 
            disabled={!!actionLoading} 
            className="btn-primary px-4 py-2 rounded-md disabled:opacity-50"
          >
            {actionLoading === 'create' ? 'Creating...' : 'Create Escrow Account'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Escrow Details */}
          <div className="card p-6 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Escrow Status</p>
              <p className="font-medium">{escrow.status}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Network</p>
              <p className="font-medium capitalize">{escrow.network}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">Escrow Address</p>
              <p className="font-mono text-xs break-all bg-muted p-2 rounded mt-1">{escrow.contract_address}</p>
            </div>
          </div>

          {/* Funding Section */}
          {(!escrow.status || ['Draft', 'Funding'].includes(escrow.status)) && (
            <div className="card p-6 space-y-4">
              <h3 className="font-medium">Fund Escrow</h3>
              <p className="text-sm text-muted-foreground">
                Target amount: <strong>{escrow.expected_balance} XLM</strong>
              </p>
              
              <div className="flex gap-4 items-end border-b pb-4">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Amount (XLM)</label>
                  <input type="number" value={fundAmount} onChange={e => setFundAmount(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <button onClick={handleFundEscrow} disabled={fundingStep !== 'idle'} className="btn-secondary px-4 py-2 rounded text-sm">
                  Fund with Freighter
                </button>
              </div>
              
              <div className="pt-2">
                <button onClick={handleVerifyFunding} disabled={!!actionLoading} className="btn-primary px-4 py-2 rounded text-sm disabled:opacity-50">
                  {actionLoading === 'verify' ? 'Verifying...' : 'Verify Funding On-Chain'}
                </button>
                <p className="text-xs text-muted-foreground mt-2">Click this after you have sent funds to verify receipt.</p>
              </div>
            </div>
          )}

          {/* Simulation & Payout Section */}
          {(escrow.status === 'Funded' || escrow.status === 'Verified' || escrow.status === 'Locked' || escrow.status === 'Releasing' || escrow.status === 'Completed') && payoutBatch && !settlement && (
            <div className="card p-6 space-y-4">
              <h3 className="font-medium">Payout Execution</h3>
              
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Batch Status</p>
                  <p className="font-medium">{payoutBatch.status}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Payouts</p>
                  <p className="font-medium">{payoutBatch.total_amount} XLM</p>
                </div>
              </div>

              {simulationResult && (
                <div className={`p-4 rounded text-sm space-y-2 ${simulationResult.success ? 'bg-muted' : 'bg-destructive/10 text-destructive'}`}>
                  <p><strong>Simulation Result:</strong> {simulationResult.success ? 'Passed' : 'Failed'}</p>
                  {simulationResult.estimatedFee && <p>Estimated Network Fee: {simulationResult.estimatedFee} XLM</p>}
                  {simulationResult.error && <p>Error: {simulationResult.error}</p>}
                </div>
              )}

              <div className="flex gap-4 pt-2">
                {['Pending', 'Preparing'].includes(payoutBatch.status) && (
                  <button onClick={handleSimulate} disabled={!!actionLoading} className="btn-secondary px-4 py-2 rounded text-sm">
                    {actionLoading === 'simulate' ? 'Simulating...' : 'Simulate Batch'}
                  </button>
                )}
                
                {['Preparing', 'Signing'].includes(payoutBatch.status) && simulationResult?.success && (
                  <button onClick={handleRelease} disabled={!!actionLoading} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
                    {actionLoading === 'release' ? 'Broadcasting...' : 'Release Escrow & Disburse'}
                  </button>
                )}

                {['Confirmed', 'Partially Completed'].includes(payoutBatch.status) && (
                  <button onClick={handleSettle} disabled={!!actionLoading} className="btn-primary px-4 py-2 rounded text-sm">
                    {actionLoading === 'settle' ? 'Settling...' : 'Create Settlement Record'}
                  </button>
                )}
              </div>
              
              {/* Progress Tracker */}
              {['Broadcast', 'Confirmed', 'Partially Completed', 'Failed'].includes(payoutBatch.status) && (
                <div className="mt-4 p-4 border rounded">
                  <h4 className="text-sm font-medium mb-2">Execution Progress</h4>
                  <div className="space-y-2">
                    {payoutBatch.payout_instructions?.map((inst: any) => (
                      <div key={inst.id} className="flex justify-between items-center text-sm p-2 bg-muted rounded">
                        <span>{inst.destination_address.slice(0,8)}...</span>
                        <span>{inst.amount} XLM</span>
                        <div className="flex items-center gap-3">
                          <span className={`font-medium ${inst.status === 'Confirmed' ? 'text-green-600' : inst.status === 'Failed' ? 'text-red-600' : ''}`}>
                            {inst.status}
                          </span>
                          {inst.status === 'Failed' && (
                            <button 
                              onClick={() => handleRetryInstruction(inst.id)} 
                              disabled={!!actionLoading}
                              className="text-xs border px-2 py-1 rounded hover:bg-muted-foreground/10"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Settlement Section */}
          {settlement && (
            <div className="card p-6 bg-green-50 dark:bg-green-900/10 border-green-200">
              <h3 className="font-medium text-green-800 dark:text-green-300 mb-4">Settlement Completed</h3>
              <div className="grid grid-cols-2 gap-4 text-sm text-green-900 dark:text-green-200">
                <div>
                  <p className="opacity-70">Amount Released</p>
                  <p className="font-bold text-lg">{settlement.reconciled_amount} XLM</p>
                </div>
                <div>
                  <p className="opacity-70">Date</p>
                  <p className="font-medium">{new Date(settlement.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="opacity-70">Transactions</p>
                  <p className="font-medium">{payoutBatch?.payout_instructions?.length || 0} Winners</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Badge({ active, label }: { active: boolean, label: string }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${active ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-muted text-muted-foreground border-transparent'}`}>
      {label}
    </span>
  );
}
