import { getSupabaseConfig, supabaseRequest } from "./supabase";

const defaultPassphrase = "lensroom2028";
const passphraseKey = "passphrase_hash";
const sessionCookieName = "lensroom_studio";

export async function hashPassphrase(passphrase: string) {
  const data = new TextEncoder().encode(passphrase);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function cleanPassphrase(value: unknown) {
  return String(value ?? "").trim();
}

export async function getStoredPassphraseHash() {
  if (!getSupabaseConfig()) return hashPassphrase(defaultPassphrase);

  const response = await supabaseRequest(
    `/rest/v1/studio_settings?select=value&key=eq.${encodeURIComponent(passphraseKey)}&limit=1`,
  );
  const rows = response.ok ? ((await response.json()) as { value: string }[]) : [];
  const row = rows[0];

  if (row?.value) return row.value;

  const defaultHash = await hashPassphrase(defaultPassphrase);
  await upsertSetting(passphraseKey, defaultHash);
  return defaultHash;
}

export async function passphraseMatches(passphrase: string) {
  const storedHash = await getStoredPassphraseHash();
  return (await hashPassphrase(passphrase)) === storedHash;
}

export async function updateStoredPassphrase(passphrase: string) {
  await upsertSetting(passphraseKey, await hashPassphrase(passphrase));
}

async function upsertSetting(key: string, value: string) {
  await supabaseRequest("/rest/v1/studio_settings?on_conflict=key", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key, value }),
  });
}

export async function getSessionToken() {
  return hashPassphrase(`studio-session:${await getStoredPassphraseHash()}`);
}

export async function getSessionCookieHeader() {
  return `${sessionCookieName}=${await getSessionToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;
}

export async function verifyStudioSession(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`))
    ?.slice(sessionCookieName.length + 1);

  return token === (await getSessionToken());
}

export async function requireStudioSession(request: Request) {
  if (await verifyStudioSession(request)) return null;
  return Response.json({ error: "Studio passphrase required." }, { status: 401 });
}
