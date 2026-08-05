import { createSignedUploadUrl, getSupabaseConfig, missingSupabaseResponse } from "../../supabase";
import { requireStudioSession } from "../../studio-auth";

function cleanFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function normalizeSignedUrl(value: unknown) {
  const config = getSupabaseConfig();
  if (!config || typeof value !== "string") return "";
  return value.startsWith("http") ? value : `${config.url}/storage/v1${value}`;
}

export async function POST(request: Request) {
  const unauthorized = await requireStudioSession(request);
  if (unauthorized) return unauthorized;
  if (!getSupabaseConfig()) return missingSupabaseResponse();

  const body = (await request.json().catch(() => ({}))) as {
    filename?: unknown;
    contentType?: unknown;
  };
  const filename = String(body.filename || "").trim();
  const contentType = String(body.contentType || "").trim();

  if (!filename || !contentType.startsWith("image/")) {
    return Response.json({ error: "Choose an image file first." }, { status: 400 });
  }

  const storagePath = `${crypto.randomUUID()}-${cleanFilename(filename)}`;
  const response = await createSignedUploadUrl(storagePath);
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    return Response.json(
      { error: result.message || result.error || "Could not create a Supabase upload link." },
      { status: 500 },
    );
  }

  return Response.json({
    storagePath,
    signedUrl: normalizeSignedUrl(result.signedURL || result.signedUrl || result.url),
  });
}
