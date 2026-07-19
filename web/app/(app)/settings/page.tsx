"use client";

/**
 * Settings page — wallet connection and account management.
 */
import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { WalletConnect } from "@/components/wallet/wallet-connect";

export default function SettingsPage() {
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [wallets, setWallets] = useState<Array<{ id: string; public_key: string; verification_status: string; network_mode: string }>>([]);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      setUser({
        id: authUser.id,
        email: authUser.email ?? "",
        name: authUser.user_metadata?.display_name ?? authUser.email ?? "",
      });

      const { data: walletData } = await supabase
        .from("wallets")
        .select("id, public_key, verification_status, network_mode")
        .eq("user_id", authUser.id);

      setWallets(walletData ?? []);
    }
    load();
  }, []);

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      {/* Profile */}
      <section className="rounded-lg border border-neutral-200 p-5 space-y-3">
        <h2 className="font-medium">Profile</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-neutral-500">Name</p>
            <p className="font-medium">{user.name}</p>
          </div>
          <div>
            <p className="text-neutral-500">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
        </div>
      </section>

      {/* Wallet */}
      <section className="rounded-lg border border-neutral-200 p-5 space-y-4">
        <div>
          <h2 className="font-medium">Wallet Connection</h2>
          <p className="text-sm text-neutral-500 mt-1">Connect your Freighter wallet to fund events and receive prizes.</p>
        </div>

        {wallets.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-neutral-500 uppercase tracking-wide">Connected wallets</p>
            {wallets.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-md border border-neutral-200 p-3">
                <span className="font-mono text-sm">{w.public_key.slice(0, 8)}…{w.public_key.slice(-6)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">{w.network_mode}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    w.verification_status === "Verified" ? "bg-green-100 text-green-700" :
                    w.verification_status === "Pending" ? "bg-amber-100 text-amber-700" :
                    "bg-neutral-100 text-neutral-600"
                  }`}>{w.verification_status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <WalletConnect
          expectedNetwork="testnet"
          onVerified={() => window.location.reload()}
        />
      </section>

      {/* Account Actions */}
      <section className="rounded-lg border border-red-200 bg-red-50 p-5 space-y-3">
        <h2 className="font-medium text-red-800">Account</h2>
        <button
          onClick={handleSignOut}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
        >
          Sign Out
        </button>
      </section>
    </div>
  );
}
