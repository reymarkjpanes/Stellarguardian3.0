import { z } from "zod";

export const CreateEventSchema = z.object({
  workspace_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  category: z.string().min(1),
  format: z.string().min(1),
  tags: z.array(z.string()).default([]),
  team_size_min: z.number().int().min(1).default(1),
  team_size_max: z.number().int().min(1).default(5),
  registration_deadline: z.string().datetime().optional(),
  prize_pool_target: z.number().min(0).optional(),
  network_mode: z.enum(["testnet", "mainnet"]).default("testnet"),
  review_window_hours: z.number().int().min(24).max(168).default(72),
  prize_split_policy: z
    .enum(["captain_receives", "equal_split", "custom"])
    .default("captain_receives"),
  resubmission_policy: z.object({ allowed: z.boolean() }).default({ allowed: true }),
  file_policy: z
    .object({ allowedMimeTypes: z.array(z.string()) })
    .default({ allowedMimeTypes: [] }),
});

export type CreateEventDTO = z.infer<typeof CreateEventSchema>;

export type EventResponseDTO = {
  id: string;
  workspace_id: string;
  organizer_id: string;
  title: string;
  state: string;
  created_at: string;
};
