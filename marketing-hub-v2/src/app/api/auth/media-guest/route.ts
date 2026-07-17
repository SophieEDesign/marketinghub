import { NextRequest, NextResponse } from "next/server";
import {
  allowDemoAuth,
  productionAuthMisconfigured,
} from "@/lib/auth/config";
import { hubCookieOptions } from "@/lib/auth/cookies";
import { MEDIA_ACCESS_COOKIE } from "@/lib/auth/media-access";
import { safeNextPath } from "@/lib/auth/safe-next";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Grants media download access cookie.
 * - Demo (local/preview): may set media or staff demo cookies without a session.
 * - Production / real Supabase: requires an authenticated session; never sets mh_staff_demo.
 */
export async function POST(request: NextRequest) {
  if (productionAuthMisconfigured()) {
    return NextResponse.json(
      { error: "Auth is misconfigured for production" },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    next?: string;
    kind?: "media" | "staff";
  };
  const kind = body.kind === "staff" ? "staff" : "media";
  const next = safeNextPath(
    body.next,
    kind === "staff" ? "/app" : "/media"
  );

  const demo = allowDemoAuth();

  if (!demo) {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Real auth: staff hub uses Supabase session; only stamp media download cookie.
    const res = NextResponse.json({ ok: true, next });
    res.cookies.set(MEDIA_ACCESS_COOKIE, "1", hubCookieOptions());
    return res;
  }

  const res = NextResponse.json({ ok: true, next });
  const opts = hubCookieOptions();

  if (kind === "media") {
    res.cookies.set(MEDIA_ACCESS_COOKIE, "1", opts);
  } else {
    res.cookies.set("mh_staff_demo", "1", opts);
    res.cookies.set(MEDIA_ACCESS_COOKIE, "1", opts);
  }

  return res;
}
