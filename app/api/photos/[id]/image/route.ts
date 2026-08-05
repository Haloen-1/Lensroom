import { getSupabaseConfig, publicStorageUrl, supabaseRequest } from "../../../supabase";

type PhotoAsset = {
  storage_path: string;
  content_type: string;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!getSupabaseConfig()) {
    return new Response("Photo storage is not connected", { status: 503 });
  }

  const { id } = await context.params;
  const response = await supabaseRequest(
    `/rest/v1/photos?select=storage_path,content_type&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  const row = response.ok ? ((await response.json()) as PhotoAsset[])[0] : null;

  if (!row) {
    return new Response("Not found", { status: 404 });
  }

  return Response.redirect(publicStorageUrl(row.storage_path), 302);
}
