/**
 * server/routes/auth.ts
 * Authentication routes: signup, login, refresh, logout, forgot-password, reset-password.
 * All token-related logic delegates to authService. All emails delegate to emailService.
 */
import { Router } from 'express';
import { z } from 'zod';
import db from '../db/client';
import { authenticate } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import {
  generateAccessToken,
  generateRefreshToken,
  generatePasswordResetToken,
  hashPassword,
  verifyPassword,
  storeRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  storePasswordResetToken,
  validatePasswordResetToken,
  consumePasswordResetToken,
} from '../services/authService';
import { sendEmail } from '../services/emailService';

export const authRouter = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const SignupSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().max(255).trim().toLowerCase(),
  password: z.string().min(8).max(128),
});

const LoginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1),
});

const ForgotSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
});

const ResetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

/** POST /api/auth/signup */
authRouter.post('/signup', (req, res, next) => {
  const result = SignupSchema.safeParse(req.body);
  if (!result.success) throw result.error;

  const { name, email, password } = result.data;
  const hashedPassword = hashPassword(password);

  try {
    const info = db
      .prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)')
      .run(name, email, hashedPassword);

    const userId = Number(info.lastInsertRowid);
    const accessToken = generateAccessToken({ id: userId, email, name });
    const refreshToken = generateRefreshToken();
    storeRefreshToken(userId, refreshToken);

    res.status(201).json({
      data: {
        accessToken,
        refreshToken,
        user: { id: userId, name, email, walletAddress: null, isAdmin: 0 },
      },
    });
  } catch {
    throw new ApiError(409, 'An account with this email already exists.', 'EMAIL_TAKEN');
  }
});

/** POST /api/auth/login */
authRouter.post('/login', (req, res, next) => {
  const result = LoginSchema.safeParse(req.body);
  if (!result.success) throw result.error;

  const { email, password } = result.data;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

  if (!user || !verifyPassword(password, user.password)) {
    throw new ApiError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  if (user.isActive === 0) {
    throw new ApiError(403, 'This account has been deactivated.', 'ACCOUNT_DEACTIVATED');
  }

  const accessToken = generateAccessToken({ id: user.id, email: user.email, name: user.name });
  const refreshToken = generateRefreshToken();
  storeRefreshToken(user.id, refreshToken);

  const { password: _, ...userWithoutPassword } = user;
  res.json({ data: { accessToken, refreshToken, user: userWithoutPassword } });
});

/** POST /api/auth/refresh — Exchange refresh token for new access token */
authRouter.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== 'string') {
    throw new ApiError(400, 'refreshToken is required.', 'MISSING_TOKEN');
  }

  const record = validateRefreshToken(refreshToken);
  if (!record) {
    throw new ApiError(401, 'Invalid or expired refresh token. Please log in again.', 'TOKEN_INVALID');
  }

  const user = db
    .prepare('SELECT id, email, name, isActive FROM users WHERE id = ?')
    .get(record.userId) as any;

  if (!user || user.isActive === 0) {
    throw new ApiError(403, 'Account not found or deactivated.', 'ACCOUNT_INVALID');
  }

  const accessToken = generateAccessToken({ id: user.id, email: user.email, name: user.name });
  res.json({ data: { accessToken } });
});

/** POST /api/auth/logout — Revoke refresh token */
authRouter.post('/logout', authenticate, (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken && typeof refreshToken === 'string') {
    revokeRefreshToken(refreshToken);
  } else {
    // Revoke all tokens for this user as a fallback
    revokeAllUserRefreshTokens(req.user!.id);
  }
  res.json({ data: { success: true } });
});

/** POST /api/auth/forgot-password */
authRouter.post('/forgot-password', async (req, res) => {
  const result = ForgotSchema.safeParse(req.body);
  if (!result.success) throw result.error;

  const { email } = result.data;
  const user = db
    .prepare('SELECT id, name FROM users WHERE email = ?')
    .get(email) as { id: number; name: string } | undefined;

  // Always return success to prevent user enumeration attacks
  if (user) {
    const token = generatePasswordResetToken();
    storePasswordResetToken(user.id, token);

    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    await sendEmail({
      type: 'password_reset',
      to: email,
      name: user.name,
      resetLink: `${appUrl}/reset-password?token=${token}`,
    });
  }

  res.json({ data: { message: 'If an account with that email exists, a password reset link has been sent.' } });
});

/** POST /api/auth/reset-password */
authRouter.post('/reset-password', async (req, res) => {
  const result = ResetSchema.safeParse(req.body);
  if (!result.success) throw result.error;

  const { token, password } = result.data;
  const record = validatePasswordResetToken(token);
  if (!record) {
    throw new ApiError(400, 'This reset link is invalid or has expired.', 'TOKEN_INVALID');
  }

  const hashedPassword = hashPassword(password);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, record.userId);
  consumePasswordResetToken(token);
  revokeAllUserRefreshTokens(record.userId); // Force re-login after password change

  res.json({ data: { message: 'Password updated successfully. Please log in with your new password.' } });
});

/** GET /api/auth/me */
authRouter.get('/me', authenticate, (req, res) => {
  const user = db
    .prepare('SELECT id, name, email, walletAddress, isAdmin FROM users WHERE id = ?')
    .get(req.user!.id);

  if (!user) throw new ApiError(404, 'User not found.', 'NOT_FOUND');
  res.json({ data: { user } });
});
