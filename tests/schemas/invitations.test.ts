/**
 * tests/schemas/invitations.test.ts
 * Unit tests for invitation validation schemas.
 */
import { describe, it, expect } from 'vitest';
import { SendInviteSchema } from '../../server/schemas/invitations';

describe('SendInviteSchema', () => {
  const validInvite = {
    eventId: 1,
    emails: ['judge@example.com', 'participant@example.com'],
    role: 'Judge' as const,
    message: 'Please join our event!',
  };

  it('accepts valid invite', () => {
    const result = SendInviteSchema.safeParse(validInvite);
    expect(result.success).toBe(true);
  });

  it('accepts invite without message', () => {
    const { message, ...rest } = validInvite;
    const result = SendInviteSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it('accepts all valid roles', () => {
    for (const role of ['Participant', 'Judge', 'Mentor']) {
      const result = SendInviteSchema.safeParse({ ...validInvite, role });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid role', () => {
    const result = SendInviteSchema.safeParse({ ...validInvite, role: 'Admin' });
    expect(result.success).toBe(false);
  });

  it('rejects empty emails array', () => {
    const result = SendInviteSchema.safeParse({ ...validInvite, emails: [] });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email in array', () => {
    const result = SendInviteSchema.safeParse({
      ...validInvite,
      emails: ['valid@example.com', 'not-an-email'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 50 emails', () => {
    const emails = Array.from({ length: 51 }, (_, i) => `user${i}@example.com`);
    const result = SendInviteSchema.safeParse({ ...validInvite, emails });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive eventId', () => {
    const result = SendInviteSchema.safeParse({ ...validInvite, eventId: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects message longer than 1000 characters', () => {
    const result = SendInviteSchema.safeParse({
      ...validInvite,
      message: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});
