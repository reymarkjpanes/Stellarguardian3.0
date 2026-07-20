import { z } from "zod";

export interface CursorPaginationParams {
  limit: number;
  cursor?: string;
  sort?: string;
  order?: "asc" | "desc";
  filter?: Record<string, string>;
  search?: string;
}

export const CursorPaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20).optional(),
  cursor: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  filter: z.record(z.string(), z.string()).optional(),
  search: z.string().optional(),
});

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount?: number;
}
