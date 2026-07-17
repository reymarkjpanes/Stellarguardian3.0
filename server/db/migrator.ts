/**
 * server/db/migrator.ts
 * Kysely-based migration runner for SQLite.
 * 
 * Design Decision (confirmed):
 * - SQLite for v1. Migration abstraction pattern ensures easy PostgreSQL migration later.
 * - Uses Kysely's built-in migration system with versioned migration files.
 * - Run with: npx tsx server/db/migrator.ts
 * - Down migrations always available for rollback.
 *
 * Migration naming convention: NNN_description.ts (001, 002, ... 099)
 */
import { Kysely, SqliteDialect, sql } from 'kysely';
import { Migrator } from 'kysely/migration';
import type { MigrationProvider, Migration } from 'kysely/migration';
import BetterSqlite3 from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';

// ─── Database Type Definitions (for Kysely type-safety) ──────────────────────

export interface Database {
  users: UsersTable;
  events: EventsTable;
  event_memberships: EventMembershipsTable;
  invitations: InvitationsTable;
  dev_emails: DevEmailsTable;
  transactions: TransactionsTable;
  teams: TeamsTable;
  team_members: TeamMembersTable;
  sponsors: SponsorsTable;
  milestones: MilestonesTable;
  submissions: SubmissionsTable;
  evaluations: EvaluationsTable;
  announcements: AnnouncementsTable;
  winners: WinnersTable;
  rsvps: RsvpsTable;
  notifications: NotificationsTable;
  refresh_tokens: RefreshTokensTable;
  password_reset_tokens: PasswordResetTokensTable;
}

interface UsersTable {
  id: number;
  name: string;
  email: string;
  password: string;
  walletAddress: string | null;
  isAdmin: number;
  createdAt: string;
  updatedAt: string;
}

interface EventsTable {
  id: number;
  hostUserId: number;
  title: string;
  description: string;
  category: string;
  format: string;
  visibility: string;
  registrationDeadline: string;
  startDate: string;
  endDate: string;
  prizeTotal: number;
  prizeBreakdown: string;
  state: string;
  fundingTxRef: string | null;
  escrowPublicKey: string | null;
  encryptedEscrowSecret: string | null;
  tags: string | null;
  rulesPublished: number;
  timelineConfirmed: number;
  capacity: number | null;
  teamSizeMax: number;
  bannerUrl: string | null;
  contactEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EventMembershipsTable {
  id: number;
  eventId: number;
  userId: number;
  role: string;
  status: string;
  joinedAt: string | null;
}

interface InvitationsTable {
  id: number;
  kind: string;
  eventId: number;
  email: string;
  token: string;
  status: string;
  invitedByUserId: number;
  expiresAt: string;
  resendCount: number;
  lastSentAt: string | null;
}

interface DevEmailsTable {
  id: number;
  to_email: string;
  subject: string;
  body: string;
  invite_link: string;
  sent_at: string;
}

interface TransactionsTable {
  id: number;
  eventId: number;
  type: string;
  amountXLM: number;
  fromWallet: string;
  toWallet: string | null;
  txRef: string;
  timestamp: string;
}

interface TeamsTable {
  id: number;
  eventId: number;
  name: string;
  createdAt: string;
}

interface TeamMembersTable {
  teamId: number;
  userId: number;
}

interface SponsorsTable {
  id: number;
  eventId: number;
  name: string;
  logo: string | null;
  tier: string | null;
}

interface MilestonesTable {
  id: number;
  eventId: number;
  title: string;
  date: string;
  description: string | null;
}

interface SubmissionsTable {
  id: number;
  eventId: number;
  teamId: number | null;
  userId: number;
  title: string;
  description: string;
  url: string | null;
  isDraft: number;
  createdAt: string;
  updatedAt: string;
}

interface EvaluationsTable {
  id: number;
  submissionId: number;
  judgeId: number;
  score: number;
  feedback: string | null;
  createdAt: string;
}

interface AnnouncementsTable {
  id: number;
  eventId: number;
  title: string;
  body: string;
  createdAt: string;
}

interface WinnersTable {
  id: number;
  eventId: number;
  submissionId: number;
  rank: number;
  prizeAmount: number | null;
  payoutTxRef: string | null;
}

interface RsvpsTable {
  eventId: number;
  userId: number;
  status: string;
}

interface NotificationsTable {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: number;
  createdAt: string;
}

interface RefreshTokensTable {
  id: number;
  userId: number;
  token: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

interface PasswordResetTokensTable {
  id: number;
  userId: number;
  token: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

// ─── Migrator Setup ───────────────────────────────────────────────────────────

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'database.sqlite');

async function runMigrations() {
  const sqlite = new BetterSqlite3(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const kysely = new Kysely<Database>({
    dialect: new SqliteDialect({ database: sqlite }),
  });

  // Migrations folder is always server/db/migrations relative to project root
  const migrationsPath = path.join(process.cwd(), 'server', 'db', 'migrations');

  // Custom provider that uses pathToFileURL for Windows ESM compatibility
  const customProvider: MigrationProvider = {
    async getMigrations(): Promise<Record<string, Migration>> {
      const files = await fs.promises.readdir(migrationsPath);
      const migrations: Record<string, Migration> = {};
      for (const file of files.sort()) {
        if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;
        const name = file.replace(/\.(ts|js)$/, '');
        const filePath = path.join(migrationsPath, file);
        // pathToFileURL converts Windows absolute paths to valid file:// URLs
        const fileUrl = pathToFileURL(filePath).href;
        const mod = await import(fileUrl);
        migrations[name] = { up: mod.up, down: mod.down };
      }
      return migrations;
    },
  };

  const migrator = new Migrator({
    db: kysely,
    provider: customProvider,
  });

  const command = process.argv[2] ?? 'up';

  if (command === 'down') {
    console.log('Rolling back last migration...');
    const { error, results } = await migrator.migrateDown();
    results?.forEach((r) => {
      if (r.status === 'Success') {
        console.log(`  ✅ Rolled back: ${r.migrationName}`);
      } else if (r.status === 'Error') {
        console.error(`  ❌ Failed rollback: ${r.migrationName}`);
      }
    });
    if (error) {
      console.error('Migration rollback failed:', error);
      process.exit(1);
    }
  } else {
    console.log('Running migrations...');
    const { error, results } = await migrator.migrateToLatest();
    results?.forEach((r) => {
      if (r.status === 'Success') {
        console.log(`  ✅ Migrated: ${r.migrationName}`);
      } else if (r.status === 'Error') {
        console.error(`  ❌ Failed: ${r.migrationName}`);
      } else {
        console.log(`  ⏭  Skipped (already applied): ${r.migrationName}`);
      }
    });
    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
    console.log('✅ All migrations complete.');
  }

  await kysely.destroy();
  sqlite.close();
}

runMigrations();
