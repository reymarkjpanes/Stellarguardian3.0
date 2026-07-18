import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "./env";

// Feature: nextjs-platform-conversion, Task 3.1 unit tests for the Supabase
// env accessor helpers used by every client factory.
describe("supabase env accessors", () => {
  const original = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
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

  test("getSupabaseUrl returns the configured value", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(getSupabaseUrl()).toBe("https://example.supabase.co");
  });

  test("getSupabaseUrl throws a descriptive error when unset", () => {
    expect(() => getSupabaseUrl()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  test("getSupabaseAnonKey returns the configured value", () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(getSupabaseAnonKey()).toBe("anon-key");
  });

  test("getSupabaseAnonKey throws a descriptive error when unset", () => {
    expect(() => getSupabaseAnonKey()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  test("getSupabaseServiceRoleKey returns the configured value", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    expect(getSupabaseServiceRoleKey()).toBe("service-role-key");
  });

  test("getSupabaseServiceRoleKey throws a descriptive error when unset", () => {
    expect(() => getSupabaseServiceRoleKey()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
