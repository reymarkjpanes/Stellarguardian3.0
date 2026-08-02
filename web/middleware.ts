/**
 * Next.js Middleware entry point.
 *
 * Next.js requires the middleware file to be named `middleware.ts` at the
 * project root. The actual implementation lives in `proxy.ts` — this file
 * re-exports it so both the framework convention and the existing code structure
 * are satisfied.
 */
export { proxy as middleware, config } from "./proxy";
