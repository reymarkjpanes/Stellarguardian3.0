"use client";

/**
 * Notifications page (Req 16.1, 28).
 */
import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

interface Notification {
  id: string;
  category: string;
  title: string;
  body: string;
  read: boolean;
  action_url: string | null;
  created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setNotifications(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function markRead(id: string) {
    const supabase = createBrowserClient();
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }

  async function markAllRead() {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const typeIcons: Record<string, string> = {
    dispute: "⚖️", disbursement: "💸", security: "🔒", escrow: "🏦",
    team: "👥", submission: "📄", evaluation: "⭐", event_update: "📢",
    milestone: "🎯", invitation: "✉️", system: "🔔",
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Notifications</h1>
          {unreadCount > 0 && (
            <span className="bg-neutral-900 text-white text-xs font-bold rounded-full px-2 py-0.5">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📭</p>
          <h2 className="font-medium text-neutral-700 mb-1">No notifications yet</h2>
          <p className="text-sm text-neutral-500">Event updates and alerts will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => { if (!n.read) markRead(n.id); if (n.action_url) window.location.href = n.action_url; }}
              className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                !n.read ? "bg-neutral-50 border-neutral-300" : "bg-white border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">{typeIcons[n.category] ?? "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${!n.read ? "text-neutral-900" : "text-neutral-700"}`}>{n.title}</p>
                  <p className="text-sm text-neutral-500 mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    {new Date(n.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {!n.read && <span className="mt-1 h-2 w-2 rounded-full bg-neutral-900 shrink-0" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
