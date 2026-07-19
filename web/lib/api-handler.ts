import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError, UnauthenticatedError, ValidationError } from "@/lib/errors";

export type ApiContext<T = any, P = Record<string, string>> = {
  request: NextRequest;
  params: P;
  user: { id: string; email: string } | null;
  body: T;
};

export type ApiHandlerConfig<T extends z.ZodTypeAny = any> = {
  requireAuth?: boolean;
  schema?: T;
};

export function apiHandler<T extends z.ZodTypeAny, P = Record<string, string>>(
  config: ApiHandlerConfig<T>,
  handler: (ctx: ApiContext<z.infer<T>, P>) => Promise<Response> | Response
) {
  return async (request: NextRequest, props: { params: Promise<P> } | { params: P }) => {
    try {
      // Extract params safely
      const params = props?.params ? await Promise.resolve(props.params) : ({} as P);

      // Auth check
      const supabase = await createServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (config.requireAuth && !user) {
        throw new UnauthenticatedError();
      }

      // Parse body or search params if schema is provided
      let parsedBody = {} as z.infer<T>;
      if (config.schema) {
        if (["POST", "PUT", "PATCH"].includes(request.method)) {
          let bodyData;
          try {
            bodyData = await request.json();
          } catch {
            throw new ValidationError("Invalid JSON payload.");
          }

          const parsed = config.schema.safeParse(bodyData);
          if (!parsed.success) {
            throw new ValidationError("Validation failed", { fieldErrors: parsed.error.flatten().fieldErrors });
          }
          parsedBody = parsed.data;
        } else if (["GET", "DELETE"].includes(request.method)) {
          const searchParams = Object.fromEntries(request.nextUrl.searchParams);
          const parsed = config.schema.safeParse(searchParams);
          if (!parsed.success) {
            throw new ValidationError("Query parameter validation failed", { fieldErrors: parsed.error.flatten().fieldErrors });
          }
          parsedBody = parsed.data;
        }
      }

      return await handler({
        request,
        params,
        user: user ? { id: user.id, email: user.email ?? "" } : null,
        body: parsedBody,
      });
    } catch (error) {
      // Delegate to the global canonical handler
      return handleApiError(error);
    }
  };
}
