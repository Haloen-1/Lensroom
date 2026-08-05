import { deletePhotoFile, getSupabaseConfig, missingSupabaseResponse, supabaseRequest } from "../../supabase";
import { requireStudioSession } from "../../studio-auth";

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
  const payload = (await request.json()) as UpdatePayload;
  const title = payload.title?.trim() || "Untitled";
  const category = payload.category?.trim() || "Unsorted";
  const labels = payload.labels?.trim() || "";
  const notes = payload.notes?.trim() || "";

  const response = await supabaseRequest(`/rest/v1/photos?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ title, category, labels, notes, updated_at: new Date().toISOString() }),
  });

  return Response.json({ ok: response.ok }, { status: response.ok ? 200 : 500 });
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
