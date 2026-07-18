/**
 * Submission draft/versioning schemas (Req 15, 30).
 * Mirrors the `submissions`, `submission_versions`, and `submission_files`
 * tables from design.md.
 */
import { z } from "zod";
import { TimestampSchema, UuidSchema, VersionSchema } from "./common";

export const SubmissionStatusSchema = z.enum(["Draft", "Submitted"]);
export type SubmissionStatus = z.infer<typeof SubmissionStatusSchema>;

export const SubmissionSchema = z.object({
  id: UuidSchema,
  eventId: UuidSchema,
  teamId: UuidSchema.nullable().optional(),
  submitterId: UuidSchema,
  status: SubmissionStatusSchema,
  currentVersion: z.int().positive(),
  version: VersionSchema,
  updatedAt: TimestampSchema,
});
export type Submission = z.infer<typeof SubmissionSchema>;

/** Append-only version history entry (Req 30.2, 30.8). */
export const SubmissionVersionSchema = z.object({
  id: UuidSchema,
  submissionId: UuidSchema,
  versionNo: z.int().positive(),
  content: z.record(z.string(), z.unknown()),
  diffSummary: z.record(z.string(), z.unknown()),
  actorId: UuidSchema,
  createdAt: TimestampSchema,
});
export type SubmissionVersion = z.infer<typeof SubmissionVersionSchema>;

export const SubmissionFileSchema = z.object({
  id: UuidSchema,
  submissionId: UuidSchema,
  storagePath: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.int().nonnegative(),
  sanitizedFilename: z.string().min(1),
});
export type SubmissionFile = z.infer<typeof SubmissionFileSchema>;

/** Request body for creating/updating a submission draft (Req 15.2, 15.3). */
export const UpsertSubmissionSchema = z.object({
  eventId: UuidSchema,
  teamId: UuidSchema.optional(),
  content: z.record(z.string(), z.unknown()),
});
export type UpsertSubmission = z.infer<typeof UpsertSubmissionSchema>;
