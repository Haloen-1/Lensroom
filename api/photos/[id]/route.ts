import { deletePhotoFile, getSupabaseConfig, missingSupabaseResponse, supabaseRequest } from "../../supabase";
import { requireStudioSession } from "../../studio-auth";
import { commaValues, photoTopics } from "../../../photo-metadata";

type UpdatePayload = {
  title?: string;
  category?: string;
  labels?: string;
  notes?: string;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireStudioSession(request);
  if (unauthorized) return unauthorized;
  if (!getSupabaseConfig()) return missingSupabaseResponse();

  const { id } = await context.params;
  const payload = await request.json().catch(() => null) as UpdatePayload | null;
  if (!payload || typeof payload !== "object" || ["title", "category", "labels", "notes"].some((field) =>
    field in payload && typeof payload[field as keyof UpdatePayload] !== "string",
  )) return Response.json({ error: "Invalid photo details." }, { status: 400 });
  const updates: UpdatePayload = {};
  if (payload.title !== undefined) updates.title = payload.title.trim() || "Untitled";
  if (payload.category !== undefined) updates.category = photoTopics(payload.category).join(", ");
  if (payload.labels !== undefined) updates.labels = commaValues(payload.labels).join(", ");
  if (payload.notes !== undefined) updates.notes = payload.notes;
  if (!Object.keys(updates).length) return Response.json({ error: "No changes to save." }, { status: 400 });

  const response = await supabaseRequest(`/rest/v1/photos?id=eq.${encodeURIComponent(id)}&select=id`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
  });

  if (!response.ok) return Response.json({ error: "Could not save photo changes. Please try again." }, { status: 500 });
  const rows = await response.json();
  if (!rows.length) return Response.json({ error: "This photo no longer exists. Refresh Studio." }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireStudioSession(request);
  if (unauthorized) return unauthorized;
  if (!getSupabaseConfig()) return missingSupabaseResponse();

  const { id } = await context.params;
  const photo = await supabaseRequest(
    `/rest/v1/photos?select=storage_path&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  const row = photo.ok ? ((await photo.json()) as { storage_path: string }[])[0] : null;

  if (row) {
    await deletePhotoFile(row.storage_path);
    await supabaseRequest(`/rest/v1/photos?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  return Response.json({ ok: true });
}
