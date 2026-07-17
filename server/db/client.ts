/**
 * server/db/client.ts
 * Single SQLite connection. Use this everywhere — never instantiate Database directly.
 * WAL mode is always on for concurrent reads.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'database.sqlite');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
