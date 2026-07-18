import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { getAuthToken } from '../lib/api';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: number;
  createdAt: string;
}

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

/**
 * NotificationBell — header notification bell with dropdown popover.
 * Polls unread count every 30 seconds.
 */
export function NotificationBell() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [recent, setRecent] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Poll unread count
  useEffect(() => {
    const currentToken = getAuthToken();
    if (!currentToken) return;
    const fetchCount = async () => {
      try {
        const t = getAuthToken();
        if (!t) return;
        const res = await fetch('/api/notifications/unread-count', {
          headers: { Authorization: `Bearer ${t}` },
        });
        const data = await res.json();
        setUnreadCount(data.data?.count ?? 0);
      } catch {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [user]);

  // Fetch recent when dropdown opens
  const handleOpen = async () => {
    const currentToken = getAuthToken();
    if (!currentToken) return;
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setIsLoading(true);
      try {
        const res = await fetch('/api/notifications?limit=5', {
          headers: { Authorization: `Bearer ${currentToken}` },
        });
        const data = await res.json();
        setRecent(data.items ?? []);
      } catch {} finally {
        setIsLoading(false);
      }
    }
  };

  const markRead = async (id: number) => {
    setRecent((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: 1 } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    const t = getAuthToken();
    await fetch(`/api/notifications/${id}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
    });
  };

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        id="notification-bell"
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-900"
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none"
              aria-hidden="true"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="notification-dropdown"
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
              {unreadCount > 0 && (
                <span className="text-xs text-slate-400">{unreadCount} unread</span>
              )}
            </div>

            {/* Body */}
            <div className="max-h-80 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-12 rounded-lg" />
                  ))}
                </div>
              ) : recent.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-slate-500">No notifications yet</p>
                </div>
              ) : (
                <div>
                  {recent.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (n.isRead === 0) markRead(n.id);
                        setIsOpen(false);
                      }}
                      className={`px-4 py-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${
                        n.isRead === 0 ? 'bg-indigo-50' : ''
                      }`}
                    >
                      {n.link ? (
                        <Link to={n.link} className="block" tabIndex={-1}>
                          <NotifItem n={n} />
                        </Link>
                      ) : (
                        <NotifItem n={n} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-slate-100">
              <Link
                to="/notifications"
                onClick={() => setIsOpen(false)}
                className="block text-center text-xs text-indigo-600 font-medium hover:text-indigo-700"
              >
                View all notifications
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotifItem({ n }: { n: Notification }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-base shrink-0 mt-0.5" aria-hidden="true">
        {typeIcon[n.type] ?? '🔔'}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-900 line-clamp-1">{n.title}</p>
        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
      </div>
      {n.isRead === 0 && (
        <span className="shrink-0 w-2 h-2 bg-indigo-500 rounded-full mt-1" aria-label="Unread" />
      )}
    </div>
  );
}
