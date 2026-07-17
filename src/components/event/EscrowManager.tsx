import React, { useState, useEffect } from 'react';
import { Button, Badge } from '../ui';
import { Wallet, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { Event } from '../../types';
import { fetchApi } from '../../lib/api';
import { toast } from 'sonner';

interface EscrowManagerProps {
  event: Event;
  user: any;
  onUpdate: () => void;
}

export function EscrowManager({ event, user, onUpdate }: EscrowManagerProps) {
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);

  const isHost = user?.id === event.hostUserId;
  const isDraft = event.state === 'Draft';
  const hasEscrow = !!event.escrowPublicKey;

  const fetchBalance = async () => {
    if (!hasEscrow) return;
    setLoading(true);
    try {
      const res = await fetchApi(`/stellar/escrow/${event.id}`);
      setBalance(res.data.balance);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch balance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasEscrow) {
      fetchBalance();
    }
  }, [hasEscrow, event.id]);

  const handleFundEscrow = async () => {
    if (!user.walletAddress) {
      toast.error('Please connect a Stellar wallet in your Settings first.');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetchApi('/stellar/fund-event', {
        method: 'POST',
        body: JSON.stringify({ eventId: event.id })
      });
      toast.success('Event funded successfully on Stellar Testnet!');
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to fund event');
    } finally {
      setLoading(false);
    }
  };

  if (!isHost) return null;

  return (
    <div className="bg-slate-900 text-white p-8 border border-slate-800 rounded-xl shadow-lg mb-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
        <Wallet className="w-32 h-32" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <Wallet className="w-6 h-6 text-indigo-400" />
          <h3 className="text-xl font-bold font-display">Stellar Escrow Management</h3>
        </div>
        <p className="text-slate-400 text-sm mb-6 max-w-2xl">
          Securely hold prize funds on the Stellar Testnet. Once funded, the prize pool is locked until winners are finalized.
        </p>

        {!hasEscrow ? (
          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700 max-w-lg">
            <h4 className="font-semibold text-slate-200 mb-2">Fund the Prize Pool</h4>
            <p className="text-slate-400 text-sm mb-4">
              Your event prize is currently set to <strong>{event.prizeTotal || 0} XLM</strong>. 
              Clicking below will create an ephemeral escrow account and transfer the funds from your connected wallet.
            </p>
            
            {!user.walletAddress && (
              <div className="flex items-start gap-2 text-amber-400 bg-amber-400/10 p-3 rounded-md mb-4 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>You have not connected a Stellar wallet. Please update your Settings first.</p>
              </div>
            )}

            <Button 
              onClick={handleFundEscrow} 
              disabled={loading || !isDraft || !user.walletAddress}
              className="bg-indigo-500 hover:bg-indigo-600 text-white w-full sm:w-auto"
            >
              {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Wallet className="w-4 h-4 mr-2" />}
              Fund {event.prizeTotal || 0} XLM to Escrow
            </Button>
            {!isDraft && <p className="text-xs text-red-400 mt-2">Only events in 'Draft' state can be funded.</p>}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-slate-200">Escrow Details</h4>
                <Badge variant="success" className="bg-green-500/20 text-green-300 border-green-500/30">
                  <CheckCircle className="w-3 h-3 mr-1" /> Active
                </Badge>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Public Key</label>
                  <div className="text-sm font-mono text-indigo-300 break-all bg-slate-900/50 p-2 rounded mt-1 border border-slate-700/50">
                    {event.escrowPublicKey}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Funding Tx</label>
                  <div className="text-sm font-mono text-slate-300 break-all bg-slate-900/50 p-2 rounded mt-1 border border-slate-700/50">
                    {event.fundingTxRef || 'Pending verification...'}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-indigo-500/10 rounded-lg p-6 border border-indigo-500/20 flex flex-col justify-center items-center text-center">
              <label className="text-sm text-indigo-300 font-medium mb-2">Live Balance (Testnet)</label>
              <div className="text-4xl font-display font-bold text-white mb-4">
                {balance === null ? (
                  <span className="text-slate-500">...</span>
                ) : (
                  <span>{balance} <span className="text-xl text-indigo-300">XLM</span></span>
                )}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchBalance} 
                disabled={loading}
                className="border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh Balance
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
