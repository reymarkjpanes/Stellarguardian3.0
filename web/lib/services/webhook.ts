/**
 * Webhook service — deliver event notifications to external integrations.
 *
 * Stores webhook endpoints per workspace and fires on configured triggers.
 * Uses exponential backoff retry (max 3 attempts).
 */
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

export type WebhookEvent =
  | "event.created"
  | "event.state_changed"
  | "submission.created"
  | "evaluation.submitted"
  | "escrow.funded"
  | "escrow.disbursed"
  | "dispute.filed"
  | "dispute.resolved"
  | "winner.declared";

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

interface WebhookEndpoint {
  id: string;
  workspace_id: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  active: boolean;
}

/**
 * Fire a webhook event for all matching endpoints in the workspace.
 */
export async function fireWebhook(
  workspaceId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const supabase = createServiceClient();

  // Fetch active webhook endpoints for this workspace
  const { data: endpoints } = await supabase
    .from("webhook_endpoints")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("active", true);

  if (!endpoints || endpoints.length === 0) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  // Fire all matching endpoints concurrently
  const deliveries = endpoints
    .filter((ep: WebhookEndpoint) => ep.events.includes(event) || ep.events.includes("event.created" as WebhookEvent))
    .map((ep: WebhookEndpoint) => deliverWebhook(ep, payload));

  await Promise.allSettled(deliveries);
}

/**
 * Deliver a single webhook with retry logic.
 */
async function deliverWebhook(
  endpoint: WebhookEndpoint,
  payload: WebhookPayload,
  attempt = 1,
): Promise<void> {
  const maxAttempts = 3;
  const body = JSON.stringify(payload);

  // Generate HMAC signature for verification
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(endpoint.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": `sha256=${sigHex}`,
        "X-Webhook-Event": payload.event,
        "X-Webhook-Timestamp": payload.timestamp,
      },
      body,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!res.ok && attempt < maxAttempts) {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay));
      return deliverWebhook(endpoint, payload, attempt + 1);
    }

    if (!res.ok) {
      logger.warn("Webhook delivery failed after retries", {
        endpoint_id: endpoint.id,
        url: endpoint.url,
        status: res.status,
        event: payload.event,
      });
    }
  } catch (err) {
    if (attempt < maxAttempts) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return deliverWebhook(endpoint, payload, attempt + 1);
    }
    logger.error("Webhook delivery error", {
      endpoint_id: endpoint.id,
      error: String(err),
    });
  }
}
