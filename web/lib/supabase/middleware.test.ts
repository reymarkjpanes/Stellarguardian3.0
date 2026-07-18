import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

type GetClaimsResult =
  | { data: { claims: { sub: string }; header: object; signature: Uint8Array }; error: null }
  | { data: null; error: null };

const getClaimsMock = vi.fn<() => Promise<GetClaimsResult>>(async () => ({
  data: { claims: { sub: "user-123" }, header: {}, signature: new Uint8Array() },
  error: null,
}));

type ServerClientOptions = {
  cookies: {
    getAll: () => Array<{ name: string; value: string }>;
    setAll: (
      cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>,
    ) => void;
  };
};

const createServerClientMock = vi.fn<
  (
    url: string,
    key: string,
    options: ServerClientOptions,
  ) => { auth: { getClaims: typeof getClaimsMock } }
>(() => ({
  auth: { getClaims: getClaimsMock },
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

// Feature: nextjs-platform-conversion, Task 3.1 unit tests for the
// middleware session-refresh helper. Verifies getClaims() is invoked
// immediately after client creation and that verified claims are returned
// alongside the response, per the design.md warning against intervening code.
describe("updateSession (lib/supabase/middleware)", () => {
  const original = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  beforeEach(() => {
    createServerClientMock.mockClear();
    getClaimsMock.mockClear();
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

  test("calls getClaims() immediately after creating the server client", async () => {
    const { updateSession } = await import("./middleware");
    const request = new NextRequest("https://app.example.com/dashboard");

    await updateSession(request);

    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    expect(getClaimsMock).toHaveBeenCalledTimes(1);
    // getClaims must be the client's very first auth call for this request.
    expect(createServerClientMock.mock.invocationCallOrder[0]).toBeLessThan(
      getClaimsMock.mock.invocationCallOrder[0]!,
    );
  });

  test("returns the NextResponse alongside verified claims", async () => {
    const { updateSession } = await import("./middleware");
    const request = new NextRequest("https://app.example.com/dashboard");

    const { response, claims } = await updateSession(request);

    expect(response).toBeInstanceOf(Response);
    expect(claims).toEqual({ sub: "user-123" });
  });

  test("returns null claims when getClaims() yields no data (unauthenticated)", async () => {
    getClaimsMock.mockResolvedValueOnce({ data: null, error: null });
    const { updateSession } = await import("./middleware");
    const request = new NextRequest("https://app.example.com/dashboard");

    const { claims } = await updateSession(request);

    expect(claims).toBeNull();
  });

  test("wires cookies.getAll to the incoming request cookies", async () => {
    const { updateSession } = await import("./middleware");
    const request = new NextRequest("https://app.example.com/dashboard", {
      headers: { cookie: "sb-session=abc123" },
    });

    await updateSession(request);

    const options = createServerClientMock.mock.calls[0]![2];
    expect(options.cookies.getAll()).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "sb-session", value: "abc123" })]),
    );
  });
});
