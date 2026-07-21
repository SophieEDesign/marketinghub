"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toCanvaViewUrl } from "@/lib/social/platforms";

/**
 * Canva design link with no image export attached.
 * Private team links cannot be scraped/embedded — show a clear CTA instead.
 * If Canva exposes a public thumbnail, we still use it.
 */
export function CanvaPreviewTile({
  url,
  className,
  compact = true,
}: {
  url: string;
  className?: string;
  compact?: boolean;
}) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const openUrl = toCanvaViewUrl(url) || url;

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 4000);

    async function load() {
      try {
        const res = await fetch(
          `/api/canva/preview?url=${encodeURIComponent(url)}`,
          { signal: ctrl.signal }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { thumbnailUrl?: string | null };
        if (!cancelled && data.thumbnailUrl) setThumb(data.thumbnailUrl);
      } catch {
        /* private designs have no public thumbnail */
      } finally {
        if (!cancelled) setTried(true);
        window.clearTimeout(timer);
      }
    }

    void load();
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [url]);

  if (thumb) {
    return (
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-md bg-slate-100",
          compact ? "aspect-[16/10]" : "aspect-video",
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setThumb(null)}
        />
        <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/55 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-white">
          Canva
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex w-full flex-col items-center justify-center overflow-hidden rounded-md",
        "bg-gradient-to-br from-[#00C4CC] via-[#7D2AE8] to-[#8B3DFF] text-white",
        compact ? "aspect-[16/10] gap-0.5 px-2" : "aspect-video gap-2 p-4",
        className
      )}
    >
      <span
        className={cn(
          "font-semibold tracking-tight",
          compact ? "text-[11px]" : "text-sm"
        )}
      >
        Canva
      </span>
      <span
        className={cn(
          "text-center text-white/90",
          compact ? "text-[8px] leading-tight" : "text-[11px]"
        )}
      >
        {tried
          ? compact
            ? "Upload a PNG for preview"
            : "Private link — upload a PNG/JPG export to show on the calendar"
          : "Checking preview…"}
      </span>
      {!compact ? (
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur hover:bg-white/30"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
          Open in Canva
        </a>
      ) : (
        <ImagePlus className="mt-0.5 h-3.5 w-3.5 text-white/70" />
      )}
      <span className="sr-only">{url}</span>
    </div>
  );
}
