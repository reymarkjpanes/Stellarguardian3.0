/**
 * Tests for rate-limit.ts — tier resolution logic.
 *
 * Verifies:
 * 1. Correct tier assignment for all endpoint patterns
 * 2. Health checks bypass rate limiting
 * 3. Financial endpoints get the strictest tier
 * 4. Unauthenticated API calls get "public" tier
 */
import { describe, it, expect } from "vitest";
import { resolveRateLimitTier } from "../rate-limit";

describe("resolveRateLimitTier", () => {
  describe("bypass (returns null)", () => {
    it("bypasses health check endpoints", () => {
      expect(resolveRateLimitTier("/api/health", "GET", false)).toBeNull();
      expect(resolveRateLimitTier("/api/health/ready", "GET", false)).toBeNull();
    });

    it("bypasses page navigations", () => {
      expect(resolveRateLimitTier("/dashboard", "GET", true)).toBeNull();
      expect(resolveRateLimitTier("/events/123", "GET", true)).toBeNull();
      expect(resolveRateLimitTier("/", "GET", false)).toBeNull();
    });
  });

  describe("auth tier", () => {
    it("assigns auth tier to /api/auth/* routes", () => {
      expect(resolveRateLimitTier("/api/auth/wallet/challenge", "POST", false)).toBe("auth");
      expect(resolveRateLimitTier("/api/auth/wallet/verify", "POST", false)).toBe("auth");
      expect(resolveRateLimitTier("/api/auth/reset-password", "POST", false)).toBe("auth");
    });

    it("assigns auth tier to login/signup pages", () => {
      expect(resolveRateLimitTier("/login", "GET", false)).toBe("auth");
      expect(resolveRateLimitTier("/signup", "GET", false)).toBe("auth");
    });
  });

  describe("financial tier", () => {
    it("assigns financial tier to disburse endpoint", () => {
      expect(resolveRateLimitTier("/api/events/abc-123/disburse", "POST", true)).toBe("financial");
    });

    it("assigns financial tier to fund endpoint", () => {
      expect(resolveRateLimitTier("/api/events/abc-123/fund", "POST", true)).toBe("financial");
    });

    it("assigns financial tier to refund endpoint", () => {
      expect(resolveRateLimitTier("/api/events/abc-123/refund", "POST", true)).toBe("financial");
    });
  });

  describe("write tier", () => {
    it("assigns write tier to POST on non-financial API endpoints", () => {
      expect(resolveRateLimitTier("/api/events", "POST", true)).toBe("write");
    });

    it("assigns write tier to PATCH requests", () => {
      expect(resolveRateLimitTier("/api/events/123", "PATCH", true)).toBe("write");
    });

    it("assigns write tier to DELETE requests", () => {
      expect(resolveRateLimitTier("/api/wallets/123", "DELETE", true)).toBe("write");
    });
  });

  describe("read tier", () => {
    it("assigns read tier to authenticated GET on API endpoints", () => {
      expect(resolveRateLimitTier("/api/events", "GET", true)).toBe("read");
      expect(resolveRateLimitTier("/api/notifications", "GET", true)).toBe("read");
    });
  });

  describe("public tier", () => {
    it("assigns public tier to unauthenticated GET on API endpoints", () => {
      expect(resolveRateLimitTier("/api/events", "GET", false)).toBe("public");
      expect(resolveRateLimitTier("/api/events/123/verify-escrow", "GET", false)).toBe("public");
    });
  });
});
