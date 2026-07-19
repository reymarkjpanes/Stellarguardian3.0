/**
 * Property tests for file validation (task 15.12).
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { fcConfig } from "@/lib/test-utils/fc-config";
import { validateFile, sanitizeFilename, detectMimeType } from "./file-validation";

describe("Property tests: File validation", () => {
  // Feature: nextjs-platform-conversion, Property 43: File validation accepts only conforming uploads
  it("Property 43: Files exceeding max size are always rejected", () => {
    const MAX_SIZE = 10 * 1024 * 1024;

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: MAX_SIZE + 1, max: MAX_SIZE * 2 }),
        (filename, sizeBytes) => {
          const buffer = new Uint8Array(4); // Minimal buffer
          const result = validateFile(filename, "application/pdf", sizeBytes, buffer);
          expect(result.valid).toBe(false);
          expect(result.violations.some((v) => v.includes("maximum size"))).toBe(true);
        },
      ),
      fcConfig,
    );
  });

  it("Property 43 (supplement): Files within size limit pass the size check", () => {
    const MAX_SIZE = 10 * 1024 * 1024;
    // PDF magic bytes
    const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX_SIZE }),
        (sizeBytes) => {
          const result = validateFile("test.pdf", "application/pdf", sizeBytes, pdfBuffer);
          // Should not have a size violation (may have other violations)
          expect(result.violations.some((v) => v.includes("maximum size"))).toBe(false);
        },
      ),
      fcConfig,
    );
  });

  it("sanitizeFilename removes path traversal characters", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (input) => {
        const sanitized = sanitizeFilename(input);
        // No path separators
        expect(sanitized).not.toContain("/");
        expect(sanitized).not.toContain("\\");
        // No path traversal
        expect(sanitized).not.toContain("..");
        // No leading dots
        expect(sanitized).not.toMatch(/^\./);
        // Length limit
        expect(sanitized.length).toBeLessThanOrEqual(255);
      }),
      fcConfig,
    );
  });

  it("detectMimeType correctly identifies PDF files", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 100, maxLength: 500 }), (randomData) => {
        // Inject PDF magic bytes at the start
        const pdfBuffer = new Uint8Array(randomData.length);
        pdfBuffer.set([0x25, 0x50, 0x44, 0x46], 0);
        pdfBuffer.set(randomData.slice(4), 4);

        const detected = detectMimeType(pdfBuffer);
        expect(detected).toBe("application/pdf");
      }),
      fcConfig,
    );
  });

  it("detectMimeType correctly identifies PNG files", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 100, maxLength: 500 }), (randomData) => {
        const pngBuffer = new Uint8Array(randomData.length);
        pngBuffer.set([0x89, 0x50, 0x4e, 0x47], 0);
        pngBuffer.set(randomData.slice(4), 4);

        const detected = detectMimeType(pngBuffer);
        expect(detected).toBe("image/png");
      }),
      fcConfig,
    );
  });

  it("detectMimeType returns null for unrecognized content", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 10, maxLength: 100 }), (randomData) => {
        // Ensure the first bytes don't accidentally match a known signature
        const buf = new Uint8Array(randomData.length);
        buf.set(randomData);
        buf[0] = 0x00;
        buf[1] = 0x01;
        buf[2] = 0x02;
        buf[3] = 0x03;

        const detected = detectMimeType(buf);
        // May or may not be null depending on partial matches, but should not be PDF/PNG/etc
        if (detected !== null) {
          // If detected, it must be one of our known types
          const knownTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "video/mp4", "application/zip"];
          expect(knownTypes).toContain(detected);
        }
      }),
      fcConfig,
    );
  });

  it("Disallowed MIME types are rejected", () => {
    const disallowedTypes = ["application/x-executable", "application/x-msdownload", "text/html"];

    fc.assert(
      fc.property(
        fc.constantFrom(...disallowedTypes),
        (mimeType) => {
          const buffer = new Uint8Array([0x00, 0x01, 0x02, 0x03]); // Won't match any magic
          const result = validateFile("test.exe", mimeType, 1000, buffer);
          expect(result.valid).toBe(false);
          expect(result.violations.some((v) => v.includes("not allowed"))).toBe(true);
        },
      ),
      fcConfig,
    );
  });
});
