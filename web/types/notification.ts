/**
 * Notification and preference schemas (Req 16, 28).
 * Mirrors the `notifications` and `notification_preferences` tables from
 * design.md.
 */
import { z } from "zod";
import { TimestampSchema, UuidSchema } from "./common";

export const NotificationPrioritySchema = z.enum(["urgent", "normal"]);
export type NotificationPriority = z.infer<typeof NotificationPrioritySchema>;

export const NotificationSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  category: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  readAt: TimestampSchema.nullable().optional(),
  priority: NotificationPrioritySchema,
  createdAt: TimestampSchema,
});
export type Notification = z.infer<typeof NotificationSchema>;

export const NotificationPreferenceSchema = z.object({
  userId: UuidSchema,
  category: z.string().min(1),
  emailEnabled: z.boolean(),
});
export type NotificationPreference = z.infer<typeof NotificationPreferenceSchema>;

/** Request body for updating a notification preference (Req 16.1-16.3). */
export const UpdateNotificationPreferenceSchema = z.object({
  category: z.string().min(1),
  emailEnabled: z.boolean(),
});
export type UpdateNotificationPreference = z.infer<typeof UpdateNotificationPreferenceSchema>;
