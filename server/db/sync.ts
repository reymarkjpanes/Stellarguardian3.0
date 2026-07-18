/**
 * server/db/sync.ts
 * Firestore synchronization layer for the shared database.
 *
 * This module provides:
 * - A debounced write-through to Cloud Firestore on every mutating SQL operation
 * - A restore function to hydrate SQLite from the latest Firestore snapshot
 *
 * Architecture:
 * - This module is imported ONLY by server/db/client.ts
 * - The monkey-patch on `db.prepare` ensures ALL writes (from any module) trigger sync
 *
 * Security Policy:
 * - User passwords are stripped before sending to Firestore
 * - refresh_tokens and password_reset_tokens are NEVER synced (session-hijack risk)
 * - Encrypted escrow secrets are stripped from events (key-material risk)
 * - Invitation tokens are stripped (one-time secret risk)
 *
 * Originally in src/lib/serverFirebase.ts — moved here because it is a server-only
 * concern that belongs in the database abstraction layer, not in frontend src/.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ─── Firebase Initialization ──────────────────────────────────────────────────

let firebaseInitialized = false;
let firestoreDb: ReturnType<typeof getFirestore> | null = null;
let firebaseAuth: ReturnType<typeof getAuth> | null = null;
let isFirebaseAuthed = false;

function initFirebase() {
  if (firebaseInitialized) return;

  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    console.log('[DB Sync] firebase-applet-config.json not found. Firestore sync disabled.');
    firebaseInitialized = true;
    return;
  }

  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // Check if config has required fields
    if (!firebaseConfig.projectId) {
      console.log('[DB Sync] Firebase config missing projectId. Firestore sync disabled.');
      firebaseInitialized = true;
      return;
    }

    const app = initializeApp(firebaseConfig, 'db-sync');
    firestoreDb = getFirestore(app);
    firebaseAuth = getAuth(app);
    firebaseInitialized = true;
  } catch (err) {
    console.error('[DB Sync] Failed to initialize Firebase:', err);
    firebaseInitialized = true;
  }
}

async function ensureServerAuth(): Promise<boolean> {
  if (isFirebaseAuthed) return true;
  if (!firebaseAuth) return false;

  try {
    await signInAnonymously(firebaseAuth);
    isFirebaseAuthed = true;
    console.log('[DB Sync] Server authenticated anonymously for Firestore access.');
    return true;
  } catch (err) {
    console.error('[DB Sync] Failed to authenticate with Firestore:', err);
    return false;
  }
}

// ─── Tables to Synchronize ────────────────────────────────────────────────────
// SECURITY: Sensitive auth tables are intentionally excluded.
// refresh_tokens and password_reset_tokens contain session/reset secrets that
// could enable account takeover if leaked from the Firestore backup.
// These tables are ephemeral by nature and regenerated on login/request.
//
// SECURITY: Each table uses an explicit column whitelist (SYNC_COLUMNS) instead
// of SELECT *. This ensures that new columns added to the schema are NOT
// automatically synced — they must be explicitly approved here first.
// This makes the sync layer FAIL-CLOSED: new fields are excluded by default.

const TABLES = [
  'users',
  'events',
  'event_memberships',
  'invitations',
  'dev_emails',
  'transactions',
  'teams',
  'team_members',
  'sponsors',
  'milestones',
  'submissions',
  'evaluations',
  'announcements',
  'winners',
  'rsvps',
  'notifications',
  // EXCLUDED (security): 'refresh_tokens' — contains active session tokens
  // EXCLUDED (security): 'password_reset_tokens' — contains password reset secrets
];

/**
 * Explicit column whitelist per table.
 * ONLY these fields will be sent to Firestore.
 * Any new column must be explicitly added here after security review.
 * If a table is not in this map, SELECT * is used (legacy fallback — avoid).
 */
const SYNC_COLUMNS: Record<string, string[]> = {
  users: ['id', 'name', 'email', 'walletAddress', 'isAdmin', 'createdAt', 'updatedAt', 'emailVerified', 'isActive'],
  // NOTE: 'password' excluded — credential material
  events: ['id', 'hostUserId', 'title', 'description', 'category', 'format', 'visibility', 'registrationDeadline', 'startDate', 'endDate', 'prizeTotal', 'prizeBreakdown', 'state', 'fundingTxRef', 'tags', 'rulesPublished', 'timelineConfirmed', 'capacity', 'teamSizeMax', 'bannerUrl', 'contactEmail', 'escrowPublicKey', 'createdAt', 'updatedAt'],
  // NOTE: 'encryptedEscrowSecret' excluded — private key material (encrypted)
  event_memberships: ['id', 'eventId', 'userId', 'role', 'status'],
  invitations: ['id', 'kind', 'eventId', 'email', 'status', 'invitedByUserId', 'expiresAt'],
  // NOTE: 'token' excluded — one-time invitation credential
  dev_emails: ['id', 'to_email', 'subject', 'sent_at'],
  // NOTE: 'body' and 'invite_link' excluded — contain embedded invitation tokens
  transactions: ['id', 'eventId', 'type', 'amountXLM', 'fromWallet', 'toWallet', 'txRef', 'timestamp'],
  teams: ['id', 'eventId', 'name', 'createdAt'],
  team_members: ['teamId', 'userId'],
  sponsors: ['id', 'eventId', 'name', 'logo', 'tier'],
  milestones: ['id', 'eventId', 'title', 'date', 'description'],
  submissions: ['id', 'eventId', 'teamId', 'userId', 'title', 'description', 'url', 'createdAt', 'updatedAt'],
  evaluations: ['id', 'submissionId', 'judgeId', 'score', 'feedback', 'createdAt'],
  announcements: ['id', 'eventId', 'title', 'body', 'createdAt'],
  winners: ['id', 'eventId', 'submissionId', 'rank', 'prizeAmount', 'payoutTxRef'],
  rsvps: ['eventId', 'userId', 'status'],
  notifications: ['id', 'userId', 'type', 'title', 'message', 'link', 'isRead', 'createdAt'],
};

// ─── Restore from Firestore ───────────────────────────────────────────────────

/**
 * Restore SQLite state from the latest Cloud Firestore backup.
 * Called once at application startup.
 */
export async function loadStateFromFirestore(sqliteDb: Database.Database): Promise<void> {
  initFirebase();
  if (!firestoreDb) return;

  const authed = await ensureServerAuth();
  if (!authed) return;

  console.log('[DB Sync] Checking for database backups in Cloud Firestore...');
  try {
    const backupDocRef = doc(firestoreDb, 'database_backups', 'latest');
    const docSnap = await getDoc(backupDocRef);

    if (!docSnap.exists()) {
      console.log('[DB Sync] No existing cloud database backup found. Starting fresh.');
      return;
    }

    const data = docSnap.data();
    console.log('[DB Sync] Found latest database backup. Restoring state...');

    sqliteDb.pragma('foreign_keys = OFF');

    const restoreTransaction = sqliteDb.transaction(() => {
      for (const table of TABLES) {
        try {
          sqliteDb.prepare(`DELETE FROM ${table}`).run();
        } catch {
          // Table might not exist yet (pre-migration)
        }
      }

      // Users — passwords require placeholder on restore (security policy)
      if (Array.isArray(data.users)) {
        const stmt = sqliteDb.prepare(
          'INSERT OR IGNORE INTO users (id, name, email, password, walletAddress, isAdmin) VALUES (?, ?, ?, ?, ?, ?)',
        );
        for (const u of data.users) {
          const passwordPlaceholder = u.password || '$RESTORE_REQUIRED$';
          stmt.run(u.id, u.name, u.email, passwordPlaceholder, u.walletAddress, u.isAdmin);
        }
      }

      // Events
      if (Array.isArray(data.events)) {
        const stmt = sqliteDb.prepare(`
          INSERT OR IGNORE INTO events (
            id, hostUserId, title, description, category, format, visibility,
            registrationDeadline, startDate, endDate, prizeTotal, prizeBreakdown,
            state, fundingTxRef, tags, rulesPublished, timelineConfirmed,
            capacity, teamSizeMax, bannerUrl, contactEmail
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const e of data.events) {
          stmt.run(
            e.id, e.hostUserId, e.title, e.description, e.category, e.format, e.visibility,
            e.registrationDeadline, e.startDate, e.endDate, e.prizeTotal, e.prizeBreakdown,
            e.state, e.fundingTxRef, e.tags || '', e.rulesPublished || 0, e.timelineConfirmed || 0,
            e.capacity !== undefined ? e.capacity : null,
            e.teamSizeMax !== undefined ? e.teamSizeMax : 4,
            e.bannerUrl || null, e.contactEmail || null,
          );
        }
      }

      // Event memberships
      if (Array.isArray(data.event_memberships)) {
        const stmt = sqliteDb.prepare(
          'INSERT OR IGNORE INTO event_memberships (id, eventId, userId, role, status) VALUES (?, ?, ?, ?, ?)',
        );
        for (const m of data.event_memberships) {
          stmt.run(m.id, m.eventId, m.userId, m.role, m.status);
        }
      }

      // Invitations — skip entries with redacted tokens (from sanitized backups)
      if (Array.isArray(data.invitations)) {
        const stmt = sqliteDb.prepare(
          'INSERT OR IGNORE INTO invitations (id, kind, eventId, email, token, status, invitedByUserId, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        );
        for (const i of data.invitations) {
          // Skip invitations with redacted tokens — they can't be used anyway
          if (i.token === '[REDACTED]' || !i.token) continue;
          stmt.run(i.id, i.kind, i.eventId, i.email, i.token, i.status, i.invitedByUserId, i.expiresAt);
        }
      }

      // Dev emails
      if (Array.isArray(data.dev_emails)) {
        const stmt = sqliteDb.prepare(
          'INSERT OR IGNORE INTO dev_emails (id, to_email, subject, body, invite_link, sent_at) VALUES (?, ?, ?, ?, ?, ?)',
        );
        for (const d of data.dev_emails) {
          stmt.run(d.id, d.to_email, d.subject, d.body, d.invite_link, d.sent_at);
        }
      }

      // Transactions
      if (Array.isArray(data.transactions)) {
        const stmt = sqliteDb.prepare(
          'INSERT OR IGNORE INTO transactions (id, eventId, type, amountXLM, fromWallet, toWallet, txRef, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        );
        for (const t of data.transactions) {
          stmt.run(t.id, t.eventId, t.type, t.amountXLM, t.fromWallet, t.toWallet, t.txRef, t.timestamp);
        }
      }

      // Teams
      if (Array.isArray(data.teams)) {
        const stmt = sqliteDb.prepare(
          'INSERT OR IGNORE INTO teams (id, eventId, name, createdAt) VALUES (?, ?, ?, ?)',
        );
        for (const t of data.teams) {
          stmt.run(t.id, t.eventId, t.name, t.createdAt);
        }
      }

      // Team members
      if (Array.isArray(data.team_members)) {
        const stmt = sqliteDb.prepare(
          'INSERT OR IGNORE INTO team_members (teamId, userId) VALUES (?, ?)',
        );
        for (const tm of data.team_members) {
          stmt.run(tm.teamId, tm.userId);
        }
      }

      // Sponsors
      if (Array.isArray(data.sponsors)) {
        const stmt = sqliteDb.prepare(
          'INSERT OR IGNORE INTO sponsors (id, eventId, name, logo, tier) VALUES (?, ?, ?, ?, ?)',
        );
        for (const s of data.sponsors) {
          stmt.run(s.id, s.eventId, s.name, s.logo, s.tier);
        }
      }

      // Milestones
      if (Array.isArray(data.milestones)) {
        const stmt = sqliteDb.prepare(
          'INSERT OR IGNORE INTO milestones (id, eventId, title, date, description) VALUES (?, ?, ?, ?, ?)',
        );
        for (const m of data.milestones) {
          stmt.run(m.id, m.eventId, m.title, m.date, m.description);
        }
      }

      // Submissions
      if (Array.isArray(data.submissions)) {
        const stmt = sqliteDb.prepare(
          'INSERT OR IGNORE INTO submissions (id, eventId, teamId, userId, title, description, url, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        );
        for (const s of data.submissions) {
          stmt.run(s.id, s.eventId, s.teamId, s.userId, s.title, s.description, s.url, s.createdAt, s.updatedAt);
        }
      }

      // Evaluations
      if (Array.isArray(data.evaluations)) {
        const stmt = sqliteDb.prepare(
          'INSERT OR IGNORE INTO evaluations (id, submissionId, judgeId, score, feedback, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        );
        for (const ev of data.evaluations) {
          stmt.run(ev.id, ev.submissionId, ev.judgeId, ev.score, ev.feedback, ev.createdAt);
        }
      }

      // Announcements
      if (Array.isArray(data.announcements)) {
        const stmt = sqliteDb.prepare(
          'INSERT OR IGNORE INTO announcements (id, eventId, title, body, createdAt) VALUES (?, ?, ?, ?, ?)',
        );
        for (const a of data.announcements) {
          stmt.run(a.id, a.eventId, a.title, a.body, a.createdAt);
        }
      }

      // Winners
      if (Array.isArray(data.winners)) {
        const stmt = sqliteDb.prepare(
          'INSERT OR IGNORE INTO winners (id, eventId, submissionId, rank, prizeAmount) VALUES (?, ?, ?, ?, ?)',
        );
        for (const w of data.winners) {
          stmt.run(w.id, w.eventId, w.submissionId, w.rank, w.prizeAmount);
        }
      }

      // RSVPs
      if (Array.isArray(data.rsvps)) {
        const stmt = sqliteDb.prepare(
          'INSERT OR IGNORE INTO rsvps (eventId, userId, status) VALUES (?, ?, ?)',
        );
        for (const r of data.rsvps) {
          stmt.run(r.eventId, r.userId, r.status);
        }
      }

      // Notifications
      if (Array.isArray(data.notifications)) {
        const stmt = sqliteDb.prepare(
          'INSERT OR IGNORE INTO notifications (id, userId, type, title, message, link, isRead, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        );
        for (const n of data.notifications) {
          stmt.run(n.id, n.userId, n.type, n.title, n.message, n.link, n.isRead, n.createdAt);
        }
      }

      // SECURITY: refresh_tokens and password_reset_tokens are NOT restored from
      // Firestore backups. These are ephemeral session-bound secrets that must be
      // regenerated via login/reset flows. Restoring them would be a security risk.
    });

    restoreTransaction();
    sqliteDb.pragma('foreign_keys = ON');

    console.log('[DB Sync] SQLite database successfully restored from Cloud Firestore.');
  } catch (error) {
    console.error('[DB Sync] Failed to restore from Firestore:', error);
  }
}

// ─── Save to Firestore (Debounced) ───────────────────────────────────────────

let syncTimeout: NodeJS.Timeout | null = null;

/**
 * Debounced save of the entire SQLite database to Firestore.
 * Called automatically on every mutating SQL operation via the db.prepare wrapper.
 */
export function saveStateToFirestoreDebounced(sqliteDb: Database.Database): void {
  initFirebase();
  if (!firestoreDb) return;

  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(async () => {
    try {
      const authed = await ensureServerAuth();
      if (!authed) return;

      const payload: Record<string, any> = {};
      for (const table of TABLES) {
        try {
          const columns = SYNC_COLUMNS[table];
          const query = columns
            ? `SELECT ${columns.join(', ')} FROM ${table}`
            : `SELECT * FROM ${table}`;
          const rows = sqliteDb.prepare(query).all() as any[];
          payload[table] = rows;
        } catch {
          payload[table] = [];
        }
      }

      payload.updatedAt = new Date().toISOString();

      const backupDocRef = doc(firestoreDb!, 'database_backups', 'latest');
      await setDoc(backupDocRef, payload);
      console.log('[DB Sync] Database backup saved to Cloud Firestore.');
    } catch (error) {
      console.error('[DB Sync] Failed to save backup to Firestore:', error);
    }
  }, 1000);
}

// ─── Write-Through Interceptor ────────────────────────────────────────────────

/**
 * Wraps a database instance's `prepare` method to intercept mutating operations
 * and trigger Firestore synchronization. This ensures that ALL writes — from
 * any module using the shared db — are automatically synced.
 */
export function attachWriteInterceptor(sqliteDb: Database.Database): void {
  const originalPrepare = sqliteDb.prepare.bind(sqliteDb);

  (sqliteDb as any).prepare = function (sql: string) {
    const statement = originalPrepare(sql);
    const originalRun = statement.run.bind(statement);

    statement.run = function (...args: any[]) {
      const result = originalRun(...args);
      const normalizedSql = sql.trim().toUpperCase();
      if (
        normalizedSql.startsWith('INSERT') ||
        normalizedSql.startsWith('UPDATE') ||
        normalizedSql.startsWith('DELETE') ||
        normalizedSql.startsWith('REPLACE') ||
        normalizedSql.startsWith('CREATE TABLE') ||
        normalizedSql.startsWith('DROP') ||
        normalizedSql.startsWith('ALTER')
      ) {
        saveStateToFirestoreDebounced(sqliteDb);
      }
      return result;
    };

    return statement;
  };
}
