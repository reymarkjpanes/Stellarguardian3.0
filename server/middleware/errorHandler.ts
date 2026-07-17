/**
 * server/middleware/errorHandler.ts
 * Central error handling middleware. All unhandled errors flow through here.
 * Never exposes stack traces or internal details to the client in production.
 */
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = 'API_ERROR',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  // Known API errors (thrown intentionally)
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data.',
        details: err.flatten(),
      },
    });
  }

  // CORS errors
  if (err instanceof Error && err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: { code: 'CORS_ERROR', message: 'Origin not allowed.' },
    });
  }

  // Unknown / unexpected errors — log fully, never expose internals
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(
    JSON.stringify({
      level: 'error',
      msg: 'Unhandled server error',
      path: req.path,
      method: req.method,
      error: message,
      stack,
      ts: new Date().toISOString(),
    }),
  );

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
    },
  });
}
