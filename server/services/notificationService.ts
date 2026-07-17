/**
 * server/services/notificationService.ts
 * Creates in-app notifications and triggers emails for all lifecycle events.
 * 
 * Every user-facing event in the system should call notify() to ensure
 * users receive both in-app notifications and emails.
 */
import db from '../db/client';
import { sendEmail } from './emailService';

export type NotificationType =
  | 'membership_applied'
  | 'membership_approved'
  | 'membership_rejected'
  | 'event_started'
  | 'judging_started'
  | 'winner_announced'
  | 'prize_sent'
  | 'event_cancelled'
  | 'new_announcement';

interface NotifyPayload {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  // Optional: trigger an email. If provided, sends to this address.
  email?: {
    to: string;
    name: string;
  };
  emailPayload?: Parameters<typeof sendEmail>[0];
}

/**
 * Create an in-app notification and optionally send an email.
 * Ensures the notifications table exists (migration-safe).
 */
export async function notify(payload: NotifyPayload): Promise<void> {
  // Create notifications table if it doesn't exist (migration-safe during Phase 2 transition)
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      isRead INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Write in-app notification to DB
  db.prepare(
    'INSERT INTO notifications (userId, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
  ).run(payload.userId, payload.type, payload.title, payload.message, payload.link ?? null);

  // Send email if payload provided
  if (payload.emailPayload) {
    await sendEmail(payload.emailPayload);
  }
}

// ─── Convenience Helpers ──────────────────────────────────────────────────────

/** Notify host that someone applied to their event */
export async function notifyMembershipApplied(
  hostUserId: number,
  applicantName: string,
  eventTitle: string,
  eventId: number,
) {
  await notify({
    userId: hostUserId,
    type: 'membership_applied',
    title: `New application: ${applicantName}`,
    message: `${applicantName} applied to join "${eventTitle}".`,
    link: `/events/${eventId}?tab=members`,
  });
}

/** Notify participant their application was approved */
export async function notifyMembershipApproved(
  userId: number,
  userEmail: string,
  userName: string,
  eventTitle: string,
  eventId: number,
) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  await notify({
    userId,
    type: 'membership_approved',
    title: `Approved: ${eventTitle}`,
    message: `Your application to "${eventTitle}" was approved.`,
    link: `/events/${eventId}`,
    emailPayload: {
      type: 'membership_approved',
      to: userEmail,
      name: userName,
      eventTitle,
      eventLink: `${appUrl}/events/${eventId}`,
    },
  });
}

/** Notify participant their application was rejected */
export async function notifyMembershipRejected(
  userId: number,
  userEmail: string,
  userName: string,
  eventTitle: string,
) {
  await notify({
    userId,
    type: 'membership_rejected',
    title: `Application update: ${eventTitle}`,
    message: `Your application to "${eventTitle}" was not approved.`,
    emailPayload: {
      type: 'membership_rejected',
      to: userEmail,
      name: userName,
      eventTitle,
    },
  });
}

/** Notify all participants/judges that an event was cancelled */
export async function notifyEventCancelled(
  memberUserIds: Array<{ userId: number; email: string; name: string }>,
  eventTitle: string,
  eventId: number,
) {
  for (const member of memberUserIds) {
    await notify({
      userId: member.userId,
      type: 'event_cancelled',
      title: `Event cancelled: ${eventTitle}`,
      message: `"${eventTitle}" has been cancelled.`,
      link: `/events/${eventId}`,
      emailPayload: {
        type: 'event_cancelled',
        to: member.email,
        name: member.name,
        eventTitle,
      },
    });
  }
}

/** Get unread notification count for a user */
export function getUnreadCount(userId: number): number {
  const row = db
    .prepare('SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND isRead = 0')
    .get(userId) as { count: number };
  return row.count;
}

/** Get paginated notifications for a user */
export function getUserNotifications(
  userId: number,
  { page = 1, limit = 20, unreadOnly = false }: { page?: number; limit?: number; unreadOnly?: boolean },
) {
  const offset = (page - 1) * limit;
  const whereClause = unreadOnly
    ? 'WHERE userId = ? AND isRead = 0'
    : 'WHERE userId = ?';

  const items = db
    .prepare(
      `SELECT id, type, title, message, link, isRead, createdAt
       FROM notifications
       ${whereClause}
       ORDER BY createdAt DESC
       LIMIT ? OFFSET ?`,
    )
    .all(userId, limit, offset);

  const total = (
    db
      .prepare(`SELECT COUNT(*) as count FROM notifications ${whereClause}`)
      .get(userId) as { count: number }
  ).count;

  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/** Mark a notification as read */
export function markNotificationRead(notificationId: number, userId: number): boolean {
  const result = db
    .prepare('UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?')
    .run(notificationId, userId);
  return result.changes > 0;
}

/** Mark all notifications as read for a user */
export function markAllRead(userId: number): void {
  db.prepare('UPDATE notifications SET isRead = 1 WHERE userId = ? AND isRead = 0').run(userId);
}
