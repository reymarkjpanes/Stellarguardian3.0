import { z } from "zod";

export const CreateTeamSchema = z.object({
  name: z.string().min(3).max(50),
  maxMembers: z.number().int().min(2).max(10),
  visibility: z.enum(["Public", "Private", "InviteOnly"])
});

export const UpdateTeamSchema = z.object({
  visibility: z.enum(["Public", "Private", "InviteOnly"]).optional(),
  status: z.enum(["Draft", "Recruiting", "Ready", "Locked"]).optional()
});

export const CursorPaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  search: z.string().optional(),
});
