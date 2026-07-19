/**
 * Terms of Service page (Req 34.1).
 */
export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 prose prose-neutral dark:prose-invert">
      <h1>Terms of Service</h1>
      <p className="text-sm text-neutral-500">Last updated: January 2025 · Version 1.0</p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using Stellar Guardian ("Platform"), you agree to be bound by these
        Terms of Service. If you do not agree to these terms, do not use the Platform.
      </p>

      <h2>2. Platform Description</h2>
      <p>
        Stellar Guardian is a hackathon and event management platform that facilitates prize
        pool management, team formation, and project evaluation using the Stellar blockchain
        network for financial operations.
      </p>

      <h2>3. User Accounts</h2>
      <p>
        You must create an account to access most features. You are responsible for maintaining
        the security of your account credentials and connected wallets. You agree to notify us
        immediately of any unauthorized access.
      </p>

      <h2>4. Wallet Connection & Financial Operations</h2>
      <p>
        The Platform uses the Stellar blockchain for escrow, prize distribution, and refund
        operations. By connecting a wallet and participating in funded events, you acknowledge:
      </p>
      <ul>
        <li>Blockchain transactions are irreversible once confirmed on-chain.</li>
        <li>The Platform acts as a custodian for escrow funds only — it does not provide investment advice.</li>
        <li>Prize amounts are denominated in XLM and subject to market fluctuation.</li>
        <li>Wallet verification via challenge-response is required for financial operations.</li>
      </ul>

      <h2>5. Event Participation</h2>
      <p>
        Participants agree to act in good faith, submit original work, and abide by event-specific
        rules set by organizers. The Platform reserves the right to disqualify participants who
        violate rules or engage in fraudulent activity.
      </p>

      <h2>6. Disputes</h2>
      <p>
        The Platform provides a dispute resolution mechanism during the Review Objection Window.
        Disputes are reviewed by event organizers or platform administrators. Decisions on
        disputes are final.
      </p>

      <h2>7. Data Retention</h2>
      <p>
        Event data is retained for the configured retention period (default 90 days after completion).
        Audit records are retained for 7 years for compliance purposes. Users may request account
        deactivation but financial audit records are preserved per regulatory requirements.
      </p>

      <h2>8. Limitation of Liability</h2>
      <p>
        The Platform is provided "as is" without warranty. We are not liable for losses resulting
        from blockchain network failures, wallet compromises, or third-party service outages.
        Maximum liability is limited to fees paid to the Platform in the preceding 12 months.
      </p>

      <h2>9. Changes to Terms</h2>
      <p>
        We may update these terms at any time. Users will be notified of material changes and
        must accept the updated terms to continue using the Platform. Your continued use after
        notification constitutes acceptance.
      </p>

      <h2>10. Contact</h2>
      <p>
        For questions about these terms, contact us at legal@stellarguardian.app.
      </p>
    </main>
  );
}
