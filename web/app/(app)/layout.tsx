import { AppNav } from "@/components/layout/app-nav";
import { getCurrentUser, getCurrentUserWallet } from "@/lib/data/user";
import { CommandPaletteLoader } from "@/components/ui/command-palette-loader";
import { QueryProvider } from "@/components/providers/query-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  const displayName = user?.user_metadata?.display_name ?? user?.email ?? "";
  const email = user?.email ?? "";

  // Fetch wallet only if user is authenticated — doesn't block rendering
  // since getCurrentUser is cached and walletData is secondary nav data.
  const walletData = user ? await getCurrentUserWallet(user.id) : null;

  const wallet = walletData
    ? {
        publicKey: walletData.public_key,
        network: walletData.network_mode,
        verified: walletData.verification_status === "Verified",
      }
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav
        user={user ? { id: user.id, name: displayName, email } : null}
        wallet={wallet}
      />
      <main
        id="main-content"
        className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
      >
        <QueryProvider>{children}</QueryProvider>
      </main>
      <CommandPaletteLoader />
      <footer className="border-t border-[var(--border)] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-[var(--text-muted)]">
            &copy; {new Date().getFullYear()} Stellar Guardian. Powered by Stellar.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="/terms"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Terms
            </a>
            <a
              href="/privacy"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Privacy
            </a>
            <a
              href="/discover"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Events
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
