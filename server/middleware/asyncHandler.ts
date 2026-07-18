/**
 * server/middleware/asyncHandler.ts
 * Wraps an async Express route handler so that any rejected promise
 * (thrown error or awaited rejection) is forwarded to next(), and therefore
 * to the central errorHandler.
 *
 * Why this exists:
 * Express 4 does NOT catch errors from async handlers automatically. Without
 * this wrapper, a `throw` or a rejected `await` inside an `async (req, res)`
 * handler produces an unhandled promise rejection and the request hangs until
 * it times out — never reaching errorHandler. This is especially dangerous on
 * the Stellar escrow routes, where a failed SDK call must return a clean error.
 *
 * (Express 5 handles this natively; this wrapper can be removed after upgrading.)
 */
import type { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
