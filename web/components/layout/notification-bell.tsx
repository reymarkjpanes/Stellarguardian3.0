"use client";

/**
 * Notification bell with badge and dropdown — realtime updates (Req 28.2).
 */
import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: string;
  read: boolean;
  action_url: string | null;
  created_at: string;
}

export function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createBrowserClient();

    async function load() {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, category, read, action_url, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8);

      const items = data ?? [];
      setNotifications(items as unknown as NotificationItem[]);
      setUnreadCount((items as unknown as NotificationItem[]).filter((n) => !n.read).length);
    }

    load();

    // Realtime subscription for new notifications
    const channel = supabase
      .channel("nav-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as NotificationItem;
          setNotifications((prev) => [n, ...prev].slice(0, 8));
          setUnreadCount((c) => c + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function markAllRead() {
    const supabase = createBrowserClient();
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .in("id", unreadIds);

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--error)] text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 card shadow-lg z-50 overflow-hidden">
          <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--text)]">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-[var(--text-muted)]">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <a
                  key={n.id}
                  href={n.action_url ?? "/notifications"}
                  onClick={() => setOpen(false)}
                  className={`block px-3 py-2.5 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-muted)] transition-colors ${
                    !n.read ? "bg-[var(--bg-muted)]" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[var(--text)] truncate">{n.title}</p>
                      <p className="text-xs text-[var(--text-muted)] line-clamp-1 mt-0.5">
                        {n.body}
                      </p>
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>

          <div className="p-2 border-t border-[var(--border)]">
            <a
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-[var(--accent)] font-medium hover:underline py-1"
            >
              View All
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
