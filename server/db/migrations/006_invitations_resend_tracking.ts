/**
 * 006_invitations_resend_tracking.ts
 * Add resendCount and lastSentAt to invitations for tracking re-sends.
 * Required for: prevent spam re-sends, show "last sent X ago" in AdminTab.
 */
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE invitations ADD COLUMN resendCount INTEGER NOT NULL DEFAULT 0`.execute(db);
  await sql`ALTER TABLE invitations ADD COLUMN lastSentAt TEXT`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  console.warn('[006_down] SQLite DROP COLUMN not supported. No-op.');
}
