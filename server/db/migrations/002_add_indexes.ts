/**
 * 002_add_indexes.ts
 * Critical performance indexes. Without these, all JOINs are full table scans.
 * These are the most impactful single change for query performance.
 */
import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Events
  await db.schema.createIndex('idx_events_hostUserId').ifNotExists().on('events').column('hostUserId').execute();
  await db.schema.createIndex('idx_events_state').ifNotExists().on('events').column('state').execute();
  await db.schema.createIndex('idx_events_visibility_state').ifNotExists().on('events').columns(['visibility', 'state']).execute();

  // Memberships — most frequently queried with both eventId and userId
  await db.schema.createIndex('idx_memberships_userId').ifNotExists().on('event_memberships').column('userId').execute();
  await db.schema.createIndex('idx_memberships_eventId_role').ifNotExists().on('event_memberships').columns(['eventId', 'role']).execute();
  await db.schema.createIndex('idx_memberships_eventId_status').ifNotExists().on('event_memberships').columns(['eventId', 'status']).execute();

  // Invitations
  await db.schema.createIndex('idx_invitations_token').ifNotExists().on('invitations').column('token').execute();
  await db.schema.createIndex('idx_invitations_eventId').ifNotExists().on('invitations').column('eventId').execute();
  await db.schema.createIndex('idx_invitations_email').ifNotExists().on('invitations').column('email').execute();

  // Submissions
  await db.schema.createIndex('idx_submissions_eventId').ifNotExists().on('submissions').column('eventId').execute();
  await db.schema.createIndex('idx_submissions_userId').ifNotExists().on('submissions').column('userId').execute();

  // Evaluations
  await db.schema.createIndex('idx_evaluations_submissionId').ifNotExists().on('evaluations').column('submissionId').execute();
  await db.schema.createIndex('idx_evaluations_judgeId').ifNotExists().on('evaluations').column('judgeId').execute();

  // Transactions
  await db.schema.createIndex('idx_transactions_eventId').ifNotExists().on('transactions').column('eventId').execute();

  // Teams
  await db.schema.createIndex('idx_teams_eventId').ifNotExists().on('teams').column('eventId').execute();
  await db.schema.createIndex('idx_team_members_userId').ifNotExists().on('team_members').column('userId').execute();

  // Announcements
  await db.schema.createIndex('idx_announcements_eventId').ifNotExists().on('announcements').column('eventId').execute();

  // Winners
  await db.schema.createIndex('idx_winners_eventId').ifNotExists().on('winners').column('eventId').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const indexes = [
    'idx_events_hostUserId', 'idx_events_state', 'idx_events_visibility_state',
    'idx_memberships_userId', 'idx_memberships_eventId_role', 'idx_memberships_eventId_status',
    'idx_invitations_token', 'idx_invitations_eventId', 'idx_invitations_email',
    'idx_submissions_eventId', 'idx_submissions_userId',
    'idx_evaluations_submissionId', 'idx_evaluations_judgeId',
    'idx_transactions_eventId',
    'idx_teams_eventId', 'idx_team_members_userId',
    'idx_announcements_eventId',
    'idx_winners_eventId',
  ];
  for (const index of indexes) {
    await db.schema.dropIndex(index).ifExists().execute();
  }
}
