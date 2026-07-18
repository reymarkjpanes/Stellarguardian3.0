/**
 * server/db/client.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 * SINGLE DATABASE ABSTRACTION for the entire application.
 *
 * This is the ONLY file that may instantiate a better-sqlite3 Database.
 * All other modules MUST import `db` from this file.
 *
 * Responsibilities:
 * ─────────────────
 * 1. Single connection instance (shared across all modules)
 * 2. PRAGMA configuration (WAL, foreign_keys, busy_timeout)
 * 3. Schema initialization (CREATE TABLE IF NOT EXISTS for all tables)
 * 4. Firestore write-through synchronization (via interceptor)
 * 5. Firestore restore on startup (via loadStateFromFirestore)
 *
 * Architecture:
 * ─────────────
 * BEFORE: server.ts created db#1 (with Firestore sync) and server/db/client.ts
 *         created db#2 (without Firestore sync). Modular routes used db#2,
 *         meaning auth writes were NEVER synced to Firestore.
 *
 * AFTER:  This file is the single source of truth. The Firestore sync interceptor
 *         is attached here, so ALL writes from ALL modules trigger sync.
 *
 * Usage:
 * ──────
 *   import db from '../db/client';         // from routes/services
 *   import db from './server/db/client';   // from server.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import Database from 'better-sqlite3';
import path from 'path';
import { attachWriteInterceptor, loadStateFromFirestore } from './sync';

// ─── Connection ───────────────────────────────────────────────────────────────

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'database.sqlite');

const db = new Database(DB_PATH);

// ─── PRAGMA Configuration ─────────────────────────────────────────────────────
// All SQLite configuration happens HERE. No other module should set PRAGMAs.

db.pragma('journal_mode = WAL');       // Write-Ahead Logging for concurrent reads
db.pragma('foreign_keys = ON');        // Enforce referential integrity
db.pragma('busy_timeout = 5000');      // Wait up to 5s on lock contention
db.pragma('synchronous = NORMAL');     // Balanced durability/performance with WAL

// ─── Schema Initialization ────────────────────────────────────────────────────
// These CREATE TABLE IF NOT EXISTS statements ensure the database is usable
// even before migrations run. They define the baseline schema.
// Migrations (server/db/migrations/) handle ALTER TABLE additions.

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    walletAddress TEXT,
    isAdmin INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hostUserId INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    format TEXT NOT NULL,
    visibility TEXT NOT NULL,
    registrationDeadline TEXT NOT NULL,
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    prizeTotal REAL NOT NULL,
    prizeBreakdown TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'Draft',
    fundingTxRef TEXT,
    tags TEXT,
    FOREIGN KEY(hostUserId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS event_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL,
    FOREIGN KEY(eventId) REFERENCES events(id),
    FOREIGN KEY(userId) REFERENCES users(id),
    UNIQUE(eventId, userId, role)
  );

  CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    eventId INTEGER NOT NULL,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    invitedByUserId INTEGER NOT NULL,
    expiresAt TEXT NOT NULL,
    FOREIGN KEY(eventId) REFERENCES events(id),
    FOREIGN KEY(invitedByUserId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS dev_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    invite_link TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId INTEGER NOT NULL,
    type TEXT NOT NULL,
    amountXLM REAL NOT NULL,
    fromWallet TEXT NOT NULL,
    toWallet TEXT,
    txRef TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(eventId) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId INTEGER NOT NULL,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(eventId) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS team_members (
    teamId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    FOREIGN KEY(teamId) REFERENCES teams(id),
    FOREIGN KEY(userId) REFERENCES users(id),
    PRIMARY KEY (teamId, userId)
  );

  CREATE TABLE IF NOT EXISTS sponsors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId INTEGER NOT NULL,
    name TEXT NOT NULL,
    logo TEXT,
    tier TEXT,
    FOREIGN KEY(eventId) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId INTEGER NOT NULL,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY(eventId) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId INTEGER NOT NULL,
    teamId INTEGER,
    userId INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    url TEXT,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(eventId) REFERENCES events(id),
    FOREIGN KEY(teamId) REFERENCES teams(id),
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submissionId INTEGER NOT NULL,
    judgeId INTEGER NOT NULL,
    score INTEGER NOT NULL,
    feedback TEXT,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(submissionId) REFERENCES submissions(id),
    FOREIGN KEY(judgeId) REFERENCES users(id),
    UNIQUE(submissionId, judgeId)
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(eventId) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS winners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId INTEGER NOT NULL,
    submissionId INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    prizeAmount REAL,
    FOREIGN KEY(eventId) REFERENCES events(id),
    FOREIGN KEY(submissionId) REFERENCES submissions(id)
  );

  CREATE TABLE IF NOT EXISTS rsvps (
    eventId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    status TEXT NOT NULL,
    PRIMARY KEY (eventId, userId),
    FOREIGN KEY(eventId) REFERENCES events(id),
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expiresAt TEXT NOT NULL,
    revokedAt TEXT,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expiresAt TEXT NOT NULL,
    usedAt TEXT,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    isRead INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// ─── Safe Migrations (column additions for existing databases) ────────────────
// These handle ALTER TABLE for databases created before migrations existed.
// They are idempotent (try/catch) and match what the Kysely migrations do.

try { db.exec("ALTER TABLE events ADD COLUMN tags TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE events ADD COLUMN rulesPublished INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE events ADD COLUMN timelineConfirmed INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE events ADD COLUMN capacity INTEGER"); } catch {}
try { db.exec("ALTER TABLE events ADD COLUMN teamSizeMax INTEGER DEFAULT 4"); } catch {}
try { db.exec("ALTER TABLE events ADD COLUMN bannerUrl TEXT"); } catch {}
try { db.exec("ALTER TABLE events ADD COLUMN contactEmail TEXT"); } catch {}
try { db.exec("ALTER TABLE events ADD COLUMN escrowPublicKey TEXT"); } catch {}
try { db.exec("ALTER TABLE events ADD COLUMN encryptedEscrowSecret TEXT"); } catch {}
try { db.exec("ALTER TABLE events ADD COLUMN createdAt TEXT NOT NULL DEFAULT '2026-01-01T00:00:00.000Z'"); } catch {}
try { db.exec("ALTER TABLE events ADD COLUMN updatedAt TEXT NOT NULL DEFAULT '2026-01-01T00:00:00.000Z'"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN createdAt TEXT NOT NULL DEFAULT '2026-01-01T00:00:00.000Z'"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN updatedAt TEXT NOT NULL DEFAULT '2026-01-01T00:00:00.000Z'"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN emailVerified INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN isActive INTEGER NOT NULL DEFAULT 1"); } catch {}
try { db.exec("ALTER TABLE winners ADD COLUMN payoutTxRef TEXT"); } catch {}

// ─── Firestore Sync Interceptor ───────────────────────────────────────────────
// Attach the write-through interceptor so ALL writes trigger Firestore backup.
// This must be called AFTER schema initialization (so the interceptor doesn't
// fire on CREATE TABLE statements during startup).

attachWriteInterceptor(db);

// ─── Firestore Restore ────────────────────────────────────────────────────────
// Kick off async restore. This runs in the background — the server starts
// immediately with whatever is in the local SQLite file and overwrites with
// Firestore data if a backup exists.

loadStateFromFirestore(db);

// ─── Export ───────────────────────────────────────────────────────────────────

export default db;
