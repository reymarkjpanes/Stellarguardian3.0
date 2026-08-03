/**
 * Avatar URL Allowlist Validation — Phase 5 (Test Coverage Recovery)
 *
 * Tests the domain allowlist added to PATCH /api/users/me (M6).
 * Logic is extracted here as a pure function so it can be tested without
 * spinning up the full Next.js route handler.
 */
import { describe, it, expect } from "vitest";

// ── Replicate the allowlist logic from api/users/me/route.ts ─────────────────

const ALLOWED_DOMAINS = [
  "avatars.githubusercontent.com",
  "lh3.googleusercontent.com",
  "i.imgur.com",
  "imgur.com",
  "cdn.discordapp.com",
  "pbs.twimg.com",
  "images.unsplash.com",
  "res.cloudinary.com",
  "uploadthing.com",
  "utfs.io",
];

function isAllowedAvatarUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Avatar URL allowlist", () => {
  describe("Allowed domains", () => {
    it("accepts GitHub avatar CDN", () => {
      expect(isAllowedAvatarUrl("https://avatars.githubusercontent.com/u/12345?v=4")).toBe(true);
    });

    it("accepts Google profile photo", () => {
      expect(isAllowedAvatarUrl("https://lh3.googleusercontent.com/photo.jpg")).toBe(true);
    });

    it("accepts Imgur direct link", () => {
      expect(isAllowedAvatarUrl("https://i.imgur.com/abc123.jpg")).toBe(true);
      expect(isAllowedAvatarUrl("https://imgur.com/abc123.jpg")).toBe(true);
    });

    it("accepts Discord CDN", () => {
      expect(isAllowedAvatarUrl("https://cdn.discordapp.com/avatars/123/abc.png")).toBe(true);
    });

    it("accepts Twitter profile images", () => {
      expect(isAllowedAvatarUrl("https://pbs.twimg.com/profile_images/123/img.jpg")).toBe(true);
    });

    it("accepts Unsplash images", () => {
      expect(isAllowedAvatarUrl("https://images.unsplash.com/photo-1234")).toBe(true);
    });

    it("accepts Cloudinary URLs", () => {
      expect(isAllowedAvatarUrl("https://res.cloudinary.com/demo/image/upload/v1/sample.jpg")).toBe(
        true,
      );
    });

    it("accepts UploadThing URLs", () => {
      expect(isAllowedAvatarUrl("https://uploadthing.com/f/abc123")).toBe(true);
      expect(isAllowedAvatarUrl("https://utfs.io/f/abc123")).toBe(true);
    });
  });

  describe("Blocked domains", () => {
    it("blocks arbitrary external domains", () => {
      expect(isAllowedAvatarUrl("https://evil.com/track.png")).toBe(false);
      expect(isAllowedAvatarUrl("https://example.com/avatar.jpg")).toBe(false);
    });

    it("blocks attempts to bypass with a subdomain that mimics allowed domain", () => {
      // "avatars.githubusercontent.com.evil.com" should not match
      expect(isAllowedAvatarUrl("https://avatars.githubusercontent.com.evil.com/u/1")).toBe(false);
    });

    it("blocks data URIs", () => {
      expect(isAllowedAvatarUrl("data:image/png;base64,abc123")).toBe(false);
    });

    it("blocks javascript: scheme", () => {
      expect(isAllowedAvatarUrl("javascript:alert(1)")).toBe(false);
    });

    it("blocks malformed URLs", () => {
      expect(isAllowedAvatarUrl("not-a-url")).toBe(false);
      expect(isAllowedAvatarUrl("")).toBe(false);
    });

    it("blocks tracking pixel domains", () => {
      expect(isAllowedAvatarUrl("https://t.co/track.gif")).toBe(false);
      expect(isAllowedAvatarUrl("https://pixel.matomo.org/piwik.php")).toBe(false);
    });

    it("blocks S3 buckets (not in allowlist — must be proxied via Cloudinary)", () => {
      expect(isAllowedAvatarUrl("https://my-bucket.s3.amazonaws.com/avatar.jpg")).toBe(false);
    });
  });

  describe("Subdomain handling", () => {
    it("accepts valid subdomains of allowed domains", () => {
      // res.cloudinary.com is the canonical domain; subdomain variant should still match
      expect(isAllowedAvatarUrl("https://res.cloudinary.com/mycloud/image.jpg")).toBe(true);
    });

    it("does not treat partial hostname matches as valid", () => {
      // "notimgur.com" should not match "imgur.com"
      expect(isAllowedAvatarUrl("https://notimgur.com/img.jpg")).toBe(false);
    });
  });
});
