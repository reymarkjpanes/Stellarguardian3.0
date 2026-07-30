/**
 * Submission draft/versioning schemas (Req 15, 30).
 * Mirrors the `submissions`, `submission_versions`, and `submission_files`
 * tables from design.md.
 */
import { z } from "zod";
import { TimestampSchema, UuidSchema, VersionSchema } from "./common";

export const SubmissionStatusSchema = z.enum(["Draft", "Submitted", "LOCKED"]);
export type SubmissionStatus = z.infer<typeof SubmissionStatusSchema>;

export const SubmissionFieldsSchema = z.object({
  title: z.string().max(255).optional().nullable(),
  short_description: z.string().max(500).optional().nullable(),
  detailed_description: z.string().optional().nullable(),
  problem_statement: z.string().optional().nullable(),
  solution_overview: z.string().optional().nullable(),
  key_features: z.string().optional().nullable(),
  tech_stack: z.array(z.string()).optional().nullable(),
  github_url: z.string().url().optional().nullable().or(z.literal("")),
  live_demo_url: z.string().url().optional().nullable().or(z.literal("")),
  video_url: z.string().url().optional().nullable().or(z.literal("")),
  presentation_url: z.string().url().optional().nullable().or(z.literal("")),
  documentation_url: z.string().url().optional().nullable().or(z.literal("")),
  api_docs_url: z.string().url().optional().nullable().or(z.literal("")),
  smart_contract_addresses: z.array(z.string()).optional().nullable(),
  blockchain_explorer_url: z.string().url().optional().nullable().or(z.literal("")),
  deployed_network: z.string().max(100).optional().nullable(),
  ai_models_used: z.string().optional().nullable(),
  challenges_faced: z.string().optional().nullable(),
  future_improvements: z.string().optional().nullable(),
  additional_notes: z.string().optional().nullable(),
  screenshots: z.array(z.string()).optional().nullable(),
  categories_entered: z.array(z.string()).optional().nullable(),
});

export const SubmissionSchema = z.object({
  id: UuidSchema,
  eventId: UuidSchema,
  teamId: UuidSchema.nullable().optional(),
  submitterId: UuidSchema,
  status: SubmissionStatusSchema,
  currentVersion: z.int().positive(),
  version: VersionSchema,
  updatedAt: TimestampSchema,
}).merge(SubmissionFieldsSchema);
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

export const SaveSubmissionPayloadSchema = z.object({
  eventId: UuidSchema,
  status: SubmissionStatusSchema.optional().default("Draft"),
}).and(SubmissionFieldsSchema).superRefine((data, ctx) => {
  if (data.status === 'Submitted') {
    if (!data.title || data.title.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Title is required for submission", path: ["title"] });
    }
    if (!data.short_description || data.short_description.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Short description is required for submission", path: ["short_description"] });
    }
    if (!data.github_url || data.github_url.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "GitHub URL is required for submission", path: ["github_url"] });
    }
  }
});
export type SaveSubmissionPayload = z.infer<typeof SaveSubmissionPayloadSchema>;
