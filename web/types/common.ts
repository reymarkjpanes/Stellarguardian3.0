/**
 * Shared field-level primitives reused across entity schemas (Req 1.5, 2.7).
 *
 * Timestamp convention: every timestamp field crossing a JSON API boundary is
 * represented as an ISO-8601 string (via `z.iso.datetime()`, the Zod v4
 * top-level replacement for the deprecated `z.string().datetime()`), mirroring
 * the `timestamptz` UTC columns described in the design's Data Models section
 * (Req 2.7). This is applied consistently across every schema in `/types`.
 */
import { z } from "zod";

/** UUID primary/foreign key identifier. */
export const UuidSchema = z.uuid();

/** ISO-8601 UTC timestamp string (mirrors `timestamptz` columns, Req 2.7). */
export const TimestampSchema = z.iso.datetime({ offset: true });

/** Optimistic-concurrency version column (Req 19.2-19.6). */
export const VersionSchema = z.int().nonnegative();

/** Stellar account public key (56-char base32, starts with 'G'). */
export const StellarPublicKeySchema = z
  .string()
  .regex(/^G[A-Z2-7]{55}$/, "Must be a valid Stellar public key");

/** Non-negative monetary/token amount stored as `numeric` in Postgres. */
export const AmountSchema = z.number().nonnegative().finite();
