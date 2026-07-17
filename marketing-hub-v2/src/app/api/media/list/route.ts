import { NextResponse } from "next/server";
import { hasMediaDownloadAccess } from "@/lib/auth/media-access";
import { hasSupabaseConfig } from "@/lib/auth/config";
import { listMediaFromSupabase } from "@/lib/supabase/media-list";

export const dynamic = "force-dynamic";

export async function GET() {
  const canDownload = await hasMediaDownloadAccess();

  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      {
        configured: false,
        canDownload,
        error:
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and keys to .env.local",
        items: [],
        categories: [],
      },
      { status: 503 }
    );
  }

  try {
    const { items, tableName } = await listMediaFromSupabase();
    const categories = Array.from(
      new Set(items.map((i) => i.category).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      configured: true,
      source: "supabase",
      tableName,
      canDownload,
      items,
      categories,
    });
  } catch (e) {
    return NextResponse.json(
      {
        configured: true,
        canDownload,
        error: e instanceof Error ? e.message : "Failed to load media list",
        items: [],
        categories: [],
      },
      { status: 500 }
    );
  }
}
