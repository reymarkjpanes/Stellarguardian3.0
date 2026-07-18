/**
 * server/middleware/validate.ts
 * Reusable validation middleware factory.
 * Accepts a Zod schema and validates req.body against it.
 * On failure, throws the ZodError which is caught by the global errorHandler
 * and returned as a structured 422 response.
 *
 * Usage:
 *   import { validate } from '../middleware/validate';
 *   import { CreateEventSchema } from '../schemas/events';
 *   app.post('/api/events', authenticate, validate(CreateEventSchema), handler);
 */
import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';

/**
 * Creates Express middleware that validates req.body against the given Zod schema.
 * On success, replaces req.body with the parsed (type-safe, coerced, trimmed) data.
 * On failure, throws ZodError (caught by errorHandler → 422 VALIDATION_ERROR).
 */
export function validate<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw result.error;
    }
    // Replace req.body with the validated + transformed data
    req.body = result.data;
    next();
  };
}
