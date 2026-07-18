/**
 * Workspace entity schemas (Req 24).
 * Mirrors the `workspaces` and `workspace_members` tables from design.md.
 */
import { z } from "zod";
import { TimestampSchema, UuidSchema, VersionSchema } from "./common";

export const WorkspaceMemberRoleSchema = z.enum(["Owner", "Admin", "Member"]);
export type WorkspaceMemberRole = z.infer<typeof WorkspaceMemberRoleSchema>;

export const WorkspaceSettingsSchema = z.object({
  timezone: z.string().optional(),
});
export type WorkspaceSettings = z.infer<typeof WorkspaceSettingsSchema>;

export const WorkspaceBillingSchema = z.object({
  email: z.email().optional(),
  methodRef: z.string().optional(),
  plan: z.string().default("free"),
});
export type WorkspaceBilling = z.infer<typeof WorkspaceBillingSchema>;

export const WorkspaceWhiteLabelSchema = z.object({
  domain: z.string().optional(),
  logo: z.string().optional(),
  colors: z.record(z.string(), z.string()).optional(),
  sender: z.string().optional(),
});
export type WorkspaceWhiteLabel = z.infer<typeof WorkspaceWhiteLabelSchema>;

export const WorkspaceSchema = z.object({
  id: UuidSchema,
  slug: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Must be a lowercase, dash-separated slug"),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  logoUrl: z.url().nullable().optional(),
  settings: WorkspaceSettingsSchema.default({}),
  billing: WorkspaceBillingSchema.default({ plan: "free" }),
  whiteLabel: WorkspaceWhiteLabelSchema.default({}),
  featureFlags: z.record(z.string(), z.boolean()).default({}),
  version: VersionSchema,
  createdAt: TimestampSchema,
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const WorkspaceMemberSchema = z.object({
  workspaceId: UuidSchema,
  userId: UuidSchema,
  role: WorkspaceMemberRoleSchema,
});
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;

/** Request body for creating a workspace (Req 24.1). */
export const CreateWorkspaceSchema = z.object({
  slug: WorkspaceSchema.shape.slug,
  name: WorkspaceSchema.shape.name,
  description: z.string().max(2000).optional(),
});
export type CreateWorkspace = z.infer<typeof CreateWorkspaceSchema>;
