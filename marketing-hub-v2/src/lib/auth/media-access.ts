import { cookies } from "next/headers";
import { allowDemoAuth } from "@/lib/auth/config";

/** Cookie set after media-guest login — allows downloads, not full staff hub. */
export const MEDIA_ACCESS_COOKIE = "mh_media_access";

export async function hasMediaDownloadAccess(): Promise<boolean> {
  if (allowDemoAuth()) {
    return true;
  }

  const cookieStore = await cookies();

  if (cookieStore.get(MEDIA_ACCESS_COOKIE)?.value === "1") {
    return true;
  }

  // Demo staff cookie only valid outside production (middleware still sets it in demo).
  if (cookieStore.get("mh_staff_demo")?.value === "1") {
    return true;
  }

  try {
    const { getSessionUser } = await import("@/lib/auth/session");
    const user = await getSessionUser();
    if (user) return true;
  } catch {
    // fall through
  }

  return false;
}
