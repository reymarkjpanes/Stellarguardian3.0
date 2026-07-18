/**
 * Barrel entry point for the shared State Machine module (`/lib/state-machine`,
 * Req 6, 23). Re-exports the event lifecycle state machine (task 4.1) so
 * server route handlers/services and client-side UI can import from a
 * single path: `import { canTransition } from "@/lib/state-machine"`.
 *
 * The escrow lifecycle (`./escrow.ts`, Req 26, task 4.4) and dispute
 * lifecycle (Req 39, task 4.6) modules are added to this barrel by their
 * respective tasks.
 */
export * from "./event";
