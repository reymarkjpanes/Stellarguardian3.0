import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "./handler";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiHandler<T = any> = (
  req: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
) => Promise<NextResponse<T>> | NextResponse<T>;

/**
 * Higher-order function to wrap Next.js Route Handlers.
 * Catches unhandled exceptions, AppErrors, and ZodErrors and routes them through the central handleApiError pipeline.
 * Ensures zero-leak 500s and standard ErrorEnvelope responses.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withErrorHandling<T = any>(handler: ApiHandler<T>): ApiHandler<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: NextRequest, context: any) => {
    try {
      return await handler(req, context);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return handleApiError(error) as NextResponse<any>;
    }
  };
}
