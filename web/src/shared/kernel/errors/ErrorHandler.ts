import { DomainError } from "./DomainError";
import { errorResponse, ApiResponse } from "../api/ApiResponse";

export function handleDomainError(error: unknown): { status: number, body: ApiResponse<never> } {
  if (error instanceof DomainError) {
    return {
      status: error.status,
      body: errorResponse(error.code, error.message, error.metadata)
    };
  }

  // Zod or syntax errors could be caught and mapped here if needed

  console.error("Unexpected error:", error);
  return {
    status: 500,
    body: errorResponse("INTERNAL_SERVER_ERROR", "An unexpected error occurred.")
  };
}
