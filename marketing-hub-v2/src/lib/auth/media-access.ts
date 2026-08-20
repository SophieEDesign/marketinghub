import { cookies } from "next/headers";
import { allowDemoAuth } from "@/lib/auth/config";
import {
  issueSignedMediaToken,
  verifySignedMediaToken,
} from "@/lib/auth/signed-cookie";

/** Cookie set after authenticated media-guest or staff login — signed, not forgeable. */
export const MEDIA_ACCESS_COOKIE = "mh_media_access";

export { issueSignedMediaToken };

export async function hasMediaDownloadAccess(): Promise<boolean> {
  if (allowDemoAuth()) {
    return true;
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(MEDIA_ACCESS_COOKIE)?.value;

  // Production: only accept HMAC-signed tokens (legacy plain "1" is rejected).
  const signedUserId = verifySignedMediaToken(raw);
  if (signedUserId) {
    try {
      const { getSessionUser } = await import("@/lib/auth/session");
      const user = await getSessionUser();
      if (user && user.id === signedUserId) return true;
    } catch {
      // fall through
    }
  }

  // Authenticated Supabase session (staff or external) always grants download.
  try {
    const { getSessionUser } = await import("@/lib/auth/session");
    const user = await getSessionUser();
    if (user) return true;
  } catch {
    // fall through
  }

  return false;
}
