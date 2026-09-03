import { NextResponse } from "next/server";
import { hasSupabaseConfig } from "@/lib/auth/config";
import { rateLimitPublic } from "@/lib/security/rate-limit";
import { listMediaByShareToken } from "@/lib/supabase/media-list";

export const dynamic = "force-dynamic";

type Ctx = { params: { token: string } };

export async function GET(request: Request, context: Ctx) {
  const limited = rateLimitPublic(request, "media-share", 60);
  if (!limited.ok) return limited.response;

  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { error: "Supabase is not configured", items: [] },
      { status: 503 }
    );
  }

  const token = context.params.token;
  try {
    const result = await listMediaByShareToken(token || "");
    if (!result) {
      return NextResponse.json(
        { error: "This share link is invalid or has been turned off." },
        { status: 404 }
      );
    }
    return NextResponse.json({
      folderName: result.folderName,
      canDownload: true,
      items: result.items,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Failed to load shared folder",
        items: [],
      },
      { status: 500 }
    );
  }
}
