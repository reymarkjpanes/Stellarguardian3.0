/**
 * Barrel entry point for the shared State Machine module (`/lib/state-machine`,
 * Req 6, 23). Re-exports all three lifecycle state machines so server route
 * handlers/services and client-side UI can import from a single path:
 * `import { canTransition, canEscrowTransition, canDisputeTransition } from "@/lib/state-machine"`.
 */

export {
  canEscrowTransition,
  validEscrowOutboundStates,
  isEscrowTerminal,
  ESCROW_TERMINAL,
  type TransitionResult as EscrowTransitionResult,
  type EscrowContext,
} from "./escrow";

export {
  canDisputeTransition,
  validDisputeOutboundStates,
  isDisputeTerminal,
  DISPUTE_TERMINAL,
  type DisputeTransitionResult,
} from "./dispute";

export {
  canEventTransition,
  validEventOutboundStates,
  isEventTerminal,
  EVENT_TERMINAL,
  type TransitionResult as EventTransitionResult,
  type EventTransitionContext,
} from "./event";
