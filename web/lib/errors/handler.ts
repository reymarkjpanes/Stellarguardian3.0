/**
 * Global error handler (Req 18.2, 18.4, 20.5).
 *
 * `handleApiError` is the single place in the codebase that turns a thrown
 * error into an HTTP `NextResponse`. Route handlers wrap their body in a
 * try/catch (or use `withErrorHandling`) and pass any caught error here:
 *
 * ```ts
 * export async function GET() {
 *   try {
 *     const data = await loadEvent();
 *     return okResponse(data);
 *   } catch (error) {
 *     return handleApiError(error);
 *   }
 * }
 * ```
 *
 * Behavior:
 *   - `AppError` instances are mapped 1:1 to `{ error: { code, message,
 *     details? } }` at their declared `httpStatus` (Req 18.2, 18.3).
 *   - A raw `ZodError` that escaped a `safeParse` check (rather than being
 *     wrapped in a `ValidationError` closer to the call site) is mapped to
 *     the same 422 `VALIDATION_FAILED` envelope, with `details.fieldErrors`
 *     populated from `z.flattenError` (Req 18.5).
 *   - Any other thrown value (unexpected exceptions, third-party library
 *     errors, thrown strings, etc.) is logged server-side with full detail
 *     and converted to a generic 500 `INTERNAL_SERVER_ERROR` response whose
 *     body never includes the original message, stack trace, or any other
 *     internal detail (Req 18.4, 20.5 - "leak-free 500").
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ErrorEnvelope } from "@/types";
import { AppError } from "./app-error";
import { ValidationError } from "./errors";

/** Stable code used for the generic, leak-free 500 fallback (Req 18.4). */
export const INTERNAL_SERVER_ERROR_CODE = "INTERNAL_SERVER_ERROR";

/** Message shown to clients for unhandled exceptions. Never derived from the real error. */
const INTERNAL_SERVER_ERROR_MESSAGE = "An unexpected error occurred. Please try again later.";

/**
 * Logs the real, unredacted error server-side. Kept as a small wrapper so
 * it can be swapped for structured logging (Req 20.1, 20.2) without
 * touching call sites.
 */
function logUnhandledError(error: unknown): void {
  // Structured logging is a later task (Req 20.1, 20.2); console.error is the interim sink.
  console.error("[unhandled-error]", error);
}

/**
 * Maps any thrown value to the canonical error envelope response.
 *
 * @param error - the value caught by a route handler's try/catch. May be an
 *   `AppError`, a plain `Error`, or any other thrown value.
 */
export function handleApiError(error: unknown): NextResponse<ErrorEnvelope> {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      },
      { status: error.httpStatus },
    );
  }

  // A ZodError that escaped a safeParse check earlier in the call chain is
  // still a validation failure, not an unexpected exception (Req 18.5).
  if (error instanceof z.ZodError) {
    const validationError = new ValidationError("The request failed validation.", {
      fieldErrors: z.flattenError(error).fieldErrors,
    });
    return NextResponse.json(
      {
        error: {
          code: validationError.code,
          message: validationError.message,
          details: validationError.details,
        },
      },
      { status: validationError.httpStatus },
    );
  }

  // Unknown/unhandled exception: log full detail server-side, never leak it.
  logUnhandledError(error);

  return NextResponse.json(
    {
      error: {
        code: INTERNAL_SERVER_ERROR_CODE,
        message: INTERNAL_SERVER_ERROR_MESSAGE,
      },
    },
    { status: 500 },
  );
}
