/**
 * server/services/authService.ts
 * All authentication business logic: token generation, password hashing,
 * refresh token management, password reset tokens.
 * 
 * Design Decision (confirmed):
 * - Access token: 15 minutes (short-lived, in-memory)
 * - Refresh token: 30 days (long-lived, stored in DB, revocable)
 * - PBKDF: bcrypt with 12 rounds
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../db/client';

export const SALT_ROUNDS = 12;
export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const PASSWORD_RESET_TTL_MINUTES = 60;

// ─── Token Generation ─────────────────────────────────────────────────────────

export function generateAccessToken(payload: { id: number; email: string; name: string }): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_TTL });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateEmailVerifyToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ─── Refresh Token Storage ────────────────────────────────────────────────────

export function storeRefreshToken(userId: number, token: string): void {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

  // Create refresh_tokens table if it doesn't exist (migration-safe)
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expiresAt TEXT NOT NULL,
      revokedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.prepare(
    'INSERT INTO refresh_tokens (userId, token, expiresAt) VALUES (?, ?, ?)',
  ).run(userId, token, expiresAt.toISOString());
}

export function validateRefreshToken(token: string): { userId: number } | null {
  const row = db
    .prepare(
      `SELECT userId FROM refresh_tokens
       WHERE token = ?
         AND revokedAt IS NULL
         AND expiresAt > datetime('now')`,
    )
    .get(token) as { userId: number } | undefined;

  return row ?? null;
}

export function revokeRefreshToken(token: string): void {
  db.prepare(
    "UPDATE refresh_tokens SET revokedAt = datetime('now') WHERE token = ?",
  ).run(token);
}

export function revokeAllUserRefreshTokens(userId: number): void {
  db.prepare(
    "UPDATE refresh_tokens SET revokedAt = datetime('now') WHERE userId = ? AND revokedAt IS NULL",
  ).run(userId);
}

// ─── Password Reset ───────────────────────────────────────────────────────────

export function storePasswordResetToken(userId: number, token: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expiresAt TEXT NOT NULL,
      usedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Revoke any existing pending reset tokens for this user
  db.prepare(
    "UPDATE password_reset_tokens SET usedAt = datetime('now') WHERE userId = ? AND usedAt IS NULL",
  ).run(userId);

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + PASSWORD_RESET_TTL_MINUTES);

  db.prepare(
    'INSERT INTO password_reset_tokens (userId, token, expiresAt) VALUES (?, ?, ?)',
  ).run(userId, token, expiresAt.toISOString());
}

export function validatePasswordResetToken(token: string): { userId: number } | null {
  const row = db
    .prepare(
      `SELECT userId FROM password_reset_tokens
       WHERE token = ?
         AND usedAt IS NULL
         AND expiresAt > datetime('now')`,
    )
    .get(token) as { userId: number } | undefined;

  return row ?? null;
}

export function consumePasswordResetToken(token: string): void {
  db.prepare(
    "UPDATE password_reset_tokens SET usedAt = datetime('now') WHERE token = ?",
  ).run(token);
}

// ─── Password Utilities ───────────────────────────────────────────────────────

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}
