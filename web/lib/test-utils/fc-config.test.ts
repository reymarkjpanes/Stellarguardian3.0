import { describe, expect, test } from "vitest";
import fc from "fast-check";
import { fcConfig, MIN_NUM_RUNS } from "@/lib/test-utils/fc-config";

// Feature: nextjs-platform-conversion, Property N/A: Toolchain smoke test
// proving Vitest + fast-check + the shared fc-config helper work end to end.
describe("toolchain smoke test", () => {
  test("fcConfig enforces a minimum of 100 iterations", () => {
    expect(fcConfig.numRuns).toBeGreaterThanOrEqual(100);
    expect(MIN_NUM_RUNS).toBe(100);
  });

  test("fast-check + shared fcConfig run a trivial property over generated inputs", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        // Addition is commutative for any pair of integers.
        return a + b === b + a;
      }),
      fcConfig,
    );
  });
});
