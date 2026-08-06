const defaultBucket = "photos";

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

export function getSupabaseConfig(): SupabaseConfig | null {
  const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const url = rawUrl?.replace(/\/$/, "");
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE;
  const bucket =
    process.env.SUPABASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ||
    defaultBucket;

  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey, bucket };
}

export function missingSupabaseResponse() {
  return Response.json(
    {
      error:
        "Supabase is not connected. Add SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, plus SUPABASE_SERVICE_ROLE_KEY, in this Vercel project's Production environment variables.",
    },
    { status: 503 },
  );
}

export async function supabaseRequest(path: string, init: RequestInit = {}) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Missing Supabase configuration");

  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      ...(init.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...init.headers,
    },
  });
}

export function publicStorageUrl(path: string) {
  const config = getSupabaseConfig();
  if (!config) return "";
  return `${config.url}/storage/v1/object/public/${config.bucket}/${path}`;
}

export async function createSignedUploadUrl(path: string) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Missing Supabase configuration");

  return fetch(`${config.url}/storage/v1/object/upload/sign/${config.bucket}/${encodeURIComponent(path)}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ expiresIn: 600 }),
  });
}

export async function uploadPhotoFile(path: string, file: File) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Missing Supabase configuration");

  return fetch(`${config.url}/storage/v1/object/${config.bucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": file.type,
      "x-upsert": "false",
    },
    body: file,
  });
}

export async function deletePhotoFile(path: string) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Missing Supabase configuration");

  return fetch(`${config.url}/storage/v1/object/${config.bucket}`, {
    method: "DELETE",
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ prefixes: [path] }),
  });
}
