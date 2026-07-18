import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const createBrowserClientMock = vi.fn(() => ({ __kind: "browser-client" }));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: createBrowserClientMock,
}));

// Feature: nextjs-platform-conversion, Task 3.1 unit tests for the browser
// Supabase client factory.
describe("createBrowserClient (lib/supabase/client)", () => {
  const original = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  beforeEach(() => {
    createBrowserClientMock.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
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

  test("delegates to @supabase/ssr's createBrowserClient with the anon key", async () => {
    const { createBrowserClient } = await import("./client");

    const client = createBrowserClient();

    expect(createBrowserClientMock).toHaveBeenCalledWith("https://example.supabase.co", "anon-key");
    expect(client).toEqual({ __kind: "browser-client" });
  });

  test("throws a descriptive error when the anon key is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { createBrowserClient } = await import("./client");

    expect(() => createBrowserClient()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});
