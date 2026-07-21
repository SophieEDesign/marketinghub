import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api";
import {
  isCanvaUrl,
  toCanvaEmbedUrl,
  toCanvaViewUrl,
} from "@/lib/social/platforms";

export const dynamic = "force-dynamic";

const GENERIC_THUMB =
  /thumbnail_design\.jpg|static\.canva\.com\/static\/images|canva-og|placeholder/i;

function pickMetaContent(html: string, prop: string): string | null {
  const re = new RegExp(
    `(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']|content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`,
    "i"
  );
  const m = html.match(re);
  return m?.[1] || m?.[2] || null;
}

function isUsableThumbnail(url: string | null | undefined): url is string {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  if (GENERIC_THUMB.test(url)) return false;
  return true;
}

async function resolveCanvaThumbnail(viewUrl: string): Promise<string | null> {
  const encoded = encodeURIComponent(viewUrl);

  // 1) oEmbed (works for published / embeddable designs)
  try {
    const oembedRes = await fetch(
      `https://www.canva.com/_oembed?url=${encoded}&format=json`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (compatible; MarketingHub/1.0; +https://localhost)",
        },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 3600 },
      }
    );
    const ctype = oembedRes.headers.get("content-type") || "";
    if (oembedRes.ok && ctype.includes("json")) {
      const data = (await oembedRes.json()) as {
        thumbnail_url?: string;
        url?: string;
      };
      if (isUsableThumbnail(data.thumbnail_url)) return data.thumbnail_url;
    }
  } catch {
    // ignore — fall through
  }

  // 2) Open Graph tags (public share pages)
  try {
    const pageRes = await fetch(viewUrl, {
      headers: {
        Accept: "text/html",
        "User-Agent":
          "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
      next: { revalidate: 3600 },
    });
    if (pageRes.ok) {
      const html = await pageRes.text();
      const og =
        pickMetaContent(html, "og:image") ||
        pickMetaContent(html, "og:image:secure_url") ||
        pickMetaContent(html, "twitter:image");
      if (isUsableThumbnail(og)) return og;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Resolve a real Canva design preview when the link is public/embeddable.
 * Private team designs usually have no public thumbnail — client falls back to embed iframe.
 */
export async function GET(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const raw = req.nextUrl.searchParams.get("url")?.trim() || "";
  if (!raw || !isCanvaUrl(raw)) {
    return NextResponse.json(
      { error: "A Canva design URL is required" },
      { status: 400 }
    );
  }

  const viewUrl = toCanvaViewUrl(raw);
  const embedUrl = toCanvaEmbedUrl(raw);
  if (!viewUrl || !embedUrl) {
    return NextResponse.json({ error: "Invalid Canva URL" }, { status: 400 });
  }

  const thumbnailUrl = await resolveCanvaThumbnail(viewUrl);

  return NextResponse.json(
    {
      viewUrl,
      embedUrl,
      thumbnailUrl,
    },
    {
      headers: {
        // Cache briefly at the edge; designs change infrequently relative to calendar browsing.
        "Cache-Control": "private, max-age=300, stale-while-revalidate=3600",
      },
    }
  );
}
