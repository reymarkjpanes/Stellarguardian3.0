/**
 * Validation re-export surface (Req 1.5).
 *
 * `/types` is the single source of truth for every Zod schema (entities,
 * enums, and API envelopes). This module re-exports all of it so route
 * handlers and services can import validators from a stable
 * `@/lib/validation` path without reaching into `/types` directly.
 */
export * from "@/types";
