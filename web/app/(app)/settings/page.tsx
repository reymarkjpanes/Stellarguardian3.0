"use client";

/**
 * Settings page — wallet connection and account management.
 */
import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { WalletConnect } from "@/components/wallet/wallet-connect";

interface WalletRecord {
  id: string;
  public_key: string;
  verification_status: string;
  network_mode: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [showAddWallet, setShowAddWallet] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
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

  async function removeWallet(walletId: string) {
    setRemovingId(walletId);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase
        .from("wallets")
        .delete()
        .eq("id", walletId);

      if (error) {
        alert(`Failed to remove wallet: ${error.message}`);
      } else {
        setWallets((prev) => prev.filter((w) => w.id !== walletId));
      }
    } catch {
      alert("An unexpected error occurred.");
    } finally {
      setRemovingId(null);
      setConfirmRemoveId(null);
    }
  }

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="h-6 w-6 mx-auto animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Settings</h1>

      {/* Profile */}
      <section className="card p-5 space-y-4">
        <h2 className="font-medium text-[var(--text)]">Profile</h2>
        <ProfileEditForm userId={user.id} initialName={user.name} email={user.email} onUpdate={(name) => setUser({ ...user, name })} />
      </section>

      {/* Connected Wallets */}
      <section className="card p-5 space-y-4">
        <div>
          <h2 className="font-medium text-[var(--text)]">Wallet Connection</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Connect your Freighter wallet to fund events and receive prizes.
          </p>
        </div>

        {/* Existing wallets */}
        {wallets.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium">
              Connected wallets
            </p>
            {wallets.map((w) => (
              <WalletItem
                key={w.id}
                wallet={w}
                onRemove={removeWallet}
                removingId={removingId}
                confirmRemoveId={confirmRemoveId}
                setConfirmRemoveId={setConfirmRemoveId}
              />
            ))}
          </div>
        )}

        {/* Connect new wallet — only show if no wallet connected, or user explicitly wants another */}
        {wallets.length === 0 && (
          <WalletConnect
            expectedNetwork="testnet"
            onVerified={() => loadData()}
          />
        )}

        {wallets.length > 0 && !showAddWallet && (
          <button
            onClick={() => setShowAddWallet(true)}
            className="text-sm font-medium text-[var(--accent)] hover:underline"
          >
            + Connect a different wallet
          </button>
        )}

        {wallets.length > 0 && showAddWallet && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium">
                Connect new wallet
              </p>
              <button
                onClick={() => setShowAddWallet(false)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                Cancel
              </button>
            </div>
            <WalletConnect
              expectedNetwork="testnet"
              onVerified={() => { loadData(); setShowAddWallet(false); }}
            />
          </div>
        )}
      </section>

      {/* Account Actions */}
      <section className="rounded-lg border border-[var(--error)] bg-[var(--error-bg)] p-5 space-y-3">
        <h2 className="font-medium text-[var(--error)]">Account</h2>
        <button
          onClick={handleSignOut}
          className="rounded-md border border-[var(--error)] px-4 py-2 text-sm font-medium text-[var(--error)] hover:opacity-80 transition-colors"
        >
          Sign Out
        </button>
      </section>
    </div>
  );
}

/**
 * Wallet item with balance fetching.
 */
function WalletItem({
  wallet: w,
  onRemove,
  removingId,
  confirmRemoveId,
  setConfirmRemoveId,
}: {
  wallet: WalletRecord;
  onRemove: (id: string) => void;
  removingId: string | null;
  confirmRemoveId: string | null;
  setConfirmRemoveId: (id: string | null) => void;
}) {
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/wallets/${w.public_key}/balance`)
      .then((res) => res.json())
      .then((data) => setBalance(data.balance))
      .catch(() => setBalance("0"));
  }, [w.public_key]);

  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <p className="font-mono text-sm text-[var(--text)]">
            {w.public_key.slice(0, 12)}…{w.public_key.slice(-8)}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              {w.network_mode}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                w.verification_status === "Verified"
                  ? "bg-[var(--success-bg)] text-[var(--success)]"
                  : "badge-default"
              }`}
            >
              {w.verification_status}
            </span>
            {balance !== null ? (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)]">
                Balance: {balance} XLM
              </span>
            ) : (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--bg-muted)] text-[var(--text-muted)] border border-[var(--border)]">
                Fetching balance…
              </span>
            )}
          </div>
        </div>

        {/* Remove button / confirmation */}
        {confirmRemoveId === w.id ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onRemove(w.id)}
              disabled={removingId === w.id}
              className="rounded-md bg-[var(--error-bg)] border border-[var(--error)] px-3 py-1.5 text-xs font-medium text-[var(--error)] hover:opacity-80 disabled:opacity-50"
            >
              {removingId === w.id ? "Removing…" : "Yes, remove"}
            </button>
            <button
              onClick={() => setConfirmRemoveId(null)}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRemoveId(w.id)}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {/* Confirmation warning */}
      {confirmRemoveId === w.id && (
        <div className="mt-3 rounded-md bg-[var(--warning-bg)] border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] px-3 py-2">
          <p className="text-xs text-[var(--warning)]">
            Are you sure? Removing this wallet will disconnect it from your account. You won't be
            able to receive prizes at this address until you reconnect.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Profile edit form — allows updating display name via PATCH /api/users/me.
 */
function ProfileEditForm({
  userId,
  initialName,
  email,
  onUpdate,
}: {
  userId: string;
  initialName: string;
  email: string;
  onUpdate: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: name }),
    });

    if (!res.ok) {
      const { error: apiErr } = await res.json();
      setError(apiErr?.message ?? "Failed to update profile.");
    } else {
      setSuccess(true);
      onUpdate(name);
      setEditing(false);
      setTimeout(() => setSuccess(false), 3000);
    }
    setSaving(false);
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[var(--text-muted)]">Display name</p>
            <p className="font-medium text-[var(--text)]">{initialName || "Not set"}</p>
          </div>
          <div>
            <p className="text-[var(--text-muted)]">Email</p>
            <p className="font-medium text-[var(--text)]">{email}</p>
          </div>
        </div>
        {success && <p className="text-xs text-[var(--success)]">Profile updated.</p>}
        <button
          onClick={() => setEditing(true)}
          className="text-sm font-medium text-[var(--accent)] hover:underline"
        >
          Edit profile
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label htmlFor="display-name" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
          Display name
        </label>
        <input
          id="display-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={50}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Email</label>
        <p className="text-sm text-[var(--text-muted)]">{email}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">Email cannot be changed here.</p>
      </div>
      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setName(initialName); }}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
