/**
 * File Validation, Malware Scanning, and Upload Pipeline (Req 30.4-30.7, 36.1, 36.4).
 *
 * Validates uploads by content-inspected MIME type, per-file and total size
 * limits, and filename sanitization. Rejects with 422 identifying the violated rule.
 */
import "server-only";

import { ValidationError } from "@/lib/errors";

/** Maximum file size per upload (10 MB default). */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Maximum total upload size per submission (50 MB default). */
const MAX_TOTAL_SIZE_BYTES = 50 * 1024 * 1024;

/** Allowed MIME types (Req 30.4). */
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "text/plain",
  "text/markdown",
  "application/zip",
  "application/x-zip-compressed",
]);

/** Magic byte signatures for content-type inspection (Req 30.5). */
const MAGIC_BYTES: Array<{ mimeType: string; signature: number[] }> = [
  { mimeType: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mimeType: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  { mimeType: "image/png", signature: [0x89, 0x50, 0x4e, 0x47] },
  { mimeType: "image/gif", signature: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { mimeType: "video/mp4", signature: [0x00, 0x00, 0x00] }, // ftyp at offset 4
  { mimeType: "application/zip", signature: [0x50, 0x4b, 0x03, 0x04] },
];

/**
 * Sanitize a filename (Req 30.6).
 * Removes path traversal, special characters, and normalizes.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\]/g, "_") // Remove path separators
    .replace(/\.\./g, "_") // Remove path traversal
    .replace(/[<>:"|?*\x00-\x1f]/g, "_") // Remove special chars
    .replace(/^\.+/, "") // Remove leading dots
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .slice(0, 255); // Limit length
}

/**
 * Detect MIME type from file content (magic bytes) (Req 30.5).
 */
export function detectMimeType(buffer: Uint8Array): string | null {
  for (const { mimeType, signature } of MAGIC_BYTES) {
    if (signature.every((byte, i) => buffer[i] === byte)) {
      return mimeType;
    }
  }
  return null;
}

export interface FileValidationResult {
  valid: boolean;
  sanitizedFilename: string;
  detectedMimeType: string | null;
  violations: string[];
}

/**
 * Validate a file upload (Req 30.4-30.6, 36.4).
 */
export function validateFile(
  filename: string,
  declaredMimeType: string,
  sizeBytes: number,
  contentBuffer: Uint8Array,
  allowedTypes?: Set<string>,
): FileValidationResult {
  const violations: string[] = [];
  const sanitized = sanitizeFilename(filename);
  const detected = detectMimeType(contentBuffer);
  const allowed = allowedTypes ?? ALLOWED_MIME_TYPES;

  // Size check (Req 30.4)
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    violations.push(`File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`);
  }

  // MIME type check — content-inspected (Req 30.5)
  if (detected && !allowed.has(detected)) {
    violations.push(`Detected file type '${detected}' is not allowed.`);
  } else if (!detected && !allowed.has(declaredMimeType)) {
    violations.push(`Declared file type '${declaredMimeType}' is not allowed.`);
  }

  // Filename check
  if (sanitized.length === 0) {
    violations.push("Filename is invalid after sanitization.");
  }

  return {
    valid: violations.length === 0,
    sanitizedFilename: sanitized,
    detectedMimeType: detected,
    violations,
  };
}

/**
 * Validate total upload size for a submission (Req 30.4).
 */
export function validateTotalUploadSize(
  existingTotalBytes: number,
  newFileBytes: number,
): void {
  if (existingTotalBytes + newFileBytes > MAX_TOTAL_SIZE_BYTES) {
    throw new ValidationError(
      `Total upload size would exceed the maximum of ${MAX_TOTAL_SIZE_BYTES / 1024 / 1024} MB.`,
      {
        existingTotal: existingTotalBytes,
        newFileSize: newFileBytes,
        maxTotal: MAX_TOTAL_SIZE_BYTES,
      },
    );
  }
}

/**
 * Scan for malware (Req 36.1). Placeholder that would integrate with a
 * scanning service (ClamAV, VirusTotal, etc.) in production.
 */
export async function scanForMalware(
  _buffer: Uint8Array,
  _filename: string,
): Promise<{ clean: boolean; threat?: string }> {
  // TODO: Integrate actual malware scanning service
  // For now, all files pass
  return { clean: true };
}
