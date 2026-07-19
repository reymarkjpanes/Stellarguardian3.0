/**
 * Property tests for the error handler and response envelope (tasks 5.2, 5.3).
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { fcConfig } from "@/lib/test-utils/fc-config";
import { handleApiError, INTERNAL_SERVER_ERROR_CODE } from "./handler";
import { AppError } from "./app-error";
import {
  BadRequestError,
  UnauthenticatedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  ServiceUnavailableError,
} from "./errors";

/** All concrete AppError subclasses to generate from. */
function arbAppError(): fc.Arbitrary<AppError> {
  return fc.oneof(
    fc.constant(new BadRequestError()),
    fc.constant(new UnauthenticatedError()),
    fc.constant(new ForbiddenError()),
    fc.constant(new NotFoundError()),
    fc.constant(new ConflictError()),
    fc.constant(new ValidationError("test", { field: "value" })),
    fc.constant(new RateLimitError()),
    fc.constant(new ServiceUnavailableError()),
  );
}

describe("Property tests: Error handler and response envelope", () => {
  // Feature: nextjs-platform-conversion, Property 27: Responses use the canonical envelope
  // and status mapping
  it("Property 27: AppError instances produce the canonical envelope at the declared status", async () => {
    fc.assert(
      fc.property(arbAppError(), (error) => {
        const response = handleApiError(error);
        expect(response.status).toBe(error.httpStatus);
      }),
      fcConfig,
    );
  });

  it("Property 27 (supplement): AppError response body has the canonical {error: {code, message}} shape", async () => {
    await fc.assert(
      fc.asyncProperty(arbAppError(), async (error) => {
        const response = handleApiError(error);
        const body = await response.json();

        expect(body).toHaveProperty("error");
        expect(body.error).toHaveProperty("code", error.code);
        expect(body.error).toHaveProperty("message", error.message);
      }),
      fcConfig,
    );
  });

  // Feature: nextjs-platform-conversion, Property 30: Unhandled exceptions yield a leak-free 500
  it("Property 30: Unknown errors produce a 500 with no internal details leaked", async () => {
    const arbUnknownError = fc.oneof(
      fc.string().map((s) => new Error(s)),
      fc.string(), // thrown string
      fc.nat(), // thrown number
      fc.constant(null),
      fc.constant(undefined),
      fc.record({ sensitive: fc.string(), stack: fc.string() }),
    );

    await fc.assert(
      fc.asyncProperty(arbUnknownError, async (error) => {
        const response = handleApiError(error);
        expect(response.status).toBe(500);

        const body = await response.json();
        expect(body.error.code).toBe(INTERNAL_SERVER_ERROR_CODE);
        // The message must NOT contain any sensitive content from the original error
        expect(body.error.message).toBe(
          "An unexpected error occurred. Please try again later.",
        );
        // No details, no stack, no internal info
        expect(body.error.details).toBeUndefined();
      }),
      fcConfig,
    );
  });

  it("ValidationError (422) includes field-level details", async () => {
    const arbFieldErrors = fc.dictionary(fc.string(), fc.array(fc.string()));

    await fc.assert(
      fc.asyncProperty(arbFieldErrors, async (fieldErrors) => {
        const error = new ValidationError("Validation failed", { fieldErrors });
        const response = handleApiError(error);

        expect(response.status).toBe(422);

        const body = await response.json();
        expect(body.error.code).toBe("VALIDATION_FAILED");
        expect(body.error.details).toHaveProperty("fieldErrors");
      }),
      fcConfig,
    );
  });

  it("Status codes are semantically correct for each error class", () => {
    const statusMap: Array<[AppError, number]> = [
      [new BadRequestError(), 400],
      [new UnauthenticatedError(), 401],
      [new ForbiddenError(), 403],
      [new NotFoundError(), 404],
      [new ConflictError(), 409],
      [new ValidationError(), 422],
      [new RateLimitError(), 429],
      [new ServiceUnavailableError(), 503],
    ];

    for (const [error, expectedStatus] of statusMap) {
      expect(error.httpStatus).toBe(expectedStatus);
      const response = handleApiError(error);
      expect(response.status).toBe(expectedStatus);
    }
  });
});
