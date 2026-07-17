/**
 * 010_password_reset_tokens.ts
 * Password reset token storage for the forgot-password flow.
 * Tokens expire in 1 hour and are single-use.
 */
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('password_reset_tokens')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('userId', 'integer', (col) => col.notNull().references('users.id'))
    .addColumn('token', 'text', (col) => col.notNull().unique())
    .addColumn('expiresAt', 'text', (col) => col.notNull())
    .addColumn('usedAt', 'text')
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createIndex('idx_password_reset_token')
    .ifNotExists()
    .on('password_reset_tokens')
    .column('token')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_password_reset_token').ifExists().execute();
  await db.schema.dropTable('password_reset_tokens').ifExists().execute();
}
