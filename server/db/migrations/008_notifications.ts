/**
 * 008_notifications.ts
 * Create notifications table for in-app notification center.
 * Required for: NotificationBell, Notifications page (Phase 6).
 */
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('notifications')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('userId', 'integer', (col) => col.notNull().references('users.id'))
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('message', 'text', (col) => col.notNull())
    .addColumn('link', 'text')
    .addColumn('isRead', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Composite index: fetching unread notifications for a user is the hot path
  await db.schema
    .createIndex('idx_notifications_userId_isRead')
    .ifNotExists()
    .on('notifications')
    .columns(['userId', 'isRead'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_notifications_userId_isRead').ifExists().execute();
  await db.schema.dropTable('notifications').ifExists().execute();
}
