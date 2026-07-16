import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../lib/api';
import { Button, Input } from '../components/ui';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [walletAddress, setWalletAddress] = useState(user?.walletAddress || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // In a real app, this would trigger freighterApi.getPublicKey()
      // We are mocking it here for the first pass.
      const simulatedAddress = walletAddress || "G" + Math.random().toString(36).substr(2, 54).toUpperCase();
      
      await fetchApi('/wallet/connect', {
        method: 'POST',
        body: JSON.stringify({ walletAddress: simulatedAddress })
      });
      await refreshUser();
      toast.success("Wallet connected successfully!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsSaving(true);
    try {
      await fetchApi('/wallet/connect', {
        method: 'POST',
        body: JSON.stringify({ walletAddress: null })
      });
      await refreshUser();
      setWalletAddress('');
      toast.success("Wallet disconnected successfully!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-display font-bold text-slate-900 mb-8">Account Settings</h1>
      
      <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Wallet Connection</h2>
            <p className="text-sm text-slate-500">Connect your Freighter wallet to fund events and receive prizes.</p>
          </div>
        </div>
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-md text-sm mb-4 flex items-start gap-3">
            <span className="text-xl leading-none">⚠️</span>
            <div>
              <strong className="block mb-1">Mock Mode Active</strong> 
              This simulates a Freighter connection. Submitting the form will attach the provided address (or generate a random G... address) to your account.
            </div>
          </div>
          
          <Input 
            label="Stellar Public Key"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="G..."
            disabled={isSaving}
          />
          
          <div className="pt-2 flex gap-3">
            <Button type="submit" disabled={isSaving}>
              {user?.walletAddress ? 'Update Wallet' : 'Connect Freighter Wallet'}
            </Button>
            {user?.walletAddress && (
              <Button type="button" variant="outline" onClick={handleDisconnect} disabled={isSaving}>
                Disconnect
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
