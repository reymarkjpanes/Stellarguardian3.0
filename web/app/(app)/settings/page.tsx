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

interface UserData {
  id: string;
  email: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  skills: string[];
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [availableSkills, setAvailableSkills] = useState<{ id: string; name: string }[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [showAddWallet, setShowAddWallet] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const res = await fetch("/api/users/me");
    if (!res.ok) {
      if (res.status === 401) window.location.href = "/login";
      return;
    }
    const { data } = await res.json();

    const supabase = createBrowserClient();
    const { data: skillsData } = await supabase.from("skills").select("id, name");
    setAvailableSkills(skillsData || []);

    setUser({
      id: data.id,
      email: data.email,
      display_name: data.display_name,
      bio: data.bio,
      avatar_url: data.avatar_url,
      skills: data.skills || [],
    });
    setWallets(data.wallets ?? []);
  }

  async function removeWallet(walletId: string) {
    setRemovingId(walletId);
    setWalletError(null);
    try {
      const wallet = wallets.find((w) => w.id === walletId);
      if (!wallet) return;
      const res = await fetch(`/api/wallets/${wallet.public_key}`, { method: "DELETE" });
      if (!res.ok) {
        const { error: apiErr } = await res.json();
        setWalletError(apiErr?.message ?? "Failed to remove wallet.");
      } else {
        setWallets((prev) => prev.filter((w) => w.id !== walletId));
      }
    } catch {
      setWalletError("An unexpected error occurred.");
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
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-[var(--text)]">Profile</h2>
          <a
            href={`/profile/${user.id}`}
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            View public profile ↗
          </a>
        </div>
        <ProfileEditForm
          user={user}
          availableSkills={availableSkills}
          onUpdate={(updatedData) => setUser({ ...user, ...updatedData })}
        />
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
            {walletError && (
              <div
                role="alert"
                className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-3 py-2 flex justify-between items-center"
              >
                <p className="text-xs text-[var(--error)]">{walletError}</p>
                <button
                  onClick={() => setWalletError(null)}
                  className="text-xs text-[var(--error)] hover:underline ml-3"
                >
                  ✕
                </button>
              </div>
            )}
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

        {/* Send XLM */}
        {wallets.length > 0 && (
          <div className="pt-2 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium mb-3">
              Send XLM (Testnet)
            </p>
            <SendXlmForm senderPublicKey={wallets[0]!.public_key} />
          </div>
        )}

        {/* Connect new wallet — only show if no wallet connected, or user explicitly wants another */}
        {wallets.length === 0 && (
          <WalletConnect expectedNetwork="testnet" onVerified={() => loadData()} />
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
              onVerified={() => {
                loadData();
                setShowAddWallet(false);
              }}
            />
          </div>
        )}
      </section>

      {/* Security — MFA */}
      <section className="card p-5 space-y-4">
        <div>
          <h2 className="font-medium text-[var(--text)]">Two-Factor Authentication</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Add an extra layer of security. Required for mainnet financial operations.
          </p>
        </div>
        <MfaSection />
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
            Are you sure? Removing this wallet will disconnect it from your account. You won&apos;t
            be able to receive prizes at this address until you reconnect.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * SendXlmForm — send a native XLM payment on Stellar Testnet.
 *
 * Flow: enter destination + amount → Freighter signs → Horizon broadcasts →
 * show tx hash with Stellar Expert link, or error message.
 */
function SendXlmForm({ senderPublicKey }: { senderPublicKey: string }) {
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"idle" | "signing" | "submitting" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setStep("signing");
    setError(null);
    setTxHash(null);

    try {
      // 1. Check Freighter is available
      const { FreighterAdapter } = await import("@/lib/wallet/freighter");
      const adapter = new FreighterAdapter();
      const available = await adapter.isAvailable();
      if (!available) {
        throw new Error(
          "Freighter extension is not installed or locked. Please unlock it and try again.",
        );
      }

      // 2. Build the transaction client-side using Stellar SDK
      const { Horizon, TransactionBuilder, Operation, Asset, Networks, BASE_FEE } =
        await import("@stellar/stellar-sdk");

      const server = new Horizon.Server("https://horizon-testnet.stellar.org");
      const sourceAccount = await server.loadAccount(senderPublicKey);

      const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination,
            asset: Asset.native(),
            amount,
          }),
        )
        // 180s gives the user enough time to review and approve in Freighter
        // without the transaction expiring before it reaches Horizon.
        // (30s was too short — caused tx_too_late on sign + submit round-trip)
        .setTimeout(180)
        .build();

      // 3. Sign with Freighter
      const signedXdr = await adapter.signTransaction(tx.toXDR(), "testnet");

      // 4. Submit via our backend route (avoids CORS on Horizon directly)
      setStep("submitting");
      const res = await fetch("/api/stellar/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signed_xdr: signedXdr }),
      });

      const json = await res.json();

      if (!res.ok || !json.successful) {
        throw new Error(json.error ?? `Transaction failed. Hash: ${json.hash ?? "unknown"}`);
      }

      setTxHash(json.hash);
      setStep("success");
      setDestination("");
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed.");
      setStep("error");
    }
  }

  function reset() {
    setStep("idle");
    setError(null);
    setTxHash(null);
  }

  return (
    <div className="space-y-4">
      {step === "idle" || step === "error" ? (
        <form onSubmit={handleSend} className="space-y-3">
          <div>
            <label
              htmlFor="send-destination"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
            >
              Destination address
            </label>
            <input
              id="send-destination"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
              placeholder="G…"
              pattern="G[A-Z2-7]{55}"
              title="Must be a valid Stellar public key (starts with G)"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label
              htmlFor="send-amount"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
            >
              Amount (XLM)
            </label>
            <input
              id="send-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min="0.0000001"
              step="any"
              placeholder="0.00"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {error && (
            <div className="rounded-md border border-[color-mix(in_srgb,var(--error)_40%,transparent)] bg-[var(--error-bg)] px-3 py-2 text-xs text-[var(--error)]">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            Send with Freighter
          </button>
        </form>
      ) : step === "signing" ? (
        <div className="rounded-md bg-[var(--bg-muted)] px-4 py-4 flex items-center gap-3 text-sm text-[var(--text-muted)]">
          <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
          Waiting for Freighter approval…
        </div>
      ) : step === "submitting" ? (
        <div className="rounded-md bg-[var(--bg-muted)] px-4 py-4 flex items-center gap-3 text-sm text-[var(--text-muted)]">
          <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
          Broadcasting to Stellar Testnet…
        </div>
      ) : step === "success" && txHash ? (
        <div className="rounded-md border border-[color-mix(in_srgb,var(--success)_40%,transparent)] bg-[var(--success-bg)] px-4 py-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--success)]">
            <span>✓</span>
            Transaction confirmed
          </div>
          <p className="text-xs text-[var(--text-muted)]">Transaction hash:</p>
          <p className="font-mono text-xs text-[var(--text)] break-all">{txHash}</p>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-[var(--accent)] hover:underline"
          >
            View on Stellar Expert →
          </a>
          <button
            onClick={reset}
            className="block mt-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Send another
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Profile edit form — allows updating display name, bio, and avatar via PATCH /api/users/me.
 */
function ProfileEditForm({
  user,
  availableSkills,
  onUpdate,
}: {
  user: UserData;
  availableSkills: { id: string; name: string }[];
  onUpdate: (data: Partial<UserData>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.display_name);
  const [bio, setBio] = useState(user.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || "");
  const [selectedSkills, setSelectedSkills] = useState<string[]>(user.skills || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const updates = {
      display_name: name,
      bio: bio || null,
      avatar_url: avatarUrl || null,
      skills: selectedSkills,
    };

    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const { error: apiErr } = await res.json();
      setError(apiErr?.message ?? "Failed to update profile.");
    } else {
      setSuccess(true);
      onUpdate(updates);
      setEditing(false);
      setTimeout(() => setSuccess(false), 3000);
    }
    setSaving(false);
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        {user.avatar_url && (
          <div className="mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user.avatar_url}
              alt="Avatar"
              className="w-16 h-16 rounded-full bg-[var(--bg-muted)] object-cover"
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[var(--text-muted)]">Display name</p>
            <p className="font-medium text-[var(--text)]">{user.display_name || "Not set"}</p>
          </div>
          <div>
            <p className="text-[var(--text-muted)]">Email</p>
            <p className="font-medium text-[var(--text)]">{user.email}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[var(--text-muted)]">Bio</p>
            <p className="font-medium text-[var(--text)] whitespace-pre-wrap">
              {user.bio || "No bio provided"}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-[var(--text-muted)]">Skills</p>
            {user.skills && user.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-1">
                {user.skills.map((id) => {
                  const skill = availableSkills.find((s) => s.id === id);
                  return (
                    <span key={id} className="badge-default px-2 py-1 text-xs">
                      {skill ? skill.name : "Unknown"}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm font-medium text-[var(--text)]">No skills added</p>
            )}
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
        <label
          htmlFor="display-name"
          className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
        >
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
        <label
          htmlFor="avatar-url"
          className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
        >
          Avatar URL
        </label>
        <input
          id="avatar-url"
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://example.com/avatar.png"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>
      <div>
        <label
          htmlFor="bio"
          className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
        >
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
          Skills
        </label>
        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border border-[var(--border)] rounded-md bg-[var(--input-bg)]">
          {availableSkills.map((skill) => {
            const isSelected = selectedSkills.includes(skill.id);
            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    setSelectedSkills(selectedSkills.filter((id) => id !== skill.id));
                  } else {
                    setSelectedSkills([...selectedSkills, skill.id]);
                  }
                }}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  isSelected
                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                    : "bg-transparent text-[var(--text)] border-[var(--border)] hover:bg-[var(--bg-muted)]"
                }`}
              >
                {skill.name}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Email</label>
        <p className="text-sm text-[var(--text-muted)]">{user.email}</p>
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
          onClick={() => {
            setEditing(false);
            setName(user.display_name);
            setBio(user.bio || "");
            setAvatarUrl(user.avatar_url || "");
            setSelectedSkills(user.skills || []);
          }}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * MFA enrollment and status section.
 * Uses Supabase Auth MFA APIs to list factors, enroll TOTP, and verify.
 */
function MfaSection() {
  const [status, setStatus] = useState<
    "loading" | "none" | "enrolled" | "enrolling" | "verifying" | "confirm-unenroll"
  >("loading");
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [unenrollCode, setUnenrollCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unenrolling, setUnenrolling] = useState(false);

  useEffect(() => {
    async function checkMfaStatus() {
      const supabase = createBrowserClient();
      const { data, error: mfaError } = await supabase.auth.mfa.listFactors();
      if (mfaError || !data) {
        setStatus("none");
        return;
      }
      if (data.totp.length > 0 && data.totp.some((f) => f.status === "verified")) {
        setStatus("enrolled");
      } else {
        setStatus("none");
      }
    }
    checkMfaStatus();
  }, []);

  async function startEnrollment() {
    setError(null);
    setStatus("enrolling");
    const supabase = createBrowserClient();
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Stellar Guardian TOTP",
    });
    if (enrollError || !data) {
      setError(enrollError?.message ?? "Failed to start MFA enrollment.");
      setStatus("none");
      return;
    }
    setQrUri(data.totp.uri);
    setFactorId(data.id);
    setStatus("verifying");
  }

  async function verifyEnrollment() {
    if (!factorId || verifyCode.length !== 6) return;
    setError(null);
    const supabase = createBrowserClient();

    // Challenge then verify
    const { data: challenge, error: chalError } = await supabase.auth.mfa.challenge({ factorId });
    if (chalError || !challenge) {
      setError(chalError?.message ?? "Challenge failed.");
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: verifyCode,
    });

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    setStatus("enrolled");
    setQrUri(null);
    setFactorId(null);
    setVerifyCode("");
  }

  /**
   * H13: MFA unenroll requires re-authentication via the current TOTP code.
   * Called after the user enters their 6-digit code in the confirm-unenroll UI.
   */
  async function confirmAndUnenroll() {
    if (unenrollCode.length !== 6) {
      setError("Enter your 6-digit authenticator code to confirm.");
      return;
    }
    setUnenrolling(true);
    setError(null);
    const supabase = createBrowserClient();
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (!factors || factors.totp.length === 0) {
        setStatus("none");
        return;
      }
      const factor = factors.totp.find((f) => f.status === "verified");
      if (!factor) {
        setStatus("none");
        return;
      }
      // Challenge + verify before unenrolling (H13)
      const { data: challenge, error: chalError } = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });
      if (chalError || !challenge) {
        setError(chalError?.message ?? "Challenge failed. Try again.");
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code: unenrollCode,
      });
      if (verifyError) {
        setError("Incorrect code. Please try again.");
        return;
      }
      // Code verified — now unenroll
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
      setStatus("none");
      setUnenrollCode("");
    } finally {
      setUnenrolling(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
        Checking MFA status…
      </div>
    );
  }

  if (status === "enrolled") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
          <span className="text-sm font-medium text-[var(--success)]">MFA enabled</span>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Your account is protected with TOTP two-factor authentication.
        </p>
        <button
          onClick={() => {
            setStatus("confirm-unenroll");
            setError(null);
            setUnenrollCode("");
          }}
          className="text-xs text-[var(--error)] hover:underline"
        >
          Disable MFA
        </button>
      </div>
    );
  }

  if (status === "confirm-unenroll") {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-[var(--error)]/40 bg-[var(--error-bg)] px-4 py-3 space-y-1">
          <p className="text-sm font-medium text-[var(--error)]">Confirm disabling MFA</p>
          <p className="text-xs text-[var(--text-muted)]">
            Enter your 6-digit authenticator code to confirm. This is required to prevent
            unauthorised removal of your second factor.
          </p>
        </div>

        {error && (
          <p className="text-xs text-[var(--error)]" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-1">
          <label
            htmlFor="unenroll-code"
            className="block text-sm font-medium text-[var(--text-secondary)]"
          >
            Authenticator code
          </label>
          <input
            id="unenroll-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            pattern="[0-9]{6}"
            value={unenrollCode}
            onChange={(e) => setUnenrollCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            autoComplete="one-time-code"
            className="w-32 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={confirmAndUnenroll}
            disabled={unenrolling || unenrollCode.length !== 6}
            className="rounded-md border border-[var(--error)] px-4 py-2 text-sm font-medium text-[var(--error)] hover:bg-[var(--error-bg)] disabled:opacity-50 transition-colors"
          >
            {unenrolling ? "Verifying…" : "Confirm Disable"}
          </button>
          <button
            onClick={() => {
              setStatus("enrolled");
              setError(null);
              setUnenrollCode("");
            }}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (status === "verifying" && qrUri) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-[var(--text-secondary)]">
            Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password):
          </p>
        </div>
        <div className="flex justify-center rounded-lg bg-white p-4">
          {/* QR code rendered as a data URI — the TOTP URI encodes the secret */}
          <div className="text-center space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`}
              alt="TOTP QR Code"
              className="mx-auto"
              width={200}
              height={200}
            />
            <p className="text-[10px] text-neutral-500 font-mono break-all max-w-[240px]">
              {qrUri.split("secret=")[1]?.split("&")[0] ?? ""}
            </p>
          </div>
        </div>
        <div>
          <label
            htmlFor="totp-code"
            className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
          >
            Enter the 6-digit code from your app
          </label>
          <input
            id="totp-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            placeholder="000000"
          />
        </div>
        {error && <p className="text-sm text-[var(--error)]">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={verifyEnrollment}
            disabled={verifyCode.length !== 6}
            className="btn-primary px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50"
          >
            Verify & Enable
          </button>
          <button
            onClick={() => {
              setStatus("none");
              setQrUri(null);
              setError(null);
            }}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // status === "none"
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-muted)]" />
        <span className="text-sm text-[var(--text-muted)]">Not enabled</span>
      </div>
      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
      <button
        onClick={startEnrollment}
        className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
      >
        Enable Two-Factor Authentication
      </button>
    </div>
  );
}
