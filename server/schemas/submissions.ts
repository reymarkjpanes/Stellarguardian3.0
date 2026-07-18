/**
 * server/schemas/submissions.ts
 * Zod validation schemas for submission-related write endpoints.
 */
import { z } from 'zod';

// ─── Create Submission ────────────────────────────────────────────────────────
export const CreateSubmissionSchema = z.object({
  title: z.string().min(3).max(200).trim(),
  description: z.string().min(10).max(5000).trim(),
  url: z.string().url().max(2000),
  teamId: z.number().int().positive().nullable().optional(),
});

export type CreateSubmissionInput = z.infer<typeof CreateSubmissionSchema>;

// ─── Update Submission ────────────────────────────────────────────────────────
export const UpdateSubmissionSchema = z.object({
  title: z.string().min(3).max(200).trim(),
  description: z.string().min(10).max(5000).trim(),
  url: z.string().url().max(2000),
});

export type UpdateSubmissionInput = z.infer<typeof UpdateSubmissionSchema>;
