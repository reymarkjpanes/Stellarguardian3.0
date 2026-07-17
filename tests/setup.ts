/**
 * tests/setup.ts
 * Global test setup: use an in-memory SQLite database for all tests.
 * Sets JWT_SECRET so authService doesn't crash.
 */
import { beforeAll, afterAll } from 'vitest';

// Set required environment variables for tests
process.env.JWT_SECRET = 'test-secret-for-vitest-must-be-32-chars!!';
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
