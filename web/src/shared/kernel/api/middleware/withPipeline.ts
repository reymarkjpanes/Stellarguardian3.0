import { NextResponse } from "next/server";
import { handleDomainError } from "../../errors/ErrorHandler";
import { RequestContext } from "../../context/RequestContext";
import { IdempotencyService } from "./IdempotencyService";
import { DuplicateRequestError, UnauthorizedError } from "../../errors/DomainError";
import crypto from "crypto";
import { ZodSchema } from "zod";
import { errorResponse } from "../ApiResponse";

/** HttpMethod is exported for use by route handlers that call withPipeline */
export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";

export interface PipelineOptions<_TParams = unknown, TBody = unknown> {
  requireAuth?: boolean;
  rateLimitPolicy?:
    | "PublicRead"
    | "AuthenticatedRead"
    | "AuthenticatedWrite"
    | "SensitiveActions"
    | "Authentication"
    | "Webhook";
  idempotent?: boolean;
  bodySchema?: ZodSchema<TBody>;
}

export type Handler<TParams = unknown, TBody = unknown> = (
  req: Request,
  ctx: RequestContext,
  params: TParams,
  body: TBody,
) => Promise<NextResponse>;

const idempotencyService = new IdempotencyService();

async function getAuthContext(req: Request): Promise<RequestContext> {
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  // Mock auth context for now
  return {
    user: { id: "user-123", role: "Participant", permissions: [] },
    requestId: crypto.randomUUID(),
    correlationId,
    traceId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
}

async function checkRateLimit(_policy: string, _userId?: string, _ip?: string): Promise<void> {
  // Mock rate limit implementation
  // A real implementation would use Upstash Redis to apply token buckets based on the policy
}

function computeHash(bodyText: string, userId: string, url: string): string {
  return crypto
    .createHash("sha256")
    .update(bodyText + userId + url)
    .digest("hex");
}

export function withPipeline<TParams = unknown, TBody = unknown>(
  handler: Handler<TParams, TBody>,
  options: PipelineOptions<TParams, TBody> = {},
) {
  return async (req: Request, context: { params: Promise<TParams> | TParams }) => {
    try {
      // 1. Resolve Params
      const params = await context.params;

      // 2. Auth & RequestContext
      const ctx = await getAuthContext(req);
      if (options.requireAuth && !ctx.user) {
        throw new UnauthorizedError("Authentication required.");
      }

      // 3. Rate Limiting
      if (options.rateLimitPolicy) {
        const ip = req.headers.get("x-forwarded-for") || "unknown";
        await checkRateLimit(options.rateLimitPolicy, ctx.user?.id, ip);
      }

      // 4. Read & Validate Body
      let rawBody = "";
      let parsedBody: unknown = undefined;

      if (req.method !== "GET" && req.method !== "DELETE") {
        try {
          rawBody = await req.text();
          if (rawBody) {
            parsedBody = JSON.parse(rawBody) as unknown;
          }
        } catch {
          // ignore parsing error, schema validation will catch empty bodies if required
        }

        if (options.bodySchema) {
          const parsed = options.bodySchema.safeParse(parsedBody);
          if (!parsed.success) {
            return NextResponse.json(
              errorResponse("VALIDATION_SCHEMA", "Invalid payload", parsed.error.format()),
              { status: 400 },
            );
          }
          parsedBody = parsed.data;
        }
      }

      // 5. Idempotency (For state changing requests)
      const idempotencyKey = req.headers.get("Idempotency-Key");
      let requestHash = "";

      if (options.idempotent && idempotencyKey && ctx.user?.id) {
        requestHash = computeHash(rawBody, ctx.user.id, req.url);

        const existingRecord = await idempotencyService.getRecord(idempotencyKey, ctx.user.id);
        if (existingRecord) {
          if (existingRecord.requestHash !== requestHash) {
            throw new DuplicateRequestError(
              "Idempotency key mismatch: The payload for this idempotency key is different.",
            );
          }
          if (existingRecord.statusCode) {
            return NextResponse.json(existingRecord.response, {
              status: existingRecord.statusCode,
            });
          }
          throw new DuplicateRequestError("Request is already being processed.");
        }
      }

      // 6. Application Use Case
      const response = await handler(req, ctx, params as TParams, parsedBody as TBody);

      // 7. Save Idempotency Result
      if (options.idempotent && idempotencyKey && ctx.user?.id) {
        const responseClone = response.clone();
        let responseBody: unknown = {};
        try {
          responseBody = (await responseClone.json()) as unknown;
        } catch {
          /* ignore */
        }

        await idempotencyService.saveRecord({
          key: idempotencyKey,
          userId: ctx.user.id,
          route: req.url,
          requestHash,
          response: responseBody,
          statusCode: response.status,
        });
      }

      return response;
    } catch (error) {
      const handled = handleDomainError(error);
      return NextResponse.json(handled.body, { status: handled.status });
    }
  };
}
