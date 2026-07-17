import { NextRequest, NextResponse } from "next/server";
import { MEDIA_ACCESS_COOKIE } from "@/lib/auth/media-access";

/**
 * Grants media download access (view is always public).
 * Demo / pre-Supabase: sets cookie after "Sign in to download".
 * With Supabase: callers should use normal auth; this still sets the media cookie as a fallback.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    next?: string;
    kind?: "media" | "staff";
  };
  const next = body.next || (body.kind === "staff" ? "/app" : "/media");
  const kind = body.kind === "staff" ? "staff" : "media";

  const res = NextResponse.json({ ok: true, next });

  if (kind === "media") {
    res.cookies.set(MEDIA_ACCESS_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    res.cookies.set("mh_staff_demo", "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    // Staff can also download
    res.cookies.set(MEDIA_ACCESS_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return res;
}
