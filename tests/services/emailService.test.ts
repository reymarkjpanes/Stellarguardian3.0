/**
 * tests/services/emailService.test.ts
 * Unit tests for emailService template rendering.
 * In NODE_ENV=test, emails are mocked (no real sends).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock resend before importing emailService
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    },
  })),
}));

// Import after mock
const { sendEmail } = await import('../../server/services/emailService');

describe('emailService', () => {
  it('does not throw in test/development mode', async () => {
    // NODE_ENV=test — email is logged, not sent
    await expect(
      sendEmail({
        type: 'invite',
        to: 'user@example.com',
        eventTitle: 'Test Hackathon',
        role: 'Participant',
        inviteLink: 'https://example.com/invite/abc',
      }),
    ).resolves.not.toThrow();
  });

  it('handles password_reset email type', async () => {
    await expect(
      sendEmail({
        type: 'password_reset',
        to: 'user@example.com',
        name: 'Alice',
        resetLink: 'https://example.com/reset?token=xyz',
      }),
    ).resolves.not.toThrow();
  });

  it('handles winner_announced email type', async () => {
    await expect(
      sendEmail({
        type: 'winner_announced',
        to: 'winner@example.com',
        name: 'Bob',
        eventTitle: 'Stellar Hackathon',
        place: '1st',
        prizeAmount: '500',
        txHash: 'abcd1234',
      }),
    ).resolves.not.toThrow();
  });

  it('handles event_cancelled email type', async () => {
    await expect(
      sendEmail({
        type: 'event_cancelled',
        to: 'member@example.com',
        name: 'Carol',
        eventTitle: 'Cancelled Event',
      }),
    ).resolves.not.toThrow();
  });
});
