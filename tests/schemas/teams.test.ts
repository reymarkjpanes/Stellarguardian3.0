/**
 * tests/schemas/teams.test.ts
 * Unit tests for team validation schemas.
 */
import { describe, it, expect } from 'vitest';
import { CreateTeamSchema } from '../../server/schemas/teams';

describe('CreateTeamSchema', () => {
  it('accepts valid team name', () => {
    const result = CreateTeamSchema.safeParse({ name: 'Team Alpha' });
    expect(result.success).toBe(true);
  });

  it('trims whitespace', () => {
    const result = CreateTeamSchema.safeParse({ name: '  Team Beta  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Team Beta');
    }
  });

  it('rejects name shorter than 2 characters', () => {
    const result = CreateTeamSchema.safeParse({ name: 'A' });
    expect(result.success).toBe(false);
  });

  it('rejects name longer than 100 characters', () => {
    const result = CreateTeamSchema.safeParse({ name: 'x'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = CreateTeamSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-string name', () => {
    const result = CreateTeamSchema.safeParse({ name: 123 });
    expect(result.success).toBe(false);
  });
});
