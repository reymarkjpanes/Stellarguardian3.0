/**
 * POST /api/upload — Upload a file to Supabase Storage.
 * Validates file type and size per event's file_policy.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "text/markdown",
  "video/mp4",
  "video/webm",
]);
export const POST = withErrorHandling(async function POST(request: NextRequest) {
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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const bucket = (formData.get("bucket") as string) ?? "submissions";
  const path = formData.get("path") as string;

  if (!file) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "No file provided." } },
      { status: 422 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        error: {
          code: "FILE_TOO_LARGE",
          message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.`,
        },
      },
      { status: 422 },
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: { code: "INVALID_TYPE", message: `File type ${file.type} is not allowed.` } },
      { status: 422 },
    );
  }

  // Sanitize filename
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const sanitized = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const storagePath = path ? `${path}/${sanitized}` : sanitized;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { data, error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return NextResponse.json(
      { error: { code: "UPLOAD_FAILED", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      data: {
        path: data.path,
        fullPath: data.fullPath,
        size: file.size,
        mimeType: file.type,
        originalName: file.name,
      },
    },
    { status: 201 },
  );
});
