/**
 * Privacy Policy page — static legal content.
 * Accessible without authentication.
 */
export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-16">
      <article className="prose-custom space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">
            Privacy Policy
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Last updated: July 21, 2026
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text)]">1. Information We Collect</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            We collect information you provide directly: email address, display name, and Stellar
            wallet public keys. We also collect usage data (pages visited, actions taken) and
            technical data (browser type, IP address) for security and analytics purposes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text)]">2. Blockchain Data</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Stellar wallet public keys and transaction hashes are stored to facilitate escrow
            operations. Public keys are inherently public on the Stellar network. We never store
            private keys in plaintext — all escrow secret keys are encrypted using AES-256-GCM
            (development) or AWS KMS envelope encryption (production). Transaction history is
            recorded for audit and verification purposes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text)]">3. How We Use Your Information</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Your information is used to: provide platform services (event management, team formation,
            judging, prize distribution); verify wallet ownership; send notifications about events you
            participate in; maintain security and prevent fraud; comply with legal obligations.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text)]">4. Data Sharing</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            We do not sell your personal data. We share information only with: Supabase (database
            hosting), Stellar network (blockchain transactions — public by nature), email service
            providers (notifications), and as required by law.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text)]">5. Data Retention</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Account data is retained while your account is active. Event data is retained per the
            event's configured retention period (default: 90 days after completion). Blockchain
            transactions are permanent and cannot be deleted from the Stellar ledger. You may request
            account deletion, which will remove your personal data within 30 days while preserving
            anonymized audit records.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text)]">6. Your Rights</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            You have the right to: access your personal data; correct inaccurate data; request
            deletion of your account; export your data; withdraw consent for optional processing.
            To exercise these rights, contact privacy@stellarguardian.io.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text)]">7. Security</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            We implement industry-standard security measures including: encrypted data at rest and
            in transit, Content Security Policy headers, rate limiting, audit logging, and KMS-based
            encryption for sensitive cryptographic material. Despite these measures, no system is
            100% secure — use strong passwords and protect your wallet credentials.
          </p>
        </section>

        <div className="pt-8 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)]">
            For privacy concerns, contact privacy@stellarguardian.io
          </p>
        </div>
      </article>
    </main>
  );
}
