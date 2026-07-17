import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, Inbox } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: number;
  createdAt: string;
}

/**
 * Notifications page — full notification center.
 * Route: /notifications (protected)
 */
export default function Notifications() {
  const { token } = useAuth() as any;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setNotifications(data.items ?? []);
      setTotal(data.meta?.total ?? 0);
    } catch {
      // fail silently
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markRead = async (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: 1 } : n)),
    );
    await fetch(`/api/notifications/${id}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: 1 })));
    await fetch('/api/notifications/read-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  const unreadCount = notifications.filter((n) => n.isRead === 0).length;

  const typeIcon: Record<string, string> = {
    membership_approved: '✅',
    membership_rejected: '❌',
    membership_applied: '📬',
    winner_announced: '🏆',
    prize_sent: '💸',
    event_cancelled: '🚫',
    new_announcement: '📢',
    event_started: '🚀',
    judging_started: '⚖️',
  };

  return (
    <main id="main-content" className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-indigo-600" aria-hidden="true" />
          <h1 className="text-xl font-display font-bold text-slate-900">Notifications</h1>
          {unreadCount > 0 && (
            <span className="bg-indigo-600 text-white text-xs font-bold rounded-full px-2 py-0.5" aria-label={`${unreadCount} unread`}>
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:text-indigo-700 transition-colors"
            aria-label="Mark all notifications as read"
          >
            <CheckCheck className="w-4 h-4" aria-hidden="true" />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading notifications">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
            <Inbox className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-700 mb-1">No notifications yet</h2>
          <p className="text-sm text-slate-500">
            You'll see event updates, membership approvals, and announcements here.
          </p>
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label="Notifications">
          <AnimatePresence initial={false}>
            {notifications.map((n) => (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                role="listitem"
                className={`rounded-xl border p-4 transition-colors cursor-pointer ${
                  n.isRead === 0
                    ? 'bg-indigo-50 border-indigo-100 hover:bg-indigo-100'
                    : 'bg-white border-slate-100 hover:bg-slate-50'
                }`}
                onClick={() => {
                  if (n.isRead === 0) markRead(n.id);
                  if (n.link) window.location.href = n.link;
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5 shrink-0" aria-hidden="true">
                    {typeIcon[n.type] ?? '🔔'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold ${n.isRead === 0 ? 'text-slate-900' : 'text-slate-700'}`}>
                        {n.title}
                      </p>
                      {n.isRead === 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                          className="shrink-0 text-indigo-600 hover:text-indigo-700"
                          aria-label="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(n.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </main>
  );
}
