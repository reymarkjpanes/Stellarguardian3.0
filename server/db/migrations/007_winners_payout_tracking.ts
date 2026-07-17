/**
 * 007_winners_payout_tracking.ts
 * Add payoutTxRef to winners table.
 * Required for: tracking individual winner payouts via Stellar transaction hash.
 * Also adds UNIQUE constraint on (eventId, rank) to prevent duplicate rankings.
 */
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE winners ADD COLUMN payoutTxRef TEXT`.execute(db);

  // SQLite: recreate table with constraint (can't add UNIQUE constraint via ALTER)
  // This is safe because winners is a small table
  await sql`
    CREATE TABLE IF NOT EXISTS winners_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eventId INTEGER NOT NULL REFERENCES events(id),
      submissionId INTEGER NOT NULL REFERENCES submissions(id),
      rank INTEGER NOT NULL,
      prizeAmount REAL,
      payoutTxRef TEXT,
      UNIQUE(eventId, rank)
    )
  `.execute(db);

  await sql`INSERT OR IGNORE INTO winners_new SELECT id, eventId, submissionId, rank, prizeAmount, payoutTxRef FROM winners`.execute(db);
  await sql`DROP TABLE winners`.execute(db);
  await sql`ALTER TABLE winners_new RENAME TO winners`.execute(db);

  // Recreate index on new table
  await db.schema.createIndex('idx_winners_eventId').ifNotExists().on('winners').column('eventId').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Re-create without constraint
  await sql`
    CREATE TABLE IF NOT EXISTS winners_old (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eventId INTEGER NOT NULL REFERENCES events(id),
      submissionId INTEGER NOT NULL REFERENCES submissions(id),
      rank INTEGER NOT NULL,
      prizeAmount REAL
    )
  `.execute(db);
  await sql`INSERT INTO winners_old SELECT id, eventId, submissionId, rank, prizeAmount FROM winners`.execute(db);
  await sql`DROP TABLE winners`.execute(db);
  await sql`ALTER TABLE winners_old RENAME TO winners`.execute(db);
}
