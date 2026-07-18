/**
 * server/schemas/invitations.ts
 * Zod validation schemas for invitation-related write endpoints.
 * Note: This replaces the inline InviteSchema in server.ts.
 */
import { z } from 'zod';

// ─── Send Invites ─────────────────────────────────────────────────────────────
export const SendInviteSchema = z.object({
  eventId: z.number().int().positive(),
  emails: z.array(z.string().email()).min(1).max(50),
  role: z.enum(['Participant', 'Judge', 'Mentor']),
  message: z.string().max(1000).trim().optional(),
});

export type SendInviteInput = z.infer<typeof SendInviteSchema>;
