/**
 * Shared type system entry point (Req 1.5).
 *
 * Zod schemas are the single source of truth for database schemas, API
 * request/response types, and component props. TypeScript types are
 * derived via `z.infer`. This barrel file re-exports every entity, enum,
 * and envelope schema authored under `/types` so consumers can import
 * from a single path.
 */
export * from "./common";
export * from "./enums";
export * from "./envelope";
export * from "./user";
export * from "./wallet";
export * from "./workspace";
export * from "./event";
export * from "./team";
export * from "./submission";
export * from "./evaluation";
export * from "./escrow";
export * from "./transaction";
export * from "./winner";
export * from "./dispute";
export * from "./notification";
export * from "./audit";
export * from "./sponsor-milestone";
export * from "./invitation";
export * from "./legal";
export * from "./idempotency";
