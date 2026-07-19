"use client";

/**
 * App navigation bar — sticky header with desktop/mobile nav and theme toggle.
 */
import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";

interface AppNavProps {
  user: { id: string; name: string; email: string } | null;
  wallet?: { publicKey: string; network: string; verified: boolean } | null;
}

export function AppNav({ user, wallet }: AppNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <header className="nav-surface sticky top-0 z-50 border-b border-[var(--nav-border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          {/* Logo */}
          <div className="flex items-center">
            <a href="/" className="flex items-center gap-2 group">
              <div className="w-7 h-7 bg-[var(--accent)] rounded-lg flex items-center justify-center">
                <div className="w-3.5 h-3.5 border-2 border-white rounded-full border-t-transparent animate-spin" style={{ animationDuration: "2s" }} />
              </div>
              <span className="text-lg font-bold tracking-tight text-[var(--text)]">
                Stellar <span className="text-[var(--text-secondary)]">Guardian</span>
              </span>
            </a>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4">
            <a href="/discover" className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
              Browse Events
            </a>

            {user ? (
              <div className="flex items-center gap-3 border-l border-[var(--border)] pl-4">
                <a href="/dashboard" className="text-sm font-medium text-[var(--text)] hover:text-[var(--accent)] transition-colors">
                  My Events
                </a>
                <a href="/events/new" className="btn-primary text-sm font-medium px-4 py-1.5 rounded-md transition-colors">
                  Create Event
                </a>
                <NotificationBell userId={user.id} />

                {/* Wallet badge in header */}
                {wallet && (
                  <a
                    href="/settings"
                    className="hidden lg:flex items-center gap-2 rounded-md border border-[var(--border)] px-2.5 py-1.5 hover:bg-[var(--bg-muted)] transition-colors"
                    title={`Wallet: ${wallet.publicKey}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${wallet.verified ? "bg-green-400" : "bg-amber-400"}`} />
                    <span className="text-xs font-mono text-[var(--text-secondary)]">
                      {wallet.publicKey.slice(0, 4)}…{wallet.publicKey.slice(-4)}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">{wallet.network}</span>
                  </a>
                )}
                {!wallet && user && (
                  <a
                    href="/settings"
                    className="hidden lg:flex items-center gap-1.5 rounded-md border border-dashed border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors"
                  >
                    <span>🔗</span>
                    <span>Connect Wallet</span>
                  </a>
                )}

                <ThemeToggle />

                {/* Profile dropdown */}
                <div className="relative ml-1">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="h-8 w-8 rounded-full bg-[var(--bg-muted)] flex items-center justify-center text-sm font-semibold text-[var(--text)] hover:ring-2 hover:ring-[var(--border)] transition-all"
                    aria-label="User menu"
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </button>
                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-52 card shadow-lg z-50">
                        <div className="p-3 border-b border-[var(--border)]">
                          <p className="text-sm font-medium text-[var(--text)] truncate">{user.name}</p>
                          <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
                        </div>
                        <div className="p-1">
                          <a href="/settings" onClick={() => setProfileOpen(false)} className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] rounded-md">
                            Settings
                          </a>
                          <a href="/notifications" onClick={() => setProfileOpen(false)} className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] rounded-md">
                            Notifications
                          </a>
                          <button
                            onClick={handleSignOut}
                            className="block w-full text-left px-3 py-2 text-sm text-[var(--error)] hover:bg-[var(--error-bg)] rounded-md mt-1"
                          >
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <a href="/login" className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] px-3 py-1.5 rounded-md hover:bg-[var(--bg-muted)] transition-colors">
                  Log in
                </a>
                <a href="/signup" className="btn-primary text-sm font-medium px-4 py-1.5 rounded-md transition-colors">
                  Sign up
                </a>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden gap-2">
            <ThemeToggle />
            <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-md text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)]">
              {mobileOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--bg)] px-4 py-3 space-y-2">
          <a href="/discover" className="block py-2 text-sm font-medium text-[var(--text-secondary)]" onClick={() => setMobileOpen(false)}>Browse Events</a>
          {user ? (
            <>
              <a href="/dashboard" className="block py-2 text-sm font-medium text-[var(--text)]" onClick={() => setMobileOpen(false)}>My Events</a>
              <a href="/events/new" className="block py-2 text-sm font-medium text-[var(--text)] bg-[var(--bg-muted)] rounded-md px-3" onClick={() => setMobileOpen(false)}>Create Event</a>
              <a href="/notifications" className="block py-2 text-sm font-medium text-[var(--text-secondary)]" onClick={() => setMobileOpen(false)}>Notifications</a>
              <a href="/settings" className="block py-2 text-sm font-medium text-[var(--text-secondary)]" onClick={() => setMobileOpen(false)}>Settings</a>
              <button onClick={handleSignOut} className="block w-full text-left py-2 text-sm font-medium text-[var(--error)]">Sign Out</button>
            </>
          ) : (
            <>
              <a href="/login" className="block py-2 text-sm font-medium text-[var(--text-secondary)]" onClick={() => setMobileOpen(false)}>Log in</a>
              <a href="/signup" className="block py-2 text-sm font-medium text-[var(--text)]" onClick={() => setMobileOpen(false)}>Sign up</a>
            </>
          )}
        </div>
      )}
    </header>
  );
}
