/**
 * Terms of Service page — static legal content.
 * Accessible without authentication.
 */
export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-16">
      <article className="prose-custom space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">
            Terms of Service
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-2">Last updated: July 21, 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text)]">1. Acceptance of Terms</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            By accessing or using Stellar Guardian (&ldquo;the Platform&rdquo;), you agree to be
            bound by these Terms of Service. If you do not agree, do not use the Platform. These
            terms apply to all users, including organizers, participants, judges, sponsors, and
            mentors.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text)]">2. Platform Description</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Stellar Guardian is a decentralized event management platform that facilitates
            hackathons, competitions, and similar events with on-chain escrow-backed prize
            distribution on the Stellar blockchain network. The Platform provides tools for event
            creation, team formation, submission management, judging, and trustless prize
            disbursement.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text)]">3. Escrow and Financial Terms</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Prize pools are held in platform-custodied Stellar escrow accounts. Funds are verifiable
            on-chain at any time. Disbursement occurs automatically upon completion of the judging
            and dispute resolution process. Once disbursed on-chain, transactions are irreversible.
            The Platform is not responsible for funds sent to incorrect wallet addresses provided by
            users.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text)]">4. User Responsibilities</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Users are responsible for maintaining the security of their accounts and Stellar
            wallets. Users must provide accurate information during registration and wallet
            verification. Users agree not to engage in fraudulent activity, manipulation of judging
            outcomes, or abuse of the dispute system.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text)]">5. Dispute Resolution</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            The Platform provides a built-in dispute mechanism during the objection window following
            judging. Disputes must be filed within the configured review period. The organizer or
            platform administrators will review and resolve disputes. Disbursement is blocked while
            disputes remain unresolved.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text)]">6. Limitation of Liability</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            The Platform is provided &ldquo;as is&rdquo; without warranties. We are not liable for
            losses arising from blockchain network failures, smart contract bugs, wallet
            compromises, or actions taken by other users. Our total liability is limited to the fees
            paid by you to the Platform.
          </p>
        </section>

        <div className="pt-8 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)]">
            For questions about these terms, contact legal@stellarguardian.io
          </p>
        </div>
      </article>
    </main>
  );
}
