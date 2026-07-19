/**
 * Root page — Landing page for unauthenticated visitors,
 * redirect to dashboard for authenticated users.
 *
 * Design decisions:
 * - System-font, no Inter default
 * - Dark bg-inverse hero (trust signal for financial platform)
 * - Single accent color throughout
 * - No AI-purple gradients
 * - Monospace for blockchain identifiers
 * - Compact hero (fits viewport, headline max 2 lines)
 */
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  // Silently check auth — if Supabase is unavailable, fall through to landing page
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      redirect("/dashboard");
    }
  } catch {
    // Supabase unavailable or misconfigured — show landing page anyway
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Navigation */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-[var(--border)] bg-[var(--nav-bg)] backdrop-blur-md">
        <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="text-base font-semibold tracking-tight text-[var(--text)]">
            Stellar Guardian
          </a>
          <div className="flex items-center gap-4">
            <a href="/discover" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
              Events
            </a>
            <a href="/login" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
              Sign in
            </a>
            <a
              href="/signup"
              className="rounded-md bg-[var(--btn-primary-bg)] px-3.5 py-1.5 text-sm font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors"
            >
              Get started
            </a>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="pt-28 pb-20 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]">
            Blockchain-backed event management
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[var(--text)] leading-[1.1]">
            Trustless prize distribution for hackathons
          </h1>
          <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto">
            Create events, fund escrow on Stellar, and disburse prizes automatically — no middleman, no disputes.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <a
              href="/signup"
              className="rounded-md bg-[var(--btn-primary-bg)] px-5 py-2.5 text-sm font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors"
            >
              Start organizing
            </a>
            <a
              href="/discover"
              className="rounded-md border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
            >
              Browse events
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-center text-[var(--text)] mb-12">
            How it works
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            <StepCard
              number="1"
              title="Create & configure"
              description="Set up your hackathon with teams, judging criteria, prize pool, and timeline — all in one place."
            />
            <StepCard
              number="2"
              title="Fund the escrow"
              description="Deposit XLM to a platform-custodied escrow account via your Stellar wallet. Funds are verifiable on-chain."
            />
            <StepCard
              number="3"
              title="Disburse prizes"
              description="Winners are paid automatically after judging. No manual transfers, no disputes, no trust required."
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-[var(--bg-elevated)] border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-center text-[var(--text)] mb-12">
            Built for serious events
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              title="On-chain escrow"
              description="Prize pools locked in Stellar escrow accounts. Verifiable by anyone, anytime."
            />
            <FeatureCard
              title="16-state lifecycle"
              description="From draft to archived — every phase is tracked with precondition guards."
            />
            <FeatureCard
              title="Fair judging"
              description="Conflict-of-interest detection, structured rubrics, and transparent scoring."
            />
            <FeatureCard
              title="Dispute resolution"
              description="Built-in objection window and dispute process before irreversible disbursement."
            />
            <FeatureCard
              title="Team formation"
              description="Self-service team creation, join requests, and size enforcement."
            />
            <FeatureCard
              title="Workspace management"
              description="Organize multiple events under workspaces with role-based access control."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 border-t border-[var(--border)]">
        <div className="max-w-xl mx-auto text-center space-y-4">
          <h2 className="text-2xl font-semibold text-[var(--text)]">
            Ready to run your first event?
          </h2>
          <p className="text-[var(--text-secondary)]">
            Join organizers using Stellar Guardian to distribute prizes transparently.
          </p>
          <a
            href="/signup"
            className="inline-block rounded-md bg-[var(--btn-primary-bg)] px-6 py-2.5 text-sm font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors"
          >
            Create your account
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
          <p>© 2026 Stellar Guardian. Built on the Stellar network.</p>
          <div className="flex gap-4">
            <a href="/terms" className="hover:text-[var(--text)]">Terms</a>
            <a href="/privacy" className="hover:text-[var(--text)]">Privacy</a>
            <a href="/discover" className="hover:text-[var(--text)]">Events</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center space-y-3">
      <div className="mx-auto h-10 w-10 rounded-full bg-[var(--accent-muted)] flex items-center justify-center text-sm font-bold text-[var(--accent)]">
        {number}
      </div>
      <h3 className="font-medium text-[var(--text)]">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="card p-5 space-y-2">
      <h3 className="font-medium text-[var(--text)]">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}
