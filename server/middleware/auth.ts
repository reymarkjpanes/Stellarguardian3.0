/**
 * server/middleware/auth.ts
 * Authentication middleware factory.
 * Uses JWT verification with the JWT_SECRET from environment.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from './errorHandler';

export interface AuthenticatedUser {
  id: number;
  email: string;
  name: string;
}

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware: Requires a valid Bearer JWT in the Authorization header.
 * Sets req.user on success. Throws 401 if missing, 403 if invalid.
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return next(new ApiError(401, 'Authentication required. Please log in.', 'UNAUTHENTICATED'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new ApiError(401, 'Your session has expired. Please log in again.', 'TOKEN_EXPIRED'));
    }
    return next(new ApiError(403, 'Invalid authentication token.', 'TOKEN_INVALID'));
  }
}

/**
 * Middleware: Requires that the authenticated user is the host of the event
 * identified by req.params.id. Must be used AFTER authenticate().
 * 
 * Usage: router.post('/events/:id/publish', authenticate, requireHost(db), handler)
 */
export function requireHost(db: import('better-sqlite3').Database) {
  return (req: Request, res: Response, next: NextFunction) => {
    const event = db
      .prepare('SELECT hostUserId FROM events WHERE id = ?')
      .get(req.params.id) as { hostUserId: number } | undefined;

    if (!event) {
      return next(new ApiError(404, 'Event not found.', 'NOT_FOUND'));
    }
    if (event.hostUserId !== req.user!.id) {
      return next(new ApiError(403, 'Only the event host can perform this action.', 'FORBIDDEN'));
    }
    next();
  };
}
