import { z } from "zod";
import { describe, expect, test, vi } from "vitest";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  handleApiError,
  INTERNAL_SERVER_ERROR_CODE,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  UnauthenticatedError,
  ValidationError,
} from "@/lib/errors";
import { createdResponse, noContentResponse, okResponse, paginatedResponse } from "@/lib/errors";

// Feature: nextjs-platform-conversion, Task 5.1 smoke test for the typed error
// hierarchy, global handler, and success envelope helpers.
describe("handleApiError", () => {
  test("maps AppError subclasses to their canonical status and envelope", async () => {
    const cases: Array<[unknown, number, string]> = [
      [new BadRequestError(), 400, "BAD_REQUEST"],
      [new UnauthenticatedError(), 401, "UNAUTHENTICATED"],
      [new ForbiddenError(), 403, "FORBIDDEN"],
      [new NotFoundError(), 404, "NOT_FOUND"],
      [new ConflictError(), 409, "CONFLICT"],
      [new ValidationError("Invalid", { field: ["required"] }), 422, "VALIDATION_FAILED"],
      [new RateLimitError(), 429, "RATE_LIMITED"],
      [new ServiceUnavailableError(), 503, "SERVICE_UNAVAILABLE"],
    ];

    for (const [error, status, code] of cases) {
      const response = handleApiError(error);
      expect(response.status).toBe(status);
      const body = await response.json();
      expect(body.error.code).toBe(code);
      expect(typeof body.error.message).toBe("string");
    }
  });

  test("includes details on the error envelope when provided", async () => {
    const error = new ValidationError("Invalid input", { fieldErrors: { name: ["Required"] } });
    const response = handleApiError(error);
    const body = await response.json();
    expect(body.error.details).toEqual({ fieldErrors: { name: ["Required"] } });
  });

  test("omits details entirely when not provided", async () => {
    const response = handleApiError(new NotFoundError());
    const body = await response.json();
    expect(body.error.details).toBeUndefined();
  });

  test("maps an unknown Error to a leak-free generic 500", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const secretError = new Error("db connection string: postgres://user:secretpassword@host");
    const response = handleApiError(secretError);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe(INTERNAL_SERVER_ERROR_CODE);
    expect(body.error.message).not.toContain("secretpassword");
    expect(body.error.message).not.toContain("postgres://");
    expect(body.error.details).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(secretError.stack ?? "\u0000never-matches");

    // The real error must still be logged server-side for diagnosis.
    expect(consoleSpy).toHaveBeenCalledWith("[unhandled-error]", secretError);

    consoleSpy.mockRestore();
  });

  test("maps a thrown non-Error value (string) to the same leak-free generic 500", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = handleApiError("raw thrown string with internal detail");

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe(INTERNAL_SERVER_ERROR_CODE);
    expect(body.error.message).not.toContain("raw thrown string with internal detail");

    consoleSpy.mockRestore();
  });

  test("maps a raw ZodError to a 422 validation envelope with field-level details", async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const result = schema.safeParse({ name: 42, age: "old" });
    expect(result.success).toBe(false);

    const response = handleApiError(result.error);

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.details).toHaveProperty("fieldErrors");
    expect(
      (body.error.details as { fieldErrors: Record<string, unknown> }).fieldErrors,
    ).toHaveProperty("name");
    expect(
      (body.error.details as { fieldErrors: Record<string, unknown> }).fieldErrors,
    ).toHaveProperty("age");
  });
});

describe("success envelope helpers", () => {
  test("okResponse defaults to 200 with { data }", async () => {
    const response = okResponse({ id: "1" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { id: "1" } });
  });

  test("createdResponse returns 201 with { data }", async () => {
    const response = createdResponse({ id: "1" });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { id: "1" } });
  });

  test("noContentResponse returns 204 with an empty body", async () => {
    const response = noContentResponse();
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  test("paginatedResponse returns 200 with { data, meta }", async () => {
    const meta = { cursor: null, hasMore: false, total: 1 };
    const response = paginatedResponse([{ id: "1" }], meta);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [{ id: "1" }], meta });
  });
});
