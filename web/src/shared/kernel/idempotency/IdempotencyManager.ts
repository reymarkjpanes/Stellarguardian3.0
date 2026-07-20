export interface IdempotencyRecord {
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  response?: unknown;
  expiresAt: number;
}

export interface IdempotencyManager {
  /**
   * Attempts to acquire an idempotency lock for the given key and request hash.
   * Returns existing record if found, or null if lock is successfully acquired.
   */
  checkOrAcquire(userId: string, endpoint: string, method: string, hash: string): Promise<IdempotencyRecord | null>;
  
  /**
   * Completes the processing and saves the response.
   */
  complete(userId: string, endpoint: string, method: string, hash: string, response: unknown): Promise<void>;
  
  /**
   * Marks the processing as failed, allowing retry.
   */
  fail(userId: string, endpoint: string, method: string, hash: string): Promise<void>;
}
