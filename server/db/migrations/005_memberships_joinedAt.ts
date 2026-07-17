/**
 * 005_memberships_joinedAt.ts
 * Add joinedAt timestamp to event_memberships.
 * Required for: "joined X days ago" UI, analytics, and export CSV.
 */
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE event_memberships ADD COLUMN joinedAt TEXT`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  console.warn('[005_down] SQLite DROP COLUMN not supported. No-op.');
}
