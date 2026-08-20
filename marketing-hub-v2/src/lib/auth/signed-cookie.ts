import { createHmac, timingSafeEqual } from "crypto";

const SEP = ".";

function signingSecret(): string {
  return (
    process.env.MEDIA_ACCESS_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "dev-only-media-secret"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

/** Issue a signed media-access cookie value bound to a user id. */
export function issueSignedMediaToken(userId: string, maxAgeSec = 60 * 60 * 24 * 30) {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSec;
  const payload = `${userId}${SEP}${exp}`;
  return `${payload}${SEP}${sign(payload)}`;
}

/** Verify signed media-access cookie; returns user id when valid. */
export function verifySignedMediaToken(token: string | undefined | null): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(SEP);
  if (parts.length !== 3) return null;
  const [userId, expStr, signature] = parts;
  if (!userId || !expStr || !signature) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;

  const payload = `${userId}${SEP}${expStr}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return userId;
}
