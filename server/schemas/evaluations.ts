/**
 * server/schemas/evaluations.ts
 * Zod validation schemas for evaluation/scoring write endpoints.
 * Note: This replaces the inline ScoreSchema in server.ts.
 */
import { z } from 'zod';

// ─── Score Submission ─────────────────────────────────────────────────────────
export const ScoreSubmissionSchema = z.object({
  score: z.number().int().min(0).max(100),
  feedback: z.string().max(2000).trim().optional(),
});

export type ScoreSubmissionInput = z.infer<typeof ScoreSubmissionSchema>;
