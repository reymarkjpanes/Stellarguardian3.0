/**
 * tests/middleware/errorHandler.test.ts
 * Unit tests for the centralized error handler.
 */
import { describe, it, expect, vi } from 'vitest';
import { ApiError, errorHandler } from '../../server/middleware/errorHandler';
import { ZodError, z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

function mockRes() {
  const res: any = {
    statusCode: 200,
  };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

const req = { path: '/test', method: 'GET' } as Request;
const next = vi.fn() as NextFunction;

describe('errorHandler', () => {
  it('handles ApiError with correct status and code', () => {
    const err = new ApiError(404, 'Not found.', 'NOT_FOUND');
    const res = mockRes();
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'Not found.' },
    });
  });

  it('handles ZodError with 422 and VALIDATION_ERROR code', () => {
    let zodError: ZodError | null = null;
    try {
      z.object({ email: z.string().email() }).parse({ email: 'not-an-email' });
    } catch (e) {
      zodError = e as ZodError;
    }

    const res = mockRes();
    errorHandler(zodError!, req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    const call = (res.json as any).mock.calls[0][0];
    expect(call.error.code).toBe('VALIDATION_ERROR');
  });

  it('handles CORS error with 403', () => {
    const corsErr = new Error('Not allowed by CORS');
    const res = mockRes();
    errorHandler(corsErr, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    const call = (res.json as any).mock.calls[0][0];
    expect(call.error.code).toBe('CORS_ERROR');
  });

  it('handles unknown errors with 500 INTERNAL_ERROR', () => {
    const err = new Error('Something completely unexpected');
    const res = mockRes();
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const call = (res.json as any).mock.calls[0][0];
    expect(call.error.code).toBe('INTERNAL_ERROR');
    // Must NOT expose internal error message to client
    expect(call.error.message).not.toContain('completely unexpected');
  });
});
