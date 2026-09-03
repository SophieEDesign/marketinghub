import { NextResponse } from "next/server";
import { hasMediaDownloadAccess } from "@/lib/auth/media-access";
import { allowDemoAuth, hasSupabaseConfig } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";
import { redactMediaItemsForPublic } from "@/lib/media/redact";
import { rateLimitPublic } from "@/lib/security/rate-limit";
import {
  listGalleryFolderShares,
  listMediaFromSupabase,
  type GalleryFolderShare,
  type MediaListScope,
} from "@/lib/supabase/media-list";

export const dynamic = "force-dynamic";

function parseScope(raw: string | null): MediaListScope {
  return raw === "all" ? "all" : "public";
}

async function canListAllMedia(): Promise<boolean> {
  if (allowDemoAuth()) return true;
  const user = await getSessionUser();
  return !!user && user.role !== "media_guest";
}

async function canIncludeAdminMedia(): Promise<boolean> {
  if (allowDemoAuth()) return true;
  const user = await getSessionUser();
  return user?.role === "admin";
}

export async function GET(request: Request) {
  const limited = rateLimitPublic(request, "media-list", 120);
  if (!limited.ok) return limited.response;

  const canDownload = await hasMediaDownloadAccess();
  const url = new URL(request.url);
  const requestedScope = parseScope(url.searchParams.get("scope"));
  // Full catalogue is staff-only; public + media guests stay on Logos, Presentations, Gallery.
  const scope: MediaListScope =
    requestedScope === "all" && (await canListAllMedia()) ? "all" : "public";
  const includeAdmin =
    scope === "all" && (await canIncludeAdminMedia());

  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      {
        configured: false,
        canDownload,
        scope,
        error:
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and keys to .env.local",
        items: [],
        categories: [],
      },
      { status: 503 }
    );
  }

  try {
    const limit = Number(url.searchParams.get("limit") || "200");
    const offset = Number(url.searchParams.get("offset") || "0");
    const { items, tableName, total } = await listMediaFromSupabase({
      scope,
      includeAdmin,
      limit,
      offset,
    });
    const safeItems = redactMediaItemsForPublic(items, canDownload);
    const fromItems = safeItems.map((i) => i.category).filter(Boolean);
    // Always surface Gallery even when empty (staff + public/external).
    const categories = Array.from(
      new Set(["Gallery", ...fromItems])
    ).sort((a, b) => a.localeCompare(b));

    let folderShares: GalleryFolderShare[] = [];
    if (scope === "all") {
      try {
        folderShares = await listGalleryFolderShares();
      } catch {
        folderShares = [];
      }
    }

    return NextResponse.json({
      configured: true,
      source: "supabase",
      tableName,
      canDownload,
      scope,
      items: safeItems,
      categories,
      folderShares,
      total,
      limit,
      offset,
    });
  } catch (e) {
    return NextResponse.json(
      {
        configured: true,
        canDownload,
        scope,
        error: e instanceof Error ? e.message : "Failed to load media list",
        items: [],
        categories: [],
      },
      { status: 500 }
    );
  }
}
