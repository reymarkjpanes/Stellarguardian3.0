import { createServerClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/layout/app-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const displayName = user?.user_metadata?.display_name ?? user?.email ?? "";
  const email = user?.email ?? "";

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav user={user ? { id: user.id, name: displayName, email } : null} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="border-t border-[var(--border)] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-[var(--text-muted)]">
            &copy; {new Date().getFullYear()} Stellar Guardian. Powered by Stellar.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">Terms</a>
            <a href="#" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">Privacy</a>
            <a href="#" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
