/**
 * tests/schemas/evaluations.test.ts
 * Unit tests for evaluation/scoring validation schemas.
 */
import { describe, it, expect } from 'vitest';
import { ScoreSubmissionSchema } from '../../server/schemas/evaluations';

describe('ScoreSubmissionSchema', () => {
  it('accepts valid score with feedback', () => {
    const result = ScoreSubmissionSchema.safeParse({ score: 85, feedback: 'Great work!' });
    expect(result.success).toBe(true);
  });

  it('accepts score without feedback', () => {
    const result = ScoreSubmissionSchema.safeParse({ score: 50 });
    expect(result.success).toBe(true);
  });

  it('accepts minimum score (0)', () => {
    const result = ScoreSubmissionSchema.safeParse({ score: 0 });
    expect(result.success).toBe(true);
  });

  it('accepts maximum score (100)', () => {
    const result = ScoreSubmissionSchema.safeParse({ score: 100 });
    expect(result.success).toBe(true);
  });

  it('rejects score below 0', () => {
    const result = ScoreSubmissionSchema.safeParse({ score: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects score above 100', () => {
    const result = ScoreSubmissionSchema.safeParse({ score: 101 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer score', () => {
    const result = ScoreSubmissionSchema.safeParse({ score: 85.5 });
    expect(result.success).toBe(false);
  });

  it('rejects missing score', () => {
    const result = ScoreSubmissionSchema.safeParse({ feedback: 'Nice' });
    expect(result.success).toBe(false);
  });

  it('rejects feedback longer than 2000 characters', () => {
    const result = ScoreSubmissionSchema.safeParse({
      score: 90,
      feedback: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it('trims feedback whitespace', () => {
    const result = ScoreSubmissionSchema.safeParse({
      score: 75,
      feedback: '  Good effort  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.feedback).toBe('Good effort');
    }
  });
});
