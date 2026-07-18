/**
 * tests/middleware/validate.test.ts
 * Unit tests for the validate middleware factory.
 */
import { describe, it, expect, vi } from 'vitest';
import { validate } from '../../server/middleware/validate';
import { z, ZodError } from 'zod';
import type { Request, Response, NextFunction } from 'express';

const TestSchema = z.object({
  name: z.string().min(2).max(50),
  age: z.number().int().min(0),
});

function mockReq(body: unknown): Request {
  return { body } as Request;
}

function mockRes(): Response {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('validate middleware', () => {
  it('calls next() and replaces req.body on valid input', () => {
    const req = mockReq({ name: 'Alice', age: 30 });
    const res = mockRes();
    const next = vi.fn();

    validate(TestSchema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(); // no error argument
    expect(req.body).toEqual({ name: 'Alice', age: 30 });
  });

  it('throws ZodError on invalid input (caught by global errorHandler)', () => {
    const req = mockReq({ name: 'A', age: -5 });
    const res = mockRes();
    const next = vi.fn();

    expect(() => validate(TestSchema)(req, res, next)).toThrow(ZodError);
    expect(next).not.toHaveBeenCalled();
  });

  it('throws ZodError when body is missing required fields', () => {
    const req = mockReq({});
    const res = mockRes();
    const next = vi.fn();

    expect(() => validate(TestSchema)(req, res, next)).toThrow(ZodError);
  });

  it('throws ZodError when body is null', () => {
    const req = mockReq(null);
    const res = mockRes();
    const next = vi.fn();

    expect(() => validate(TestSchema)(req, res, next)).toThrow(ZodError);
  });

  it('strips extra fields not in schema', () => {
    const req = mockReq({ name: 'Bob', age: 25, extraField: 'should be stripped' });
    const res = mockRes();
    const next = vi.fn();

    validate(TestSchema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    // Zod strips unknown keys by default in objects
    expect(req.body).toEqual({ name: 'Bob', age: 25 });
  });

  it('applies Zod transforms (e.g. trim)', () => {
    const TrimSchema = z.object({ name: z.string().trim() });
    const req = mockReq({ name: '  padded  ' });
    const res = mockRes();
    const next = vi.fn();

    validate(TrimSchema)(req, res, next);

    expect(req.body.name).toBe('padded');
  });
});
