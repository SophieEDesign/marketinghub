import { cookies } from "next/headers";
import { hasSupabaseConfig, isAuthBypass } from "@/lib/auth/config";

/** Cookie set after media-guest login — allows downloads, not full staff hub. */
export const MEDIA_ACCESS_COOKIE = "mh_media_access";

export async function hasMediaDownloadAccess(): Promise<boolean> {
  // Local / demo hub: same access as signed-in staff
  if (isAuthBypass() || !hasSupabaseConfig()) {
    return true;
  }

  const cookieStore = await cookies();

  // Explicit media guest / download grant
  if (cookieStore.get(MEDIA_ACCESS_COOKIE)?.value === "1") {
    return true;
  }

  // Demo staff hub cookie
  if (cookieStore.get("mh_staff_demo")?.value === "1") {
    return true;
  }

  // Any authenticated hub user (Member or Admin view)
  try {
    const { getSessionUser } = await import("@/lib/auth/session");
    const user = await getSessionUser();
    if (user) return true;
  } catch {
    // fall through
  }

  return false;
}
