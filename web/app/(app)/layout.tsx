import { createServerClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/layout/app-nav";
import { CommandPalette } from "@/components/ui/command-palette";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const displayName = user?.user_metadata?.display_name ?? user?.email ?? "";
  const email = user?.email ?? "";

  // Fetch wallet info for the nav
  let wallet: { publicKey: string; network: string; verified: boolean } | null = null;
  if (user) {
    const { data: walletData } = await supabase
      .from("wallets")
      .select("public_key, network_mode, verification_status")
      .eq("user_id", user.id)
      .eq("verification_status", "Verified")
      .limit(1)
      .maybeSingle();

    if (walletData) {
      wallet = {
        publicKey: walletData.public_key,
        network: walletData.network_mode,
        verified: walletData.verification_status === "Verified",
      };
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav
        user={user ? { id: user.id, name: displayName, email } : null}
        wallet={wallet}
      />
      <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <CommandPalette />
      <footer className="border-t border-[var(--border)] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-[var(--text-muted)]">
            &copy; {new Date().getFullYear()} Stellar Guardian. Powered by Stellar.
          </p>
          <div className="flex items-center gap-6">
            <a href="/terms" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">Terms</a>
            <a href="/privacy" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">Privacy</a>
            <a href="/discover" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">Events</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
