/**
 * Privacy Policy page.
 */
export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 prose prose-neutral dark:prose-invert">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-neutral-500">Last updated: January 2025</p>

      <h2>1. Information We Collect</h2>
      <p>We collect information you provide directly:</p>
      <ul>
        <li>Account information (email, display name)</li>
        <li>Wallet public keys (connected via challenge-response verification)</li>
        <li>Event participation data (team memberships, submissions, evaluations)</li>
        <li>Transaction records (on-chain hashes, amounts, timestamps)</li>
      </ul>

      <h2>2. How We Use Information</h2>
      <ul>
        <li>To operate and maintain the Platform</li>
        <li>To process prize distributions and refunds via the Stellar network</li>
        <li>To send notifications about event updates, disputes, and financial operations</li>
        <li>To maintain audit records for compliance</li>
      </ul>

      <h2>3. Data Sharing</h2>
      <p>
        We do not sell personal data. We share information only in these circumstances:
      </p>
      <ul>
        <li>With event organizers (your participation status, submission content)</li>
        <li>On the Stellar blockchain (transaction data is public by nature)</li>
        <li>When required by law or to protect rights</li>
      </ul>

      <h2>4. Data Security</h2>
      <p>
        We use industry-standard security measures including encrypted storage, Row Level
        Security on all database tables, KMS-encrypted escrow keys, and HTTPS for all
        communications.
      </p>

      <h2>5. Data Retention</h2>
      <p>
        Account data is retained while your account is active. Financial audit records are
        retained for 7 years. You may request account deactivation at any time.
      </p>

      <h2>6. Your Rights</h2>
      <p>
        You may access, correct, or request deletion of your personal data by contacting
        privacy@stellarguardian.app. Note that blockchain transaction records cannot be deleted.
      </p>

      <h2>7. Contact</h2>
      <p>
        For privacy inquiries: privacy@stellarguardian.app
      </p>
    </main>
  );
}
