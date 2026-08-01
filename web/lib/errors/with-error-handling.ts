import { NextResponse } from "next/server";
import { handleApiError } from "./handler";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiHandler = (req: any, context?: any) => Promise<any> | any;

/**
 * Higher-order function to wrap Next.js Route Handlers.
 * Catches unhandled exceptions, AppErrors, and ZodErrors and routes them through the central handleApiError pipeline.
 * Ensures zero-leak 500s and standard ErrorEnvelope responses.
 */
 
export function withErrorHandling(handler: ApiHandler): ApiHandler {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: any, context: any) => {
    try {
      return await handler(req, context);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return handleApiError(error) as NextResponse<any>;
    }
  };
}
