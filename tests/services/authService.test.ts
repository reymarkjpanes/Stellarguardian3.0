/**
 * tests/services/authService.test.ts
 * Unit tests for all authService functions.
 * Uses in-memory SQLite via DB_PATH=:memory: (set in tests/setup.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  generatePasswordResetToken,
  SALT_ROUNDS,
  ACCESS_TOKEN_TTL,
} from '../../server/services/authService';
import jwt from 'jsonwebtoken';

describe('authService', () => {
  describe('hashPassword / verifyPassword', () => {
    it('produces a bcrypt hash', () => {
      const hash = hashPassword('hunter2');
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('verifies the correct password', () => {
      const hash = hashPassword('correct-horse-battery-staple');
      expect(verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
    });

    it('rejects wrong password', () => {
      const hash = hashPassword('correct');
      expect(verifyPassword('wrong', hash)).toBe(false);
    });

    it('uses at least 10 salt rounds', () => {
      // SALT_ROUNDS is 12 in production — anything below 10 is a security risk
      expect(SALT_ROUNDS).toBeGreaterThanOrEqual(10);
    });
  });

  describe('generateAccessToken', () => {
    it('produces a verifiable JWT with correct payload', () => {
      const payload = { id: 42, email: 'test@example.com', name: 'Test User' };
      const token = generateAccessToken(payload);

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      expect(decoded.id).toBe(42);
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.name).toBe('Test User');
    });

    it('expires within 16 minutes (15min access token)', () => {
      const payload = { id: 1, email: 'x@x.com', name: 'X' };
      const token = generateAccessToken(payload);
      const decoded = jwt.decode(token) as any;

      const expiresIn = decoded.exp - decoded.iat;
      // 15 minutes = 900 seconds. Allow up to 960 (16 min) for clock skew.
      expect(expiresIn).toBeLessThanOrEqual(960);
      expect(expiresIn).toBeGreaterThan(800);
    });
  });

  describe('generateRefreshToken', () => {
    it('is 128 hex characters (64 bytes of entropy)', () => {
      const token = generateRefreshToken();
      expect(token).toMatch(/^[a-f0-9]{128}$/);
    });

    it('generates unique tokens', () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateRefreshToken()));
      expect(tokens.size).toBe(100);
    });
  });

  describe('generatePasswordResetToken', () => {
    it('is 64 hex characters (32 bytes of entropy)', () => {
      const token = generatePasswordResetToken();
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
