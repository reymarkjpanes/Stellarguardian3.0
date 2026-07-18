import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

type ServerClientOptions = {
  cookies: {
    getAll: () => Array<{ name: string; value: string }>;
    setAll: (
      cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>,
    ) => void;
  };
};

const createServerClientMock = vi.fn<
  (url: string, key: string, options: ServerClientOptions) => { __kind: string }
>(() => ({ __kind: "server-client" }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

const cookieStore = {
  getAll: vi.fn(() => [{ name: "sb-session", value: "abc" }]),
  set: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

// Feature: nextjs-platform-conversion, Task 3.1 unit tests for the server
// Supabase client factory wired to next/headers cookies.
describe("createServerClient (lib/supabase/server)", () => {
  const original = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  beforeEach(() => {
    createServerClientMock.mockClear();
    cookieStore.getAll.mockClear();
    cookieStore.set.mockClear();
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

  test("awaits cookies() and wires getAll/setAll to the cookie store", async () => {
    const { createServerClient } = await import("./server");

    const client = await createServerClient();

    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    const [url, key, options] = createServerClientMock.mock.calls[0]!;
    expect(url).toBe("https://example.supabase.co");
    expect(key).toBe("anon-key");

    expect(options.cookies.getAll()).toEqual([{ name: "sb-session", value: "abc" }]);

    options.cookies.setAll([{ name: "sb-session", value: "new", options: { path: "/" } }]);
    expect(cookieStore.set).toHaveBeenCalledWith("sb-session", "new", { path: "/" });

    expect(client).toEqual({ __kind: "server-client" });
  });
});
