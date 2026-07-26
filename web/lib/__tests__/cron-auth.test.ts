/**
 * Tests for cron-auth.ts — cron endpoint authentication.
 *
 * Verifies:
 * 1. Valid Bearer token returns null (allowed)
 * 2. Missing/invalid token returns 401 response
 * 3. Missing CRON_SECRET env returns 500 response
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { verifyCronAuth } from "../cron-auth";

describe("verifyCronAuth", () => {
  const originalEnv = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret-123";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CRON_SECRET = originalEnv;
    } else {
      delete process.env.CRON_SECRET;
    }
  });

  function makeRequest(authHeader?: string): NextRequest {
    const headers = new Headers();
    if (authHeader) headers.set("authorization", authHeader);
    return new NextRequest("http://localhost:3000/api/cron/transitions", {
      method: "POST",
      headers,
    });
  }

  it("returns null when Bearer token matches CRON_SECRET", () => {
    const result = verifyCronAuth(makeRequest("Bearer test-secret-123"));
    expect(result).toBeNull();
  });

  it("returns 401 when no authorization header is provided", async () => {
    const result = verifyCronAuth(makeRequest());
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    const body = await result!.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when token does not match", async () => {
    const result = verifyCronAuth(makeRequest("Bearer wrong-token"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const result = verifyCronAuth(makeRequest("Bearer anything"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(500);
    const body = await result!.json();
    expect(body.error.code).toBe("MISCONFIGURED");
  });
});
