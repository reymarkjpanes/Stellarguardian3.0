import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createClientMock = vi.fn(() => ({ __kind: "service-client" }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

// Feature: nextjs-platform-conversion, Task 3.1 unit tests for the
// server-only service-role Supabase client factory.
describe("createServiceClient (lib/supabase/service)", () => {
  const original = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  beforeEach(() => {
    createClientMock.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  test("uses the service-role key and disables session persistence/refresh", async () => {
    const { createServiceClient } = await import("./service");

    const client = createServiceClient();

    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    expect(client).toEqual({ __kind: "service-client" });
  });

  test("throws a descriptive error when the service-role key is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { createServiceClient } = await import("./service");

    expect(() => createServiceClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
