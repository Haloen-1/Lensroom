import { getSupabaseConfig, missingSupabaseResponse, supabaseRequest } from "../supabase";
import { requireStudioSession } from "../studio-auth";
import { commaValues, hasTopic, nameKey, replaceTopic } from "../../photo-metadata";

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

async function updatePhotoTopics(previous: string, replacement: string) {
  const names = commaValues(previous);
  const photos: { id: number; category: string }[] = [];
  // Read all pages before updates so removing a topic cannot shift later pages.
  for (let offset = 0; ; offset += 1000) {
    const response = await supabaseRequest(`/rest/v1/photos?select=id,category&order=id.asc&limit=1000&offset=${offset}`);
    if (!response.ok) return false;
    const batch = await response.json() as { id: number; category: string }[];
    photos.push(...batch.filter((photo) => names.some((name) => hasTopic(photo.category, name))));
    if (batch.length < 1000) break;
  }
  for (const photo of photos) {
    const response = await supabaseRequest(`/rest/v1/photos?id=eq.${photo.id}`, {
      method: "PATCH",
      body: JSON.stringify({ category: replaceTopic(photo.category, previous, replacement), updated_at: new Date().toISOString() }),
    });
    if (!response.ok) return false;
  }
  return true;
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
  const names = commaValues(cleanName((body as { name?: unknown }).name));

  if (!names.length) {
    return Response.json({ error: "Topic name is required." }, { status: 400 });
  }

  const existingResponse = await supabaseRequest("/rest/v1/topics?select=name");
  if (!existingResponse.ok) return Response.json({ error: "Could not check existing topics. Please try again." }, { status: 500 });
  const existingRows = await existingResponse.json() as { name: string }[];
  const existing = new Set(existingRows.flatMap((row) => commaValues(row.name).map(nameKey)));
  const additions = names.filter((name) => !existing.has(nameKey(name)));
  if (!additions.length) return Response.json({ topics: [] });
  const response = await supabaseRequest("/rest/v1/topics?select=*&on_conflict=name", {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(additions.map((name) => ({ name }))),
  });
  if (!response.ok) return Response.json({ error: "Could not add topics. Please try again." }, { status: 500 });
  const added = ((await response.json()) as TopicRow[]).map(serialize);

  return Response.json({ topics: added, topic: added[0] ?? null }, { status: 201 });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireStudioSession(request);
  if (unauthorized) return unauthorized;
  if (!getSupabaseConfig()) return missingSupabaseResponse();

  const body = await request.json().catch(() => ({}));
  const id = Number((body as { id?: unknown }).id);
  const names = commaValues(cleanName((body as { name?: unknown }).name));
  const name = names[0];

  if (!id || !name) {
    return Response.json({ error: "Topic and name are required." }, { status: 400 });
  }
  if (names.length !== 1) return Response.json({ error: "Rename one topic at a time. Use Add topics for multiple names." }, { status: 400 });

  const currentResponse = await supabaseRequest(`/rest/v1/topics?select=name&id=eq.${id}&limit=1`);
  const current = currentResponse.ok ? ((await currentResponse.json()) as { name: string }[])[0] : null;

  if (!current) {
    return Response.json({ error: "Topic not found." }, { status: 404 });
  }

  const rename = await supabaseRequest(`/rest/v1/topics?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name, updated_at: new Date().toISOString() }),
  });
  if (!rename.ok) return Response.json({ error: "Could not rename this topic. The name may already exist." }, { status: 500 });
  if (!await updatePhotoTopics(current.name, name)) {
    await supabaseRequest(`/rest/v1/topics?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ name: current.name }) });
    return Response.json({ error: "Some photo topics could not be updated. Please retry the rename." }, { status: 500 });
  }

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

  if (!await updatePhotoTopics(current.name, "")) return Response.json({ error: "Some photo topics could not be updated. Please retry the deletion." }, { status: 500 });
  const deletion = await supabaseRequest(`/rest/v1/topics?id=eq.${id}`, { method: "DELETE" });
  if (!deletion.ok) return Response.json({ error: "Could not delete the topic. Please try again." }, { status: 500 });

  return Response.json({ ok: true });
}
