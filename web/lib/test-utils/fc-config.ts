/**
 * Shared fast-check configuration for all property-based tests in this spec.
 *
 * Every property test MUST use `fcConfig` (or an override with an equal-or-higher
 * `numRuns`) when calling `fc.assert(...)`, so that every property runs a minimum
 * of 100 generated cases as required by the design's Testing Strategy.
 *
 * Tagging convention: every property test must include a comment directly above
 * the test (or as the first line of the test body) in the format:
 *
 *   // Feature: nextjs-platform-conversion, Property {number}: {property_text}
 *
 * Example:
 *
 *   import { test } from "vitest";
 *   import fc from "fast-check";
 *   import { fcConfig } from "@/lib/test-utils/fc-config";
 *
 *   // Feature: nextjs-platform-conversion, Property 1: Transitions occur only
 *   // when valid and preconditions are met
 *   test("canTransition rejects transitions outside the transition map", () => {
 *     fc.assert(
 *       fc.property(arbEventState(), arbEventState(), (from, to) => {
 *         // ...assertions...
 *       }),
 *       fcConfig,
 *     );
 *   });
 */
import type { Parameters as FastCheckParameters } from "fast-check";

/** Minimum number of generated cases every property test must run. */
export const MIN_NUM_RUNS = 100;

/**
 * Default fast-check parameters shared by all property tests in this spec.
 * Spread this into `fc.assert(prop, { ...fcConfig, ...overrides })` if a specific
 * test needs to raise `numRuns` further or add a `seed` for reproducing a failure.
 */
export const fcConfig: FastCheckParameters<unknown> = {
  numRuns: MIN_NUM_RUNS,
};
