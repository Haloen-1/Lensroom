import {
  cleanPassphrase,
  getSessionCookieHeader,
  passphraseMatches,
  updateStoredPassphrase,
} from "../studio-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const passphrase = cleanPassphrase((body as { passphrase?: unknown }).passphrase);

  if (!passphrase || !(await passphraseMatches(passphrase))) {
    return Response.json({ ok: false }, { status: 401 });
  }

  return Response.json(
    { ok: true },
    { headers: { "set-cookie": await getSessionCookieHeader() } },
  );
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const oldPassphrase = cleanPassphrase((body as { oldPassphrase?: unknown }).oldPassphrase);
  const newPassphrase = cleanPassphrase((body as { newPassphrase?: unknown }).newPassphrase);

  if (newPassphrase.length < 8) {
    return Response.json(
      { ok: false, message: "Use at least 8 characters." },
      { status: 400 },
    );
  }

  if (!oldPassphrase || !(await passphraseMatches(oldPassphrase))) {
    return Response.json({ ok: false, message: "Old passphrase did not match." }, { status: 401 });
  }

  await updateStoredPassphrase(newPassphrase);

  return Response.json(
    { ok: true },
    { headers: { "set-cookie": await getSessionCookieHeader() } },
  );
}
