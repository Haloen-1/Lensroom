import { defaultCopy, mergeCopy, validCopy } from "../../site-copy";
import { requireStudioSession } from "../studio-auth";
import { getSupabaseConfig, supabaseRequest } from "../supabase";

const key = "site_copy_v1";
const endpoint = "/rest/v1/studio_settings";
const headers = { "cache-control": "no-store" };
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.has("admin")) {
    const unauthorized = await requireStudioSession(request);
    if (unauthorized) return unauthorized;
  }
  try {
    if (!getSupabaseConfig()) return Response.json({ error: "Text storage is unavailable." }, { status: 503, headers });
    // Only this public-copy row is read. Never expose passphrase settings.
    const response = await supabaseRequest(`${endpoint}?select=value,updated_at&key=eq.${key}&limit=1`);
    if (!response.ok) throw new Error("read");
    const [row] = await response.json() as { value: string; updated_at: string }[];
    const parsed = row ? JSON.parse(row.value) : defaultCopy;
    if (!validCopy(parsed)) throw new Error("invalid");
    return Response.json({ copy: mergeCopy(parsed), version: row?.updated_at ?? null }, { headers });
  } catch {
    return Response.json({ error: "Could not load saved website text. Please retry." }, { status: 503, headers });
  }
}

export async function PUT(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const unauthorized = await requireStudioSession(request);
  if (unauthorized) return unauthorized;
  if (!getSupabaseConfig()) return Response.json({ error: "Text storage is unavailable." }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 100000) return Response.json({ error: "Text is too long." }, { status: 413 });
  let body;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid text data." }, { status: 400 }); }
  if (!body || !validCopy(body.copy) || !(body.version === null || (typeof body.version === "string" && !Number.isNaN(Date.parse(body.version))))) {
    return Response.json({ error: "Each text must contain 1 to 500 characters." }, { status: 400 });
  }
  const copy = mergeCopy(body.copy);
  const version = new Date(Math.max(Date.now(), body.version ? Date.parse(body.version) + 1 : 0)).toISOString();
  try {
    // Optimistic concurrency prevents a second admin tab from overwriting newer edits.
    const response = await supabaseRequest(body.version === null
      ? `${endpoint}?on_conflict=key&select=updated_at`
      : `${endpoint}?key=eq.${key}&updated_at=eq.${encodeURIComponent(body.version)}&select=updated_at`, {
      method: body.version === null ? "POST" : "PATCH",
      headers: { prefer: body.version === null ? "resolution=ignore-duplicates,return=representation" : "return=representation" },
      body: JSON.stringify({ key, value: JSON.stringify(copy), updated_at: version }),
    });
    if (!response.ok) throw new Error("write");
    const rows = await response.json() as { updated_at: string }[];
    if (!rows.length) return Response.json({ error: "Text changed in another tab. Reload saved text before publishing again." }, { status: 409 });
    return Response.json({ copy, version: rows[0].updated_at }, { headers });
  } catch {
    return Response.json({ error: "Could not publish text. Your edits have not been saved." }, { status: 500 });
  }
}
