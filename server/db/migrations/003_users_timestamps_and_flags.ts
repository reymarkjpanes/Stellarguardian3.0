/**
 * 003_users_timestamps_and_flags.ts
 * Add createdAt, updatedAt, emailVerified, and isActive to users table.
 * Critical for: account lifecycle management, audit trail, email verification flow.
 * 
 * NOTE: SQLite ALTER TABLE ADD COLUMN does not support CURRENT_TIMESTAMP as a
 * non-constant default. Use a fixed ISO string literal instead. Existing rows
 * will get this as their createdAt, which is acceptable for migration.
 */
import { Kysely, sql } from 'kysely';

const EPOCH_DEFAULT = '2026-01-01T00:00:00.000Z';

export async function up(db: Kysely<any>): Promise<void> {
  // Use a string literal for default (CURRENT_TIMESTAMP is not constant in ALTER TABLE)
  await sql`ALTER TABLE users ADD COLUMN createdAt TEXT NOT NULL DEFAULT '${sql.raw(EPOCH_DEFAULT)}'`.execute(db);
  await sql`ALTER TABLE users ADD COLUMN updatedAt TEXT NOT NULL DEFAULT '${sql.raw(EPOCH_DEFAULT)}'`.execute(db);
  await sql`ALTER TABLE users ADD COLUMN emailVerified INTEGER NOT NULL DEFAULT 0`.execute(db);
  await sql`ALTER TABLE users ADD COLUMN isActive INTEGER NOT NULL DEFAULT 1`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // SQLite does not support DROP COLUMN in older versions.
  // Migration is not reversible on SQLite < 3.35.
  // Acceptable tradeoff: columns remain with null/default values.
  console.warn('[003_down] SQLite does not support DROP COLUMN on older versions. Columns remain.');
}
