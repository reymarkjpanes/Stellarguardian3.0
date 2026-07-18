/**
 * server/schemas/teams.ts
 * Zod validation schemas for team-related write endpoints.
 */
import { z } from 'zod';

// ─── Create Team ──────────────────────────────────────────────────────────────
export const CreateTeamSchema = z.object({
  name: z.string().min(2).max(100).trim(),
});

export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;
