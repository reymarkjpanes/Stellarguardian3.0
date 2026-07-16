import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import Database from 'better-sqlite3';

// Initialize Firebase client SDK on the server
const app = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(app);
const auth = getAuth(app);

// Use a fallback account or anonymous authentication for server read/write to Firestore
// Or we can sign in anonymously to satisfy security rules "request.auth != null"
import { signInAnonymously } from 'firebase/auth';

let isFirebaseAuthed = false;

export async function ensureServerAuth() {
  if (isFirebaseAuthed) return;
  try {
    await signInAnonymously(auth);
    isFirebaseAuthed = true;
    console.log('[Firebase] Server authenticated anonymously to secure database connection.');
  } catch (err) {
    console.error('[Firebase] Failed to authenticate server with Firestore:', err);
  }
}

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
  'rsvps'
];

// Load snapshot from Firestore into local SQLite
export async function loadStateFromFirestore(sqliteDb: Database.Database) {
  await ensureServerAuth();
  console.log('[Firebase] Checking for database backups in cloud Firestore...');
  try {
    const backupDocRef = doc(firestoreDb, 'database_backups', 'latest');
    const docSnap = await getDoc(backupDocRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('[Firebase] Found latest database backup in Cloud Firestore, restoring state...');
      
      sqliteDb.transaction(() => {
        // Drop existing rows safely to prevent constraints issues
        // Disable foreign keys temporarily during the transaction
        sqliteDb.pragma('foreign_keys = OFF');
        
        for (const table of TABLES) {
          try {
            sqliteDb.prepare(`DELETE FROM ${table}`).run();
          } catch (e) {
            // Table might not exist yet
          }
        }
        
        // Re-insert users
        if (Array.isArray(data.users)) {
          const stmt = sqliteDb.prepare(`
            INSERT INTO users (id, name, email, password, walletAddress, isAdmin)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (const u of data.users) {
            stmt.run(u.id, u.name, u.email, u.password, u.walletAddress, u.isAdmin);
          }
        }

        // Re-insert events
        if (Array.isArray(data.events)) {
          const stmt = sqliteDb.prepare(`
            INSERT INTO events (
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
              e.bannerUrl || null, e.contactEmail || null
            );
          }
        }

        // Re-insert event_memberships
        if (Array.isArray(data.event_memberships)) {
          const stmt = sqliteDb.prepare(`
            INSERT INTO event_memberships (id, eventId, userId, role, status)
            VALUES (?, ?, ?, ?, ?)
          `);
          for (const m of data.event_memberships) {
            stmt.run(m.id, m.eventId, m.userId, m.role, m.status);
          }
        }

        // Re-insert invitations
        if (Array.isArray(data.invitations)) {
          const stmt = sqliteDb.prepare(`
            INSERT INTO invitations (id, kind, eventId, email, token, status, invitedByUserId, expiresAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const i of data.invitations) {
            stmt.run(i.id, i.kind, i.eventId, i.email, i.token, i.status, i.invitedByUserId, i.expiresAt);
          }
        }

        // Re-insert dev_emails
        if (Array.isArray(data.dev_emails)) {
          const stmt = sqliteDb.prepare(`
            INSERT INTO dev_emails (id, to_email, subject, body, invite_link, sent_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (const d of data.dev_emails) {
            stmt.run(d.id, d.to_email, d.subject, d.body, d.invite_link, d.sent_at);
          }
        }

        // Re-insert transactions
        if (Array.isArray(data.transactions)) {
          const stmt = sqliteDb.prepare(`
            INSERT INTO transactions (id, eventId, type, amountXLM, fromWallet, toWallet, txRef, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const t of data.transactions) {
            stmt.run(t.id, t.eventId, t.type, t.amountXLM, t.fromWallet, t.toWallet, t.txRef, t.timestamp);
          }
        }

        // Re-insert teams
        if (Array.isArray(data.teams)) {
          const stmt = sqliteDb.prepare(`
            INSERT INTO teams (id, eventId, name, createdAt)
            VALUES (?, ?, ?, ?)
          `);
          for (const t of data.teams) {
            stmt.run(t.id, t.eventId, t.name, t.createdAt);
          }
        }

        // Re-insert team_members
        if (Array.isArray(data.team_members)) {
          const stmt = sqliteDb.prepare(`
            INSERT INTO team_members (teamId, userId)
            VALUES (?, ?)
          `);
          for (const tm of data.team_members) {
            stmt.run(tm.teamId, tm.userId);
          }
        }

        // Re-insert sponsors
        if (Array.isArray(data.sponsors)) {
          const stmt = sqliteDb.prepare(`
            INSERT INTO sponsors (id, eventId, name, logo, tier)
            VALUES (?, ?, ?, ?, ?)
          `);
          for (const s of data.sponsors) {
            stmt.run(s.id, s.eventId, s.name, s.logo, s.tier);
          }
        }

        // Re-insert milestones
        if (Array.isArray(data.milestones)) {
          const stmt = sqliteDb.prepare(`
            INSERT INTO milestones (id, eventId, title, date, description)
            VALUES (?, ?, ?, ?, ?)
          `);
          for (const m of data.milestones) {
            stmt.run(m.id, m.eventId, m.title, m.date, m.description);
          }
        }

        // Re-insert submissions
        if (Array.isArray(data.submissions)) {
          const stmt = sqliteDb.prepare(`
            INSERT INTO submissions (id, eventId, teamId, userId, title, description, url, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const s of data.submissions) {
            stmt.run(s.id, s.eventId, s.teamId, s.userId, s.title, s.description, s.url, s.createdAt, s.updatedAt);
          }
        }

        // Re-insert evaluations
        if (Array.isArray(data.evaluations)) {
          const stmt = sqliteDb.prepare(`
            INSERT INTO evaluations (id, submissionId, judgeId, score, feedback, createdAt)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (const ev of data.evaluations) {
            stmt.run(ev.id, ev.submissionId, ev.judgeId, ev.score, ev.feedback, ev.createdAt);
          }
        }

        // Re-insert announcements
        if (Array.isArray(data.announcements)) {
          const stmt = sqliteDb.prepare(`
            INSERT INTO announcements (id, eventId, title, body, createdAt)
            VALUES (?, ?, ?, ?, ?)
          `);
          for (const a of data.announcements) {
            stmt.run(a.id, a.eventId, a.title, a.body, a.createdAt);
          }
        }

        // Re-insert winners
        if (Array.isArray(data.winners)) {
          const stmt = sqliteDb.prepare(`
            INSERT INTO winners (id, eventId, submissionId, rank, prizeAmount)
            VALUES (?, ?, ?, ?, ?)
          `);
          for (const w of data.winners) {
            stmt.run(w.id, w.eventId, w.submissionId, w.rank, w.prizeAmount);
          }
        }

        // Re-insert rsvps
        if (Array.isArray(data.rsvps)) {
          const stmt = sqliteDb.prepare(`
            INSERT INTO rsvps (eventId, userId, status)
            VALUES (?, ?, ?)
          `);
          for (const r of data.rsvps) {
            stmt.run(r.eventId, r.userId, r.status);
          }
        }
        
        sqliteDb.pragma('foreign_keys = ON');
      });
      
      console.log('[Firebase] SQLite database successfully restored from Cloud Firestore.');
    } else {
      console.log('[Firebase] No existing cloud database backup found. Starting fresh.');
    }
  } catch (error) {
    console.error('[Firebase] Failed to restore SQLite database from Firestore:', error);
  }
}

let syncTimeout: NodeJS.Timeout | null = null;

// Save current SQLite database to Firestore (Debounced to batch updates)
export function saveStateToFirestoreDebounced(sqliteDb: Database.Database) {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  
  syncTimeout = setTimeout(async () => {
    try {
      await ensureServerAuth();
      console.log('[Firebase] Initiating debounced SQLite backup to Cloud Firestore...');
      
      const payload: Record<string, any> = {};
      for (const table of TABLES) {
        try {
          payload[table] = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
        } catch (e) {
          payload[table] = [];
        }
      }
      
      payload.updatedAt = new Date().toISOString();
      
      const backupDocRef = doc(firestoreDb, 'database_backups', 'latest');
      await setDoc(backupDocRef, payload);
      console.log('[Firebase] SQLite database backup successfully saved to Cloud Firestore.');
    } catch (error) {
      console.error('[Firebase] Failed to save SQLite backup to Firestore:', error);
    }
  }, 1000);
}
