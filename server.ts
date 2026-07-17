import express from "express";
import path from "path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { z } from "zod";
import { createServer as createViteServer } from "vite";

// ─── New Modular Routes (Phase 1 Architecture) ────────────────────────────────
import { authRouter } from './server/routes/auth';
import { notificationsRouter } from './server/routes/notifications';
import { stellarRouter } from './server/routes/stellar';
import { errorHandler } from './server/middleware/errorHandler';

// ─── Structured Logger ────────────────────────────────────────────────────────
const log = {
  info: (msg: string, ctx?: object) =>
    console.log(JSON.stringify({ level: 'info', msg, ...ctx, ts: new Date().toISOString() })),
  warn: (msg: string, ctx?: object) =>
    console.warn(JSON.stringify({ level: 'warn', msg, ...ctx, ts: new Date().toISOString() })),
  error: (msg: string, err?: unknown, ctx?: object) =>
    console.error(JSON.stringify({ level: 'error', msg, error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, ...ctx, ts: new Date().toISOString() })),
};

// ─── JWT Secret Guard ─────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  log.error('FATAL: JWT_SECRET environment variable is not set. Server will not start.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // unsafe-inline needed for Vite dev
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://horizon-testnet.stellar.org', 'https://horizon.stellar.org'],
      fontSrc: ["'self'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
    },
  },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, mobile apps, Postman)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    log.warn('CORS blocked request', { origin });
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ─── Body Limits ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many attempts. Please try again later.' } },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many requests. Please slow down.' } },
});

app.use('/api/auth/', authLimiter);
app.use('/api/', generalLimiter);

// ─── State Machine ─────────────────────────────────────────────────────────────
const VALID_TRANSITIONS: Record<string, string[]> = {
  'Draft':                ['Funded', 'Cancelled'],
  'Funded':               ['Published', 'Cancelled'],
  'Published':            ['Registration Open', 'Cancelled'],
  'Registration Open':    ['Registration Closed', 'Cancelled'],
  'Registration Closed':  ['In Progress', 'Cancelled'],
  'In Progress':          ['Judging', 'Cancelled'],
  'Judging':              ['Completed'],
  'Completed':            ['Archived'],
  'Cancelled':            [],
  'Archived':             [],
};

function isValidTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

// Initialize SQLite Database
const db = new Database("database.sqlite");
db.pragma("journal_mode = WAL");

// Setup Firestore synchronization
import { loadStateFromFirestore, saveStateToFirestoreDebounced } from "./src/lib/serverFirebase";

const originalPrepare = db.prepare.bind(db);
db.prepare = function(sql: string) {
  const statement = originalPrepare(sql);
  const originalRun = statement.run.bind(statement);
  statement.run = function(...args: any[]) {
    const result = originalRun(...args);
    const normalizedSql = sql.trim().toUpperCase();
    if (
      normalizedSql.startsWith("INSERT") ||
      normalizedSql.startsWith("UPDATE") ||
      normalizedSql.startsWith("DELETE") ||
      normalizedSql.startsWith("REPLACE") ||
      normalizedSql.startsWith("CREATE TABLE") ||
      normalizedSql.startsWith("DROP") ||
      normalizedSql.startsWith("ALTER")
    ) {
      saveStateToFirestoreDebounced(db);
    }
    return result;
  };
  return statement;
};


// Setup Schema
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
`);

// Safe Migration for existing databases
try { db.exec("ALTER TABLE events ADD COLUMN tags TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE events ADD COLUMN rulesPublished INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE events ADD COLUMN timelineConfirmed INTEGER DEFAULT 0"); } catch (e) {}

try { db.exec("ALTER TABLE events ADD COLUMN capacity INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE events ADD COLUMN teamSizeMax INTEGER DEFAULT 4"); } catch (e) {}
try { db.exec("ALTER TABLE events ADD COLUMN bannerUrl TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE events ADD COLUMN contactEmail TEXT"); } catch (e) {}

db.exec(`
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
`);

// Restore state from Cloud Firestore if available
loadStateFromFirestore(db);

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Forbidden" });
    req.user = user;
    next();
  });
};

// --- API ROUTES ---

// ─── Zod Schemas ──────────────────────────────────────────────────────────────
const SignupSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().max(255).trim().toLowerCase(),
  password: z.string().min(8).max(128),
});

const LoginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1),
});

const ScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  feedback: z.string().max(2000).optional(),
});

const InviteSchema = z.object({
  eventId: z.number().int().positive(),
  emails: z.array(z.string().email()).min(1).max(50),
  role: z.enum(['Participant', 'Judge', 'Mentor']),
  message: z.string().max(1000).optional(),
});

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post("/api/auth/signup", (req, res) => {
  const result = SignupSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: result.error.flatten() } });
  }
  const { name, email, password } = result.data;
  const hashedPassword = bcrypt.hashSync(password, 12);
  try {
    const stmt = db.prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)");
    const info = stmt.run(name, email, hashedPassword);
    const token = jwt.sign({ id: info.lastInsertRowid, email, name }, JWT_SECRET, { expiresIn: "15m" });
    log.info('User registered', { userId: info.lastInsertRowid, email });
    res.status(201).json({ token, user: { id: info.lastInsertRowid, name, email, walletAddress: null, isAdmin: 0 } });
  } catch (err: any) {
    res.status(409).json({ error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' } });
  }
});

app.post("/api/auth/login", (req, res) => {
  const result = LoginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid credentials format' } });
  }
  const { email, password } = result.data;
  const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    log.warn('Failed login attempt', { email });
    return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
  }

  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "15m" });
  const { password: _, ...userWithoutPassword } = user;
  log.info('User logged in', { userId: user.id });
  res.json({ token, user: userWithoutPassword });
});

app.get("/api/auth/me", authenticateToken, (req: any, res) => {
  const user = db.prepare("SELECT id, name, email, walletAddress, isAdmin FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

app.post("/api/wallet/connect", authenticateToken, (req: any, res) => {
  const { walletAddress } = req.body;
  db.prepare("UPDATE users SET walletAddress = ? WHERE id = ?").run(walletAddress, req.user.id);
  res.json({ success: true, walletAddress });
});

// Events
app.post("/api/events", authenticateToken, (req: any, res) => {
  const { 
    title, description, category, format, visibility, 
    registrationDeadline, startDate, endDate, 
    prizeTotal, prizeBreakdown, tags,
    capacity, teamSizeMax, bannerUrl, contactEmail
  } = req.body;
  
  let tagsStr = "";
  if (Array.isArray(tags)) {
    tagsStr = tags.join(",");
  } else if (typeof tags === "string") {
    tagsStr = tags;
  }

  const stmt = db.prepare(`
    INSERT INTO events (
      hostUserId, title, description, category, format, visibility, 
      registrationDeadline, startDate, endDate, prizeTotal, prizeBreakdown, tags,
      capacity, teamSizeMax, bannerUrl, contactEmail
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const info = stmt.run(
    req.user.id, title, description, category, format, visibility,
    registrationDeadline, startDate, endDate, prizeTotal, prizeBreakdown, tagsStr,
    capacity || null, teamSizeMax || 4, bannerUrl || null, contactEmail || null
  );
  
  res.json({ id: info.lastInsertRowid });
});

app.get("/api/events", authenticateToken, (req: any, res) => {
  // Get events where user is host
  const hosted: any = db.prepare("SELECT * FROM events WHERE hostUserId = ?").all(req.user.id);
  
  for (const event of hosted) {
    const pending = db.prepare("SELECT count(*) as count FROM event_memberships WHERE eventId = ? AND status = 'pending'").get(event.id) as any;
    event.pendingApprovals = pending.count;
    const submissions = db.prepare("SELECT count(*) as count FROM submissions WHERE eventId = ?").get(event.id) as any;
    event.submissionsCount = submissions.count;
  }

  // Get events where user is participant or judge
  const participating = db.prepare(`
    SELECT e.*, m.role, m.status 
    FROM events e 
    JOIN event_memberships m ON e.id = m.eventId 
    WHERE m.userId = ? AND m.role = 'Participant'
  `).all(req.user.id);

  const judging = db.prepare(`
    SELECT e.*, m.role, m.status 
    FROM events e 
    JOIN event_memberships m ON e.id = m.eventId 
    WHERE m.userId = ? AND m.role = 'Judge'
  `).all(req.user.id);

  res.json({ hosted, participating, judging });
});

app.get("/api/events/public", (req, res) => {
  const events = db.prepare("SELECT * FROM events WHERE visibility = 'Public' AND state IN ('Published', 'Registration Open')").all();
  res.json({ events });
});

app.get("/api/events/:id", (req: any, res) => {
  const event: any = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });

  let user: any = null;
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token) {
    try {
      user = jwt.verify(token, JWT_SECRET);
    } catch (e) {}
  }

  const isPublic = event.visibility === 'Public';
  const isPublished = event.state !== 'Draft' && event.state !== 'Funded';
  
  let myMembership = null;
  let myRsvp = null;

  let canView = false;
  if (isPublic && isPublished) {
    canView = true;
  }
  
  if (user) {
    if (user.id === event.hostUserId) {
      canView = true;
    } else {
      myMembership = db.prepare("SELECT role, status FROM event_memberships WHERE eventId = ? AND userId = ?").get(event.id, user.id);
      if (myMembership) canView = true;
    }
    
    // Always fetch RSVP if user is logged in
    const rsvp: any = db.prepare("SELECT status FROM rsvps WHERE eventId = ? AND userId = ?").get(event.id, user.id);
    if (rsvp) myRsvp = rsvp.status;
  }

  if (!canView) {
    return res.status(403).json({ error: "You do not have permission to view this event." });
  }

  const host: any = db.prepare("SELECT id, name, walletAddress FROM users WHERE id = ?").get(event.hostUserId);
  const judges = db.prepare("SELECT count(*) as count FROM event_memberships WHERE eventId = ? AND role = 'Judge'").get(event.id) as any;
  const participants = db.prepare("SELECT count(*) as count FROM event_memberships WHERE eventId = ? AND role = 'Participant'").get(event.id) as any;

  // Retrieve event members and pending invites
  const members = db.prepare(`
    SELECT m.id, m.role, m.status, u.id as userId, u.name, u.email, u.walletAddress,
           (SELECT status FROM rsvps r WHERE r.eventId = m.eventId AND r.userId = m.userId) as rsvpStatus
    FROM event_memberships m
    JOIN users u ON m.userId = u.id
    WHERE m.eventId = ?
  `).all(event.id);

  const invitations = db.prepare(`
    SELECT i.id, i.email, i.token, i.status, i.kind, i.expiresAt, u.name as invitedByName
    FROM invitations i
    JOIN users u ON i.invitedByUserId = u.id
    WHERE i.eventId = ? AND i.status = 'pending'
  `).all(event.id);

  const transactions = db.prepare(`
    SELECT * FROM transactions WHERE eventId = ? ORDER BY timestamp DESC
  `).all(event.id);

  const teams = db.prepare(`
    SELECT t.*, 
    (SELECT json_group_array(json_object('id', u.id, 'name', u.name)) 
     FROM team_members tm JOIN users u ON tm.userId = u.id WHERE tm.teamId = t.id) as membersStr
    FROM teams t WHERE eventId = ?
  `).all(event.id).map((t: any) => ({ ...t, members: t.membersStr ? JSON.parse(t.membersStr) : [] }));
  const sponsors = db.prepare(`SELECT * FROM sponsors WHERE eventId = ?`).all(event.id);
  const milestones = db.prepare(`SELECT * FROM milestones WHERE eventId = ? ORDER BY date ASC`).all(event.id);
  const announcements = db.prepare(`SELECT * FROM announcements WHERE eventId = ? ORDER BY createdAt DESC`).all(event.id);
  
  const submissions = db.prepare(`
    SELECT s.*, u.name as submitterName, t.name as teamName,
    (SELECT COUNT(*) FROM evaluations e WHERE e.submissionId = s.id) as evaluationCount,
    (SELECT AVG(score) FROM evaluations e WHERE e.submissionId = s.id) as averageScore
    FROM submissions s
    JOIN users u ON s.userId = u.id
    LEFT JOIN teams t ON s.teamId = t.id
    WHERE s.eventId = ?
  `).all(event.id);

  const evaluations = db.prepare(`
    SELECT e.*, u.name as judgeName 
    FROM evaluations e
    JOIN submissions s ON e.submissionId = s.id
    JOIN users u ON e.judgeId = u.id
    WHERE s.eventId = ?
  `).all(event.id);

  const winners = db.prepare(`
    SELECT w.*, s.title as submissionTitle, s.url as submissionUrl, t.name as teamName, u.name as submitterName
    FROM winners w
    JOIN submissions s ON w.submissionId = s.id
    LEFT JOIN teams t ON s.teamId = t.id
    LEFT JOIN users u ON s.userId = u.id
    WHERE w.eventId = ?
    ORDER BY w.rank ASC
  `).all(event.id);
  
  const rsvps = db.prepare(`
    SELECT r.status, u.name, u.email
    FROM rsvps r
    JOIN users u ON r.userId = u.id
    WHERE r.eventId = ?
  `).all(event.id);
  
  const rsvpStats = {
    going: rsvps.filter((r: any) => r.status === 'Going').length,
    maybe: rsvps.filter((r: any) => r.status === 'Maybe').length,
    notGoing: rsvps.filter((r: any) => r.status === 'Not Going').length
  };

  // Trust Checklist Data
  const isFunded = event.state !== 'Draft';
  const organizerVerified = host.walletAddress && event.fundingTxRef ? true : false; // Naive check for now
  
  res.json({
    ...event,
    host,
    myMembership,
    myRsvp,
    stats: { judgesCount: judges.count, participantsCount: participants.count, rsvps: rsvpStats },
    trustChecklist: {
      prizeFunded: isFunded,
      organizerVerified: organizerVerified,
      judgesAssigned: judges.count > 0,
      rulesPublished: !!event.rulesPublished,
      timelineConfirmed: !!event.timelineConfirmed
    },
    members,
    invitations,
    transactions,
    teams,
    sponsors,
    milestones,
    announcements,
    submissions,
    evaluations,
    winners
  });
});


app.post("/api/events/:id/rsvp", authenticateToken, (req: any, res) => {
  const { status } = req.body;
  if (!['Going', 'Maybe', 'Not Going'].includes(status)) {
    return res.status(400).json({ error: "Invalid RSVP status" });
  }
  
  db.prepare("INSERT INTO rsvps (eventId, userId, status) VALUES (?, ?, ?) ON CONFLICT(eventId, userId) DO UPDATE SET status = excluded.status").run(req.params.id, req.user.id, status);
  res.json({ success: true, status });
});

app.post("/api/events/:id/apply", authenticateToken, (req: any, res) => {
  const event: any = db.prepare("SELECT visibility FROM events WHERE id = ?").get(req.params.id);
  if (!event || event.visibility !== 'Public') return res.status(400).json({ error: "Cannot apply" });

  try {
    db.prepare("INSERT INTO event_memberships (eventId, userId, role, status) VALUES (?, ?, 'Participant', 'pending')")
      .run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Already applied" });
  }
});

app.put("/api/events/:id", authenticateToken, (req: any, res) => {
  const { title, description, category, format, visibility, registrationDeadline, startDate, endDate, prizeTotal, prizeBreakdown, tags, rulesPublished, timelineConfirmed, capacity, teamSizeMax, bannerUrl, contactEmail } = req.body;
  const event: any = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.hostUserId !== req.user.id) return res.status(403).json({ error: "Not host" });

  let tagsStr = "";
  if (Array.isArray(tags)) {
    tagsStr = tags.join(",");
  } else if (typeof tags === "string") {
    tagsStr = tags;
  }

  // Allow updating most fields, but restrict prize updates if already funded/published
  let newPrizeTotal = event.prizeTotal;
  let newPrizeBreakdown = event.prizeBreakdown;
  if (event.state === 'Draft') {
    newPrizeTotal = prizeTotal ?? event.prizeTotal;
    newPrizeBreakdown = prizeBreakdown ?? event.prizeBreakdown;
  }

  db.prepare(`
    UPDATE events
    SET title = ?, description = ?, category = ?, format = ?, visibility = ?,
        registrationDeadline = ?, startDate = ?, endDate = ?,
        prizeTotal = ?, prizeBreakdown = ?, tags = ?,
        rulesPublished = ?, timelineConfirmed = ?,
        capacity = ?, teamSizeMax = ?, bannerUrl = ?, contactEmail = ?
    WHERE id = ?
  `).run(
    title ?? event.title, description ?? event.description, category ?? event.category, format ?? event.format, visibility ?? event.visibility,
    registrationDeadline ?? event.registrationDeadline, startDate ?? event.startDate, endDate ?? event.endDate,
    newPrizeTotal, newPrizeBreakdown, tagsStr ?? event.tags,
    rulesPublished !== undefined ? (rulesPublished ? 1 : 0) : event.rulesPublished,
    timelineConfirmed !== undefined ? (timelineConfirmed ? 1 : 0) : event.timelineConfirmed,
    capacity !== undefined ? capacity : event.capacity,
    teamSizeMax !== undefined ? teamSizeMax : event.teamSizeMax,
    bannerUrl !== undefined ? bannerUrl : event.bannerUrl,
    contactEmail !== undefined ? contactEmail : event.contactEmail,
    req.params.id
  );

  res.json({ success: true });
});

app.post("/api/events/:id/cancel", authenticateToken, (req: any, res) => {
  const event: any = db.prepare("SELECT hostUserId FROM events WHERE id = ?").get(req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.hostUserId !== req.user.id) return res.status(403).json({ error: "Not host" });

  db.prepare("UPDATE events SET state = 'Cancelled' WHERE id = ?").run(req.params.id);
  res.json({ success: true, state: 'Cancelled' });
});

app.post("/api/events/:id/archive", authenticateToken, (req: any, res) => {
  const event: any = db.prepare("SELECT hostUserId FROM events WHERE id = ?").get(req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.hostUserId !== req.user.id) return res.status(403).json({ error: "Not host" });

  db.prepare("UPDATE events SET state = 'Archived' WHERE id = ?").run(req.params.id);
  res.json({ success: true, state: 'Archived' });
});

app.delete("/api/events/:id", authenticateToken, (req: any, res) => {
  const event: any = db.prepare("SELECT hostUserId FROM events WHERE id = ?").get(req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.hostUserId !== req.user.id) return res.status(403).json({ error: "Not host" });

  db.transaction(() => {
    db.prepare("DELETE FROM event_memberships WHERE eventId = ?").run(req.params.id);
    db.prepare("DELETE FROM submissions WHERE eventId = ?").run(req.params.id);
    db.prepare("DELETE FROM teams WHERE eventId = ?").run(req.params.id);
    db.prepare("DELETE FROM milestones WHERE eventId = ?").run(req.params.id);
    db.prepare("DELETE FROM sponsors WHERE eventId = ?").run(req.params.id);
    db.prepare("DELETE FROM events WHERE id = ?").run(req.params.id);
  })();

  res.json({ success: true });
});

// ─── Escrow / Funding ─────────────────────────────────────────────────────────
// NOTE: This generates a testnet-ready transaction reference.
// Phase 4 (Stellar integration) will replace this with a real Stellar SDK call.
app.post("/api/events/:id/fund", authenticateToken, (req: any, res) => {
  const event: any = db.prepare("SELECT hostUserId, prizeTotal, state FROM events WHERE id = ?").get(req.params.id);
  if (!event) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found' } });
  if (event.hostUserId !== req.user.id) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the host can fund this event' } });
  if (!isValidTransition(event.state, 'Funded')) {
    return res.status(422).json({ error: { code: 'INVALID_TRANSITION', message: `Cannot fund event in state: ${event.state}` } });
  }

  const host: any = db.prepare("SELECT walletAddress FROM users WHERE id = ?").get(req.user.id);
  if (!host.walletAddress) return res.status(400).json({ error: { code: 'WALLET_REQUIRED', message: 'Please connect your Stellar wallet before funding.' } });

  // Cryptographically secure transaction reference (placeholder for Stellar SDK integration)
  const txRef = crypto.randomBytes(32).toString('hex');
  
  db.transaction(() => {
    db.prepare("UPDATE events SET state = 'Funded', fundingTxRef = ? WHERE id = ?").run(txRef, req.params.id);
    db.prepare("INSERT INTO transactions (eventId, type, amountXLM, fromWallet, txRef) VALUES (?, 'fund', ?, ?, ?)")
      .run(req.params.id, event.prizeTotal, host.walletAddress, txRef);
  })();

  log.info('Event funded', { eventId: req.params.id, txRef, userId: req.user.id });
  res.json({ success: true, txRef, state: 'Funded' });
});

app.post("/api/events/:id/publish", authenticateToken, (req: any, res) => {
  const event: any = db.prepare("SELECT hostUserId, state FROM events WHERE id = ?").get(req.params.id);
  if (event.hostUserId !== req.user.id) return res.status(403).json({ error: "Not host" });
  if (event.state !== 'Funded') return res.status(400).json({ error: "Must be funded to publish" });

  db.prepare("UPDATE events SET state = 'Published' WHERE id = ?").run(req.params.id);
  res.json({ success: true, state: 'Published' });
});

app.post("/api/events/:id/state", authenticateToken, (req: any, res) => {
  const { newState } = req.body;
  if (!newState || typeof newState !== 'string') {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'newState is required' } });
  }
  const event: any = db.prepare("SELECT hostUserId, state FROM events WHERE id = ?").get(req.params.id);
  if (!event) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found' } });
  if (event.hostUserId !== req.user.id) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the host can change event state' } });

  // Enforce state machine — forward-only transitions
  if (!isValidTransition(event.state, newState)) {
    return res.status(422).json({ 
      error: { 
        code: 'INVALID_TRANSITION', 
        message: `Cannot transition from '${event.state}' to '${newState}'. Valid transitions: ${(VALID_TRANSITIONS[event.state] || []).join(', ') || 'none'}` 
      } 
    });
  }

  db.prepare("UPDATE events SET state = ? WHERE id = ?").run(newState, req.params.id);
  log.info('Event state changed', { eventId: req.params.id, from: event.state, to: newState, userId: req.user.id });
  res.json({ success: true, state: newState });
});

app.post("/api/events/:id/payout", authenticateToken, (req: any, res) => {
  const event: any = db.prepare("SELECT hostUserId, state, prizeTotal FROM events WHERE id = ?").get(req.params.id);
  if (!event) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found' } });
  if (event.hostUserId !== req.user.id) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the host can initiate payout' } });
  if (event.state !== 'Completed') return res.status(400).json({ error: { code: 'INVALID_STATE', message: 'Event must be in Completed state to payout' } });

  const host: any = db.prepare("SELECT walletAddress FROM users WHERE id = ?").get(req.user.id);
  // Cryptographically secure payout reference (placeholder for Stellar SDK disbursement in Phase 4)
  const payoutTxRef = crypto.randomBytes(32).toString('hex');

  db.transaction(() => {
    db.prepare("INSERT INTO transactions (eventId, type, amountXLM, fromWallet, toWallet, txRef) VALUES (?, 'payout', ?, ?, 'WINNERS_WALLETS', ?)")
      .run(req.params.id, event.prizeTotal, host.walletAddress || 'ESCROW_ACCOUNT', payoutTxRef);
  })();

  log.info('Payout initiated', { eventId: req.params.id, txRef: payoutTxRef, userId: req.user.id });
  res.json({ success: true, message: "Payout initiated. Stellar SDK disbursement coming in Phase 4.", txRef: payoutTxRef });
});

// Membership and Invite Administration for Hosts
app.post("/api/events/:id/memberships/:membershipId/status", authenticateToken, (req: any, res) => {
  const { status } = req.body; // 'accepted' or 'rejected'
  const event: any = db.prepare("SELECT hostUserId FROM events WHERE id = ?").get(req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.hostUserId !== req.user.id) return res.status(403).json({ error: "Only host can manage memberships" });

  if (status !== 'accepted' && status !== 'rejected' && status !== 'pending') {
    return res.status(400).json({ error: "Invalid status value" });
  }

  db.prepare("UPDATE event_memberships SET status = ? WHERE id = ? AND eventId = ?")
    .run(status, req.params.membershipId, req.params.id);

  res.json({ success: true, status });
});

app.delete("/api/events/:id/memberships/:membershipId", authenticateToken, (req: any, res) => {
  const event: any = db.prepare("SELECT hostUserId FROM events WHERE id = ?").get(req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.hostUserId !== req.user.id) return res.status(403).json({ error: "Only host can revoke memberships" });

  db.prepare("DELETE FROM event_memberships WHERE id = ? AND eventId = ?")
    .run(req.params.membershipId, req.params.id);

  res.json({ success: true });
});

app.delete("/api/events/:id/invites/:inviteId", authenticateToken, (req: any, res) => {
  const event: any = db.prepare("SELECT hostUserId FROM events WHERE id = ?").get(req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.hostUserId !== req.user.id) return res.status(403).json({ error: "Only host can cancel invitations" });

  db.prepare("DELETE FROM invitations WHERE id = ? AND eventId = ?")
    .run(req.params.inviteId, req.params.id);

  res.json({ success: true });
});

// ─── Invites ──────────────────────────────────────────────────────────────────
app.post("/api/invites", authenticateToken, (req: any, res) => {
  const result = InviteSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid invite data', details: result.error.flatten() } });
  }
  const { eventId, emails, role, message } = result.data;

  const event: any = db.prepare("SELECT title, hostUserId FROM events WHERE id = ?").get(eventId);
  if (!event) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found' } });
  if (event.hostUserId !== req.user.id) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only host can send invitations' } });
  
  const insertInvite = db.prepare("INSERT OR IGNORE INTO invitations (kind, eventId, email, token, invitedByUserId, expiresAt) VALUES (?, ?, ?, ?, ?, datetime('now', '+14 days'))");
  const insertEmail = db.prepare("INSERT INTO dev_emails (to_email, subject, body, invite_link) VALUES (?, ?, ?, ?)");
  
  const tokens: string[] = [];
  
  db.transaction(() => {
    for (const email of emails) {
      // Cryptographically secure invite token
      const token = crypto.randomBytes(32).toString('hex');
      insertInvite.run(`event_${role.toLowerCase()}`, eventId, email, token, req.user.id);
      
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const inviteLink = `${appUrl}/invite/${token}`;
      const emailBody = `You have been invited to join '${event.title}' as a ${role}.\n${message ? `Message: ${message}` : ''}`;
      
      insertEmail.run(email, `Invitation to ${event.title}`, emailBody, inviteLink);
      tokens.push(token);
    }
  })();
  
  log.info('Invites sent', { eventId, count: emails.length, role, userId: req.user.id });
  res.json({ success: true, count: tokens.length });
});

app.get("/api/invites/:token", (req, res) => {
  const invite: any = db.prepare(`
    SELECT i.*, e.title, e.description, e.state, e.prizeTotal, u.name as inviterName 
    FROM invitations i
    JOIN events e ON i.eventId = e.id
    JOIN users u ON i.invitedByUserId = u.id
    WHERE i.token = ? AND i.status = 'pending' AND i.expiresAt > datetime('now')
  `).get(req.params.token);
  
  if (!invite) return res.status(404).json({ error: "Invalid or expired invite" });
  res.json({ invite });
});

app.post("/api/invites/:token/accept", authenticateToken, (req: any, res) => {
  const invite: any = db.prepare("SELECT * FROM invitations WHERE token = ? AND status = 'pending'").get(req.params.token);
  if (!invite) return res.status(404).json({ error: "Invalid or expired invite" });
  if (invite.email.toLowerCase() !== req.user.email.toLowerCase()) {
    return res.status(403).json({ error: "Email mismatch" });
  }

  const role = invite.kind === 'event_judge' ? 'Judge' : 'Participant';
  
  db.transaction(() => {
    db.prepare("UPDATE invitations SET status = 'accepted' WHERE id = ?").run(invite.id);
    db.prepare("INSERT OR IGNORE INTO event_memberships (eventId, userId, role, status) VALUES (?, ?, ?, 'accepted')")
      .run(invite.eventId, req.user.id, role);
  })();

  res.json({ success: true, eventId: invite.eventId });
});

// ─── Dev Outbox — ONLY IN DEVELOPMENT ────────────────────────────────────────
app.get("/api/dev/emails", authenticateToken, (req: any, res) => {
  // Block this endpoint in production to prevent PII exposure
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  }
  const user = db.prepare("SELECT isAdmin FROM users WHERE id = ?").get((req as any).user.id) as any;
  if (!user || user.isAdmin !== 1) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } });

  const emails = db.prepare("SELECT id, to_email, subject, sent_at FROM dev_emails ORDER BY sent_at DESC LIMIT 50").all();
  res.json({ emails });
});

// Milestones
app.post("/api/events/:id/milestones", authenticateToken, (req: any, res) => {
  const { title, date, description } = req.body;
  const eventId = req.params.id;

  const event: any = db.prepare("SELECT hostUserId FROM events WHERE id = ?").get(eventId);
  if (!event || event.hostUserId !== req.user.id) return res.status(403).json({ error: "Only host can add milestones" });

  const stmt = db.prepare("INSERT INTO milestones (eventId, title, date, description) VALUES (?, ?, ?, ?)");
  stmt.run(eventId, title, date, description);
  res.json({ success: true });
});

app.delete("/api/events/:id/milestones/:milestoneId", authenticateToken, (req: any, res) => {
  const { id: eventId, milestoneId } = req.params;
  const event: any = db.prepare("SELECT hostUserId FROM events WHERE id = ?").get(eventId);
  if (!event || event.hostUserId !== req.user.id) return res.status(403).json({ error: "Only host can remove milestones" });

  db.prepare("DELETE FROM milestones WHERE id = ? AND eventId = ?").run(milestoneId, eventId);
  res.json({ success: true });
});

// Sponsors
app.post("/api/events/:id/sponsors", authenticateToken, (req: any, res) => {
  const { name, logo, tier } = req.body;
  const eventId = req.params.id;

  const event: any = db.prepare("SELECT hostUserId FROM events WHERE id = ?").get(eventId);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.hostUserId !== req.user.id) return res.status(403).json({ error: "Only host can add sponsors" });

  const stmt = db.prepare("INSERT INTO sponsors (eventId, name, logo, tier) VALUES (?, ?, ?, ?)");
  const info = stmt.run(eventId, name, logo, tier);

  res.json({ success: true, sponsorId: info.lastInsertRowid });
});

app.delete("/api/events/:id/sponsors/:sponsorId", authenticateToken, (req: any, res) => {
  const { id: eventId, sponsorId } = req.params;

  const event: any = db.prepare("SELECT hostUserId FROM events WHERE id = ?").get(eventId);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.hostUserId !== req.user.id) return res.status(403).json({ error: "Only host can remove sponsors" });

  db.prepare("DELETE FROM sponsors WHERE id = ? AND eventId = ?").run(sponsorId, eventId);
  res.json({ success: true });
});

// Teams
app.post("/api/events/:id/teams", authenticateToken, (req: any, res) => {
  const { name } = req.body;
  const eventId = req.params.id;
  
  // Verify user is a participant
  const membership = db.prepare("SELECT status FROM event_memberships WHERE eventId = ? AND userId = ? AND role = 'Participant'").get(eventId, req.user.id) as any;
  if (!membership || membership.status !== 'accepted') return res.status(403).json({ error: "Only accepted participants can create teams" });

  let teamId;
  db.transaction(() => {
    const info = db.prepare("INSERT INTO teams (eventId, name) VALUES (?, ?)").run(eventId, name);
    teamId = info.lastInsertRowid;
    db.prepare("INSERT INTO team_members (teamId, userId) VALUES (?, ?)").run(teamId, req.user.id);
  })();

  res.json({ success: true, teamId });
});

// Submissions
app.post("/api/events/:id/submissions", authenticateToken, (req: any, res) => {
  const { title, description, url, teamId } = req.body;
  const eventId = req.params.id;

  const event: any = db.prepare("SELECT state FROM events WHERE id = ?").get(eventId);
  if (!event || event.state !== 'In Progress') return res.status(400).json({ error: "Submissions only allowed during 'In Progress' state" });

  const membership = db.prepare("SELECT status FROM event_memberships WHERE eventId = ? AND userId = ? AND role = 'Participant'").get(eventId, req.user.id) as any;
  if (!membership || membership.status !== 'accepted') return res.status(403).json({ error: "Only accepted participants can submit" });

  // if teamId provided, check if user is in team
  if (teamId) {
    const inTeam = db.prepare("SELECT 1 FROM team_members WHERE teamId = ? AND userId = ?").get(teamId, req.user.id);
    if (!inTeam) return res.status(403).json({ error: "Not in this team" });
  }

  const stmt = db.prepare("INSERT INTO submissions (eventId, teamId, userId, title, description, url) VALUES (?, ?, ?, ?, ?, ?)");
  const info = stmt.run(eventId, teamId || null, req.user.id, title, description, url);

  res.json({ success: true, submissionId: info.lastInsertRowid });
});

app.put("/api/events/:id/submissions/:submissionId", authenticateToken, (req: any, res) => {
  const { title, description, url } = req.body;
  const { id: eventId, submissionId } = req.params;

  const event: any = db.prepare("SELECT state FROM events WHERE id = ?").get(eventId);
  if (!event || event.state !== 'In Progress') return res.status(400).json({ error: "Edits only allowed during 'In Progress' state" });

  const submission: any = db.prepare("SELECT userId, teamId FROM submissions WHERE id = ? AND eventId = ?").get(submissionId, eventId);
  if (!submission) return res.status(404).json({ error: "Submission not found" });

  let canEdit = false;
  if (submission.userId === req.user.id) canEdit = true;
  if (submission.teamId) {
    const inTeam = db.prepare("SELECT 1 FROM team_members WHERE teamId = ? AND userId = ?").get(submission.teamId, req.user.id);
    if (inTeam) canEdit = true;
  }

  if (!canEdit) return res.status(403).json({ error: "Not authorized to edit this submission" });

  db.prepare("UPDATE submissions SET title = ?, description = ?, url = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(title, description, url, submissionId);
  res.json({ success: true });
});

// ─── Evaluations ──────────────────────────────────────────────────────────────
app.post("/api/events/:id/submissions/:submissionId/score", authenticateToken, (req: any, res) => {
  const result = ScoreSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Score must be an integer between 0 and 100', details: result.error.flatten() } });
  }
  const { score, feedback } = result.data;
  const { id: eventId, submissionId } = req.params;

  const event: any = db.prepare("SELECT state FROM events WHERE id = ?").get(eventId);
  if (!event || event.state !== 'Judging') return res.status(400).json({ error: { code: 'INVALID_STATE', message: "Scoring only allowed during 'Judging' state" } });

  const membership = db.prepare("SELECT status FROM event_memberships WHERE eventId = ? AND userId = ? AND role = 'Judge'").get(eventId, (req as any).user.id) as any;
  if (!membership || membership.status !== 'accepted') return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only accepted judges can score' } });

  const submission: any = db.prepare("SELECT id, userId FROM submissions WHERE id = ? AND eventId = ?").get(submissionId, eventId);
  if (!submission) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Submission not found' } });

  // Conflict of interest check: judge cannot score their own submission
  if (submission.userId === (req as any).user.id) {
    return res.status(403).json({ error: { code: 'CONFLICT_OF_INTEREST', message: 'Judges cannot score their own submissions.' } });
  }

  db.prepare("INSERT OR REPLACE INTO evaluations (submissionId, judgeId, score, feedback) VALUES (?, ?, ?, ?)").run(submissionId, (req as any).user.id, score, feedback);
  log.info('Submission scored', { submissionId, judgeId: (req as any).user.id, score, eventId });
  res.json({ success: true });
});

// Winners
app.post("/api/events/:id/winners", authenticateToken, (req: any, res) => {
  const { winners } = req.body; // Array of { submissionId, rank, prizeAmount }
  const eventId = req.params.id;

  const event: any = db.prepare("SELECT hostUserId, state FROM events WHERE id = ?").get(eventId);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.hostUserId !== req.user.id) return res.status(403).json({ error: "Only host can set winners" });
  if (event.state !== 'Judging') return res.status(400).json({ error: "Winners can only be set during 'Judging' state" });

  db.transaction(() => {
    db.prepare("DELETE FROM winners WHERE eventId = ?").run(eventId);
    const stmt = db.prepare("INSERT INTO winners (eventId, submissionId, rank, prizeAmount) VALUES (?, ?, ?, ?)");
    for (const w of winners) {
      stmt.run(eventId, w.submissionId, w.rank, w.prizeAmount);
    }
    // Automatically transition to Completed
    db.prepare("UPDATE events SET state = 'Completed' WHERE id = ?").run(eventId);
  })();

  res.json({ success: true, state: 'Completed' });
});


// ─── New Modular Routes (Phase 1) ─────────────────────────────────────────────
// These complement the existing inline routes. Legacy inline routes remain
// until full Phase 1 extraction is complete in subsequent sprints.
// v2 auth routes with refresh tokens + password reset replace the old inline ones.
app.use('/api/auth', authRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/stellar', stellarRouter);

// ─── Global Error Handler (must be LAST middleware before Vite) ────────────────
app.use(errorHandler);

// --- VITE MIDDLEWARE ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
