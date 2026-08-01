"use client";

/**
 * App navigation bar — sticky header with desktop/mobile nav and theme toggle.
 *
 * Uses Next.js <Link> for all internal navigation (required by
 * @next/next/no-html-link-for-pages). External links remain <a>.
 * WalletButton is rendered here — requires WalletProvider in the tree above.
 */
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import { WalletButton } from "@/components/wallet/WalletButton";
import { WorkspaceSwitcher, type WorkspaceItem } from "@/components/layout/workspace-switcher";

interface AppNavProps {
  user: { id: string; name: string; email: string } | null;
  workspaces?: WorkspaceItem[];
  currentWorkspaceId?: string;
}

export function AppNav({ user, workspaces = [], currentWorkspaceId }: AppNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Redirect to onboarding if profile is incomplete
  useEffect(() => {
    if (user && user.name === user.email && window.location.pathname !== "/onboarding") {
      window.location.href = "/onboarding";
    }
  }, [user]);

  // Close profile dropdown on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && profileOpen) setProfileOpen(false);
    }
    if (profileOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [profileOpen]);

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
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-7 h-7 bg-[var(--accent)] rounded-lg flex items-center justify-center">
                <div
                  className="w-3.5 h-3.5 border-2 border-white rounded-full border-t-transparent animate-spin"
                  style={{ animationDuration: "2s" }}
                  aria-hidden="true"
                />
              </div>
              <span className="text-lg font-bold tracking-tight text-[var(--text)] hidden sm:inline-block">
                {"Stellar "}
                <span className="text-[var(--text-secondary)]">Guardian</span>
              </span>
            </Link>

            {user && workspaces.length > 0 && (
              <>
                <div className="h-6 w-px bg-[var(--border)] mx-1" aria-hidden="true" />
                <WorkspaceSwitcher
                  workspaces={workspaces}
                  currentWorkspaceId={currentWorkspaceId}
                />
              </>
            )}
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/discover"
              className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
            >
              Browse Events
            </Link>

            {user ? (
              <div className="flex items-center gap-3 border-l border-[var(--border)] pl-4">
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-[var(--text)] hover:text-[var(--accent)] transition-colors"
                >
                  My Events
                </Link>

                <Link
                  href="/events/new"
                  className="btn-primary text-sm font-medium px-4 py-1.5 rounded-md transition-colors"
                >
                  Create Event
                </Link>

                <NotificationBell userId={user.id} />

                {/* Live wallet button — consumes WalletProvider context */}
                <WalletButton />

                <ThemeToggle />

                {/* Profile dropdown */}
                <div className="relative ml-1" ref={dropdownRef}>
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="h-8 w-8 rounded-full bg-[var(--bg-muted)] flex items-center justify-center text-sm font-semibold text-[var(--text)] hover:ring-2 hover:ring-[var(--border)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    aria-label="User menu"
                    aria-expanded={profileOpen}
                    aria-haspopup="true"
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </button>

                  {profileOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setProfileOpen(false)}
                        aria-hidden="true"
                      />
                      <div className="absolute right-0 top-full mt-2 w-52 card shadow-lg z-50">
                        <div className="p-3 border-b border-[var(--border)]">
                          <p className="text-sm font-medium text-[var(--text)] truncate">
                            {user.name}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
                        </div>
                        <div className="p-1">
                          <Link
                            href="/settings"
                            onClick={() => setProfileOpen(false)}
                            className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] rounded-md"
                          >
                            Settings
                          </Link>
                          <Link
                            href="/notifications"
                            onClick={() => setProfileOpen(false)}
                            className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] rounded-md"
                          >
                            Notifications
                          </Link>
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
                <Link
                  href="/login"
                  className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] px-3 py-1.5 rounded-md hover:bg-[var(--bg-muted)] transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="btn-primary text-sm font-medium px-4 py-1.5 rounded-md transition-colors"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu toggle */}
          <div className="flex items-center md:hidden gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-md text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)]"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--bg)] px-4 py-3 space-y-2">
          <Link
            href="/discover"
            className="block py-2 text-sm font-medium text-[var(--text-secondary)]"
            onClick={() => setMobileOpen(false)}
          >
            Browse Events
          </Link>

          {user ? (
            <>
              <Link
                href="/dashboard"
                className="block py-2 text-sm font-medium text-[var(--text)]"
                onClick={() => setMobileOpen(false)}
              >
                My Events
              </Link>
              <Link
                href="/events/new"
                className="block py-2 text-sm font-medium text-[var(--text)] bg-[var(--bg-muted)] rounded-md px-3"
                onClick={() => setMobileOpen(false)}
              >
                Create Event
              </Link>
              <Link
                href="/notifications"
                className="block py-2 text-sm font-medium text-[var(--text-secondary)]"
                onClick={() => setMobileOpen(false)}
              >
                Notifications
              </Link>
              <Link
                href="/settings"
                className="block py-2 text-sm font-medium text-[var(--text-secondary)]"
                onClick={() => setMobileOpen(false)}
              >
                Settings
              </Link>
              <button
                onClick={handleSignOut}
                className="block w-full text-left py-2 text-sm font-medium text-[var(--error)]"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="block py-2 text-sm font-medium text-[var(--text-secondary)]"
                onClick={() => setMobileOpen(false)}
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="block py-2 text-sm font-medium text-[var(--text)]"
                onClick={() => setMobileOpen(false)}
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
