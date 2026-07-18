/**
 * Judging/evaluation schemas (Req 11).
 * Mirrors the `evaluations` table from design.md.
 */
import { z } from "zod";
import { TimestampSchema, UuidSchema } from "./common";

export const EvaluationSchema = z.object({
  id: UuidSchema,
  submissionId: UuidSchema,
  judgeId: UuidSchema,
  scores: z.record(z.string(), z.number()),
  /** Excluded from averages when true (Req 11.4). */
  conflictOfInterest: z.boolean().default(false),
  createdAt: TimestampSchema,
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

/** Request body for submitting a judging score (Req 11.1). */
export const CreateEvaluationSchema = z.object({
  submissionId: UuidSchema,
  scores: z.record(z.string(), z.number()),
});
export type CreateEvaluation = z.infer<typeof CreateEvaluationSchema>;
