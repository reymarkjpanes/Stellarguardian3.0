"use client";

/**
 * Notifications center page.
 *
 * Displays all notifications for the current user with read/unread state,
 * category badges, and mark-as-read functionality.
 *
 * Design: Card list with category color coding. System font. CSS variables.
 * No pagination needed initially (limit 50 most recent).
 */
import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

interface Notification {
  id: string;
  category: string;
  title: string;
  body: string;
  read: boolean;
  event_id: string | null;
  created_at: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  escrow: "var(--accent)",
  disbursement: "var(--success)",
  dispute: "var(--warning)",
  team: "var(--text-secondary)",
  event: "var(--accent)",
  system: "var(--text-muted)",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    const supabase = createBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("notifications")
      .select("id, category, title, body, read, event_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setNotifications(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotifications();
  }, [loadNotifications]);

  async function markAsRead(id: string) {
    const supabase = createBrowserClient();
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  async function markAllRead() {
    const supabase = createBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-12 flex justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-[var(--text-muted)] mt-1">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm font-medium text-[var(--accent)] hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-[var(--text-muted)]">No notifications yet.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            You&apos;ll receive updates about events, teams, and prizes here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`card p-4 transition-colors ${!n.read ? "border-l-2" : ""}`}
              style={{
                borderLeftColor: !n.read
                  ? (CATEGORY_COLORS[n.category] ?? "var(--accent)")
                  : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${CATEGORY_COLORS[n.category] ?? "var(--text-muted)"} 15%, transparent)`,
                        color: CATEGORY_COLORS[n.category] ?? "var(--text-muted)",
                      }}
                    >
                      {n.category}
                    </span>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                  </div>
                  <p
                    className={`text-sm mt-1 ${n.read ? "text-[var(--text-secondary)]" : "text-[var(--text)] font-medium"}`}
                  >
                    {n.title}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-2">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>

                {!n.read && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="shrink-0 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    title="Mark as read"
                  >
                    ✓
                  </button>
                )}
              </div>

              {n.event_id && (
                <a
                  href={`/events/${n.event_id}`}
                  className="inline-block mt-2 text-xs text-[var(--accent)] hover:underline"
                >
                  View event →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
