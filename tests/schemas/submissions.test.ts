/**
 * tests/schemas/submissions.test.ts
 * Unit tests for submission validation schemas.
 */
import { describe, it, expect } from 'vitest';
import { CreateSubmissionSchema, UpdateSubmissionSchema } from '../../server/schemas/submissions';

describe('CreateSubmissionSchema', () => {
  const validSubmission = {
    title: 'DeFi Payment Gateway',
    description: 'A gateway that enables payments via Stellar anchors.',
    url: 'https://github.com/team/project',
    teamId: 5,
  };

  it('accepts valid complete submission', () => {
    const result = CreateSubmissionSchema.safeParse(validSubmission);
    expect(result.success).toBe(true);
  });

  it('accepts submission without teamId', () => {
    const { teamId, ...rest } = validSubmission;
    const result = CreateSubmissionSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it('accepts null teamId (solo submission)', () => {
    const result = CreateSubmissionSchema.safeParse({ ...validSubmission, teamId: null });
    expect(result.success).toBe(true);
  });

  it('rejects title shorter than 3 characters', () => {
    const result = CreateSubmissionSchema.safeParse({ ...validSubmission, title: 'ab' });
    expect(result.success).toBe(false);
  });

  it('rejects description shorter than 10 characters', () => {
    const result = CreateSubmissionSchema.safeParse({ ...validSubmission, description: 'short' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid url', () => {
    const result = CreateSubmissionSchema.safeParse({ ...validSubmission, url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive teamId', () => {
    const result = CreateSubmissionSchema.safeParse({ ...validSubmission, teamId: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer teamId', () => {
    const result = CreateSubmissionSchema.safeParse({ ...validSubmission, teamId: 1.5 });
    expect(result.success).toBe(false);
  });
});

describe('UpdateSubmissionSchema', () => {
  const validUpdate = {
    title: 'Updated Title Here',
    description: 'Updated description with enough detail.',
    url: 'https://github.com/team/project-v2',
  };

  it('accepts valid update', () => {
    const result = UpdateSubmissionSchema.safeParse(validUpdate);
    expect(result.success).toBe(true);
  });

  it('rejects missing title', () => {
    const { title, ...rest } = validUpdate;
    const result = UpdateSubmissionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing description', () => {
    const { description, ...rest } = validUpdate;
    const result = UpdateSubmissionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid url', () => {
    const result = UpdateSubmissionSchema.safeParse({ ...validUpdate, url: 'not-a-valid-url' });
    expect(result.success).toBe(false);
  });
});
