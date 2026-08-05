import { getSupabaseConfig, missingSupabaseResponse, supabaseRequest } from "../supabase";
import { requireStudioSession } from "../studio-auth";

type TopicRow = {
  id: number;
  name: string;
  sort_order: number;
};

function serialize(row: TopicRow) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
  };
}

function cleanName(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET() {
  if (!getSupabaseConfig()) return missingSupabaseResponse();
  const response = await supabaseRequest(
    "/rest/v1/topics?select=id,name,sort_order&order=sort_order.asc&order=name.asc",
  );

  if (!response.ok) return Response.json({ topics: [], error: "Could not load topics." }, { status: 500 });
  return Response.json({ topics: ((await response.json()) as TopicRow[]).map(serialize) });
}

export async function POST(request: Request) {
  const unauthorized = await requireStudioSession(request);
  if (unauthorized) return unauthorized;
  if (!getSupabaseConfig()) return missingSupabaseResponse();

  const body = await request.json().catch(() => ({}));
  const name = cleanName((body as { name?: unknown }).name);

  if (!name) {
    return Response.json({ error: "Topic name is required." }, { status: 400 });
  }

  const response = await supabaseRequest("/rest/v1/topics?select=*", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ name }),
  });
  const topic = response.ok ? ((await response.json()) as TopicRow[])[0] : null;

  return Response.json({ topic: topic ? serialize(topic) : null }, { status: 201 });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireStudioSession(request);
  if (unauthorized) return unauthorized;
  if (!getSupabaseConfig()) return missingSupabaseResponse();

  const body = await request.json().catch(() => ({}));
  const id = Number((body as { id?: unknown }).id);
  const name = cleanName((body as { name?: unknown }).name);

  if (!id || !name) {
    return Response.json({ error: "Topic and name are required." }, { status: 400 });
  }

  const currentResponse = await supabaseRequest(`/rest/v1/topics?select=name&id=eq.${id}&limit=1`);
  const current = currentResponse.ok ? ((await currentResponse.json()) as { name: string }[])[0] : null;

  if (!current) {
    return Response.json({ error: "Topic not found." }, { status: 404 });
  }

  await supabaseRequest(`/rest/v1/topics?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name, updated_at: new Date().toISOString() }),
  });
  await supabaseRequest(`/rest/v1/photos?category=eq.${encodeURIComponent(current.name)}`, {
    method: "PATCH",
    body: JSON.stringify({ category: name, updated_at: new Date().toISOString() }),
  });

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireStudioSession(request);
  if (unauthorized) return unauthorized;
  if (!getSupabaseConfig()) return missingSupabaseResponse();

  const body = await request.json().catch(() => ({}));
  const id = Number((body as { id?: unknown }).id);

  if (!id) {
    return Response.json({ error: "Topic is required." }, { status: 400 });
  }

  const currentResponse = await supabaseRequest(`/rest/v1/topics?select=name&id=eq.${id}&limit=1`);
  const current = currentResponse.ok ? ((await currentResponse.json()) as { name: string }[])[0] : null;

  if (!current) {
    return Response.json({ ok: true });
  }

  await supabaseRequest(`/rest/v1/topics?id=eq.${id}`, { method: "DELETE" });
  await supabaseRequest(`/rest/v1/photos?category=eq.${encodeURIComponent(current.name)}`, {
    method: "PATCH",
    body: JSON.stringify({ category: "Unsorted", updated_at: new Date().toISOString() }),
  });

  return Response.json({ ok: true });
}
