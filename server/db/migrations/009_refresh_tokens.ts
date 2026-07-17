/**
 * 009_refresh_tokens.ts
 * Refresh token storage for the JWT refresh flow.
 * Required for: Phase 3 Auth — 15min access token + 30-day refresh token.
 */
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('refresh_tokens')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('userId', 'integer', (col) => col.notNull().references('users.id'))
    .addColumn('token', 'text', (col) => col.notNull().unique())
    .addColumn('expiresAt', 'text', (col) => col.notNull())
    .addColumn('revokedAt', 'text')
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createIndex('idx_refresh_tokens_token')
    .ifNotExists()
    .on('refresh_tokens')
    .column('token')
    .execute();

  await db.schema
    .createIndex('idx_refresh_tokens_userId')
    .ifNotExists()
    .on('refresh_tokens')
    .column('userId')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_refresh_tokens_token').ifExists().execute();
  await db.schema.dropIndex('idx_refresh_tokens_userId').ifExists().execute();
  await db.schema.dropTable('refresh_tokens').ifExists().execute();
}
