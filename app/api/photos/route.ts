import {
  getSupabaseConfig,
  missingSupabaseResponse,
  publicStorageUrl,
  supabaseRequest,
  uploadPhotoFile,
} from "../supabase";
import { requireStudioSession } from "../studio-auth";

type PhotoRow = {
  id: number;
  storage_path: string;
  filename: string;
  title: string;
  category: string;
  labels: string;
  notes: string;
  content_type: string;
  size: number;
  created_at: string;
};

async function supabaseErrorMessage(response: Response, fallback: string) {
  const body = await response.text().catch(() => "");

  if (!body) return fallback;

  try {
    const parsed = JSON.parse(body) as { error?: string; message?: string; msg?: string };
    return parsed.message || parsed.error || parsed.msg || fallback;
  } catch {
    return body.slice(0, 240);
  }
}

function serialize(row: PhotoRow) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    labels: row.labels,
    notes: row.notes,
    imageUrl: publicStorageUrl(row.storage_path),
    createdAt: row.created_at,
  };
}

async function insertPhotoMetadata(photo: {
  storagePath: string;
  filename: string;
  title: string;
  category: string;
  labels: string;
  notes: string;
  contentType: string;
  size: number;
}) {
  return supabaseRequest("/rest/v1/photos?select=*", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      storage_path: photo.storagePath,
      filename: photo.filename,
      title: photo.title,
      category: photo.category,
      labels: photo.labels,
      notes: photo.notes,
      content_type: photo.contentType,
      size: photo.size,
    }),
  });
}

export async function GET() {
  if (!getSupabaseConfig()) return missingSupabaseResponse();
  const response = await supabaseRequest(
    "/rest/v1/photos?select=id,storage_path,filename,title,category,labels,notes,content_type,size,created_at&order=created_at.desc&order=id.desc",
  );

  if (!response.ok) {
    return Response.json({ photos: [], error: "Could not load photos from Supabase." }, { status: 500 });
  }

  return Response.json({ photos: ((await response.json()) as PhotoRow[]).map(serialize) });
}

export async function POST(request: Request) {
  const unauthorized = await requireStudioSession(request);
  if (unauthorized) return unauthorized;

  if (!getSupabaseConfig()) return missingSupabaseResponse();

  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = (await request.json()) as {
        storagePath?: unknown;
        filename?: unknown;
        title?: unknown;
        category?: unknown;
        labels?: unknown;
        notes?: unknown;
        contentType?: unknown;
        size?: unknown;
      };
      const storagePath = String(body.storagePath || "").trim();
      const filename = String(body.filename || "").trim();
      const contentType = String(body.contentType || "").trim();

      if (!storagePath || !filename || !contentType.startsWith("image/")) {
        return Response.json({ error: "The uploaded photo details were incomplete." }, { status: 400 });
      }

      const insert = await insertPhotoMetadata({
        storagePath,
        filename,
        title: String(body.title || filename).trim() || "Untitled",
        category: String(body.category || "Unsorted").trim() || "Unsorted",
        labels: String(body.labels || "").trim(),
        notes: String(body.notes || "").trim(),
        contentType,
        size: Number(body.size) || 0,
      });

      if (!insert.ok) {
        return Response.json(
          {
            error: `The photo labels could not be saved to Supabase. ${await supabaseErrorMessage(
              insert,
              "Check that supabase-schema.sql was run.",
            )}`,
          },
          { status: 500 },
        );
      }

      const inserted = ((await insert.json()) as PhotoRow[])[0];
      return Response.json({ photo: inserted ? serialize(inserted) : null }, { status: 201 });
    }

    const formData = await request.formData();
    const file = formData.get("photo");

    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      return Response.json({ error: "Upload an image file." }, { status: 400 });
    }

    const title = String(formData.get("title") || file.name).trim() || "Untitled";
    const category = String(formData.get("category") || "Unsorted").trim() || "Unsorted";
    const labels = String(formData.get("labels") || "").trim();
    const notes = String(formData.get("notes") || "").trim();
    const storagePath = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;

    const upload = await uploadPhotoFile(storagePath, file);
    if (!upload.ok) {
      return Response.json(
        {
          error: `The photo file could not be uploaded to Supabase storage. ${await supabaseErrorMessage(
            upload,
            "Check the storage bucket name and service role key.",
          )}`,
        },
        { status: 500 },
      );
    }

    const insert = await insertPhotoMetadata({
      storagePath,
      filename: file.name,
      title,
      category,
      labels,
      notes,
      contentType: file.type,
      size: file.size,
    });

    if (!insert.ok) {
      return Response.json(
        {
          error: `The photo labels could not be saved to Supabase. ${await supabaseErrorMessage(
            insert,
            "Check that supabase-schema.sql was run.",
          )}`,
        },
        { status: 500 },
      );
    }

    const inserted = ((await insert.json()) as PhotoRow[])[0];
    return Response.json({ photo: inserted ? serialize(inserted) : null }, { status: 201 });
  } catch {
    return Response.json(
      { error: "The photo could not be written to storage." },
      { status: 500 },
    );
  }
}
