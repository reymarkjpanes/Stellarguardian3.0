export interface PaginationMeta {
  nextCursor?: string;
  hasNext: boolean;
  count: number;
}

export type ApiResponse<T = unknown> = 
  | { success: true; data: T; meta?: PaginationMeta | Record<string, unknown> }
  | { success: false; error: { code: string; message: string; details?: unknown } };

export function successResponse<T>(data: T, meta?: PaginationMeta | Record<string, unknown>): ApiResponse<T> {
  return { success: true, data, meta };
}

export function errorResponse(code: string, message: string, details?: unknown): ApiResponse<never> {
  return { success: false, error: { code, message, details } };
}
