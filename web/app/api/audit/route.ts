/**
 * GET /api/audit — Admin audit log with CSV/JSON export (Req 31).
 * Query params: format=json|csv, limit, offset, resource_type, action
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

export const GET = withErrorHandling(async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const { searchParams } = request.nextUrl;
  const format = searchParams.get("format") ?? "json";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 1000);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const resourceType = searchParams.get("resource_type");
  const action = searchParams.get("action");

  let query = supabase
    .from("audit_records")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (resourceType) query = query.eq("resource_type", resourceType);
  if (action) query = query.eq("action", action);

  const { data: records, count, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 },
    );
  }

  // CSV export
  if (format === "csv") {
    const rows = records ?? [];
    if (rows.length === 0) {
      return new Response("No records found", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const headers = [
      "id",
      "actor_id",
      "action",
      "resource_type",
      "resource_id",
      "created_at",
      "metadata",
    ];
    const csvLines = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map((h) => {
            const val = r[h as keyof typeof r];
            if (h === "metadata") return JSON.stringify(val ?? {}).replace(/"/g, '""');
            return String(val ?? "");
          })
          .join(","),
      ),
    ];

    return new Response(csvLines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="audit_export_${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json({
    data: records ?? [],
    meta: { total: count ?? 0, limit, offset },
  });
});
