/**
 * 004_events_timestamps_and_escrow_fields.ts
 * Add createdAt, updatedAt, and Stellar escrow fields to events table.
 */
import { Kysely, sql } from 'kysely';

const EPOCH_DEFAULT = '2026-01-01T00:00:00.000Z';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE events ADD COLUMN createdAt TEXT NOT NULL DEFAULT '${sql.raw(EPOCH_DEFAULT)}'`.execute(db);
  await sql`ALTER TABLE events ADD COLUMN updatedAt TEXT NOT NULL DEFAULT '${sql.raw(EPOCH_DEFAULT)}'`.execute(db);
  // Stellar escrow fields — populated by Phase 4 stellarService.fundEventEscrow()
  await sql`ALTER TABLE events ADD COLUMN escrowPublicKey TEXT`.execute(db);
  await sql`ALTER TABLE events ADD COLUMN encryptedEscrowSecret TEXT`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  console.warn('[004_down] SQLite DROP COLUMN not supported on older versions. No-op.');
}
