/**
 * 001_initial_schema.ts
 * Baseline schema extracted from the original server.ts CREATE TABLE statements.
 * All subsequent migrations build on top of this.
 */
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Users
  await db.schema
    .createTable('users')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('email', 'text', (col) => col.notNull().unique())
    .addColumn('password', 'text', (col) => col.notNull())
    .addColumn('walletAddress', 'text')
    .addColumn('isAdmin', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();

  // Events
  await db.schema
    .createTable('events')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('hostUserId', 'integer', (col) => col.notNull().references('users.id'))
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('category', 'text', (col) => col.notNull())
    .addColumn('format', 'text', (col) => col.notNull())
    .addColumn('visibility', 'text', (col) => col.notNull())
    .addColumn('registrationDeadline', 'text', (col) => col.notNull())
    .addColumn('startDate', 'text', (col) => col.notNull())
    .addColumn('endDate', 'text', (col) => col.notNull())
    .addColumn('prizeTotal', 'real', (col) => col.notNull())
    .addColumn('prizeBreakdown', 'text', (col) => col.notNull())
    .addColumn('state', 'text', (col) => col.notNull().defaultTo('Draft'))
    .addColumn('fundingTxRef', 'text')
    .addColumn('tags', 'text')
    .addColumn('rulesPublished', 'integer', (col) => col.defaultTo(0))
    .addColumn('timelineConfirmed', 'integer', (col) => col.defaultTo(0))
    .addColumn('capacity', 'integer')
    .addColumn('teamSizeMax', 'integer', (col) => col.defaultTo(4))
    .addColumn('bannerUrl', 'text')
    .addColumn('contactEmail', 'text')
    .execute();

  // Event Memberships
  await db.schema
    .createTable('event_memberships')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('eventId', 'integer', (col) => col.notNull().references('events.id'))
    .addColumn('userId', 'integer', (col) => col.notNull().references('users.id'))
    .addColumn('role', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addUniqueConstraint('uq_membership', ['eventId', 'userId', 'role'])
    .execute();

  // Invitations
  await db.schema
    .createTable('invitations')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('kind', 'text', (col) => col.notNull())
    .addColumn('eventId', 'integer', (col) => col.notNull().references('events.id'))
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('token', 'text', (col) => col.notNull().unique())
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
    .addColumn('invitedByUserId', 'integer', (col) => col.notNull().references('users.id'))
    .addColumn('expiresAt', 'text', (col) => col.notNull())
    .execute();

  // Dev emails outbox
  await db.schema
    .createTable('dev_emails')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('to_email', 'text', (col) => col.notNull())
    .addColumn('subject', 'text', (col) => col.notNull())
    .addColumn('body', 'text', (col) => col.notNull())
    .addColumn('invite_link', 'text', (col) => col.notNull())
    .addColumn('sent_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Transactions
  await db.schema
    .createTable('transactions')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('eventId', 'integer', (col) => col.notNull().references('events.id'))
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('amountXLM', 'real', (col) => col.notNull())
    .addColumn('fromWallet', 'text', (col) => col.notNull())
    .addColumn('toWallet', 'text')
    .addColumn('txRef', 'text', (col) => col.notNull())
    .addColumn('timestamp', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Teams
  await db.schema
    .createTable('teams')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('eventId', 'integer', (col) => col.notNull().references('events.id'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Team Members
  await db.schema
    .createTable('team_members')
    .ifNotExists()
    .addColumn('teamId', 'integer', (col) => col.notNull().references('teams.id'))
    .addColumn('userId', 'integer', (col) => col.notNull().references('users.id'))
    .addPrimaryKeyConstraint('pk_team_members', ['teamId', 'userId'])
    .execute();

  // Sponsors
  await db.schema
    .createTable('sponsors')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('eventId', 'integer', (col) => col.notNull().references('events.id'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('logo', 'text')
    .addColumn('tier', 'text')
    .execute();

  // Milestones
  await db.schema
    .createTable('milestones')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('eventId', 'integer', (col) => col.notNull().references('events.id'))
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('date', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .execute();

  // Submissions
  await db.schema
    .createTable('submissions')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('eventId', 'integer', (col) => col.notNull().references('events.id'))
    .addColumn('teamId', 'integer', (col) => col.references('teams.id'))
    .addColumn('userId', 'integer', (col) => col.notNull().references('users.id'))
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('url', 'text')
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updatedAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Evaluations
  await db.schema
    .createTable('evaluations')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('submissionId', 'integer', (col) => col.notNull().references('submissions.id'))
    .addColumn('judgeId', 'integer', (col) => col.notNull().references('users.id'))
    .addColumn('score', 'integer', (col) => col.notNull())
    .addColumn('feedback', 'text')
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addUniqueConstraint('uq_evaluation', ['submissionId', 'judgeId'])
    .execute();

  // Announcements
  await db.schema
    .createTable('announcements')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('eventId', 'integer', (col) => col.notNull().references('events.id'))
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('body', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Winners
  await db.schema
    .createTable('winners')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('eventId', 'integer', (col) => col.notNull().references('events.id'))
    .addColumn('submissionId', 'integer', (col) => col.notNull().references('submissions.id'))
    .addColumn('rank', 'integer', (col) => col.notNull())
    .addColumn('prizeAmount', 'real')
    .execute();

  // RSVPs
  await db.schema
    .createTable('rsvps')
    .ifNotExists()
    .addColumn('eventId', 'integer', (col) => col.notNull().references('events.id'))
    .addColumn('userId', 'integer', (col) => col.notNull().references('users.id'))
    .addColumn('status', 'text', (col) => col.notNull())
    .addPrimaryKeyConstraint('pk_rsvps', ['eventId', 'userId'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop in reverse dependency order
  const tables = [
    'rsvps', 'winners', 'announcements', 'evaluations', 'submissions',
    'milestones', 'sponsors', 'team_members', 'teams', 'transactions',
    'dev_emails', 'invitations', 'event_memberships', 'events', 'users',
  ];
  for (const table of tables) {
    await db.schema.dropTable(table).ifExists().execute();
  }
}
