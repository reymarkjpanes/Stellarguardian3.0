/**
 * server/routes/notifications.ts
 * In-app notification endpoints. Feeds the NotificationBell and Notifications page.
 */
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import {
  getUserNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllRead,
} from '../services/notificationService';

export const notificationsRouter = Router();

/** GET /api/notifications?page=1&limit=20&unreadOnly=false */
notificationsRouter.get('/', authenticate, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const unreadOnly = req.query.unreadOnly === 'true';

  const result = getUserNotifications(req.user!.id, { page, limit, unreadOnly });
  res.json(result);
});

/** GET /api/notifications/unread-count */
notificationsRouter.get('/unread-count', authenticate, (req, res) => {
  const count = getUnreadCount(req.user!.id);
  res.json({ data: { count } });
});

/** POST /api/notifications/:id/read */
notificationsRouter.post('/:id/read', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) throw new ApiError(400, 'Invalid notification ID.', 'INVALID_ID');

  const success = markNotificationRead(id, req.user!.id);
  if (!success) throw new ApiError(404, 'Notification not found.', 'NOT_FOUND');

  res.json({ data: { success: true } });
});

/** POST /api/notifications/read-all */
notificationsRouter.post('/read-all', authenticate, (req, res) => {
  markAllRead(req.user!.id);
  res.json({ data: { success: true } });
});
