/**
 * Error handling re-export surface (Req 18.1-18.4, 20.5).
 *
 * Route handlers and services import the typed error hierarchy, the global
 * handler, and the success envelope helpers from this single stable path.
 */
export * from "./app-error";
export * from "./errors";
export * from "./handler";
export * from "./responses";
