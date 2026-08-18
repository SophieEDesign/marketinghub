"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLATFORM_META, isCanvaUrl, platformKey, type PlatformKey } from "@/lib/social/platforms";
import { CanvaPreviewTile } from "@/components/content/CanvaPreviewTile";
import { RichTextView } from "@/components/ui/RichTextView";
import { stripHtml } from "@/lib/data/normalize";

type LayoutMode = "carousel" | "collage" | "single";

function layoutForPlatform(platform: PlatformKey, count: number): LayoutMode {
  if (count <= 1) return "single";
  if (platform === "instagram" || platform === "tiktok") return "carousel";
  return "collage";
}

function uniquePlatformKeys(platforms: string[]): PlatformKey[] {
  const keys: PlatformKey[] = [];
  for (const p of platforms) {
    const key = platformKey(p);
    if (!keys.includes(key)) keys.push(key);
  }
  return keys.length ? keys : ["social"];
}

function Caption({
  html,
  text,
  className,
}: {
  html?: string | null;
  text: string;
  className?: string;
}) {
  const body = html?.trim() || text.trim();
  if (!body) return null;
  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(body);
  if (looksHtml) {
    return (
      <RichTextView
        html={body}
        className={cn("text-[13px] leading-snug text-slate-800", className)}
        empty=""
      />
    );
  }
  return (
    <p className={cn("whitespace-pre-wrap text-[13px] leading-snug text-slate-800", className)}>
      {body}
    </p>
  );
}

function CarouselMedia({
  images,
  aspectClass,
}: {
  images: string[];
  aspectClass: string;
}) {
  const [index, setIndex] = useState(0);
  const total = images.length;
  const current = Math.min(index, total - 1);

  function go(next: number) {
    if (total <= 1) return;
    setIndex((next + total) % total);
  }

  return (
    <div className={cn("relative w-full overflow-hidden bg-slate-100", aspectClass)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[current]}
        alt=""
        className="h-full w-full object-cover"
      />
      {total > 1 ? (
        <>
          <button
            type="button"
            className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/60"
            aria-label="Previous image"
            onClick={(e) => {
              e.stopPropagation();
              go(current - 1);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/60"
            aria-label="Next image"
            onClick={(e) => {
              e.stopPropagation();
              go(current + 1);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
            {current + 1}/{total}
          </span>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Image ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition",
                  i === current ? "w-3 bg-white" : "w-1.5 bg-white/55"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i);
                }}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function CollageMedia({
  images,
  aspectClass,
}: {
  images: string[];
  aspectClass: string;
}) {
  const shown = images.slice(0, 4);
  const extra = images.length - shown.length;
  const count = shown.length;

  if (count === 1) {
    return (
      <div className={cn("overflow-hidden bg-slate-100", aspectClass)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shown[0]} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className={cn("grid grid-cols-2 gap-[2px] bg-white", aspectClass)}>
        {shown.map((src) => (
          <div key={src} className="relative min-h-0 overflow-hidden bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className={cn("grid grid-cols-2 grid-rows-2 gap-[2px] bg-white", aspectClass)}>
        <div className="relative row-span-2 min-h-0 overflow-hidden bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown[0]} alt="" className="h-full w-full object-cover" />
        </div>
        {shown.slice(1).map((src) => (
          <div key={src} className="relative min-h-0 overflow-hidden bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 grid-rows-2 gap-[2px] bg-white", aspectClass)}>
      {shown.map((src, i) => (
        <div key={src} className="relative min-h-0 overflow-hidden bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-full w-full object-cover" />
          {i === 3 && extra > 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-lg font-semibold text-white">
              +{extra}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function CompactMultiImageThumb({
  images,
  canvaUrl,
  className,
}: {
  images: string[];
  canvaUrl?: string | null;
  className?: string;
}) {
  const extraHidden = Math.max(0, images.length - 2);
  if (images.length === 0) {
    if (canvaUrl && isCanvaUrl(canvaUrl)) {
      return <CanvaPreviewTile url={canvaUrl} compact className={className} />;
    }
    return (
      <div
        className={cn(
          "flex aspect-[16/10] w-full items-center justify-center rounded-md bg-gradient-to-br from-sky-50 to-slate-100 text-sky-200",
          className
        )}
      >
        <ImageIcon className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative aspect-[16/10] w-full overflow-hidden rounded-md bg-slate-100",
        className
      )}
    >
      {images.length === 1 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={images[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="grid h-full grid-cols-2 gap-[2px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
          <div className="relative min-h-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[1]} alt="" className="h-full w-full object-cover" loading="lazy" />
            {extraHidden > 0 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-[11px] font-semibold text-white">
                +{extraHidden}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export function PlatformPostPreview({
  platforms,
  caption,
  captionHtml,
  images,
  canvaUrl,
}: {
  platforms: string[];
  caption: string;
  captionHtml?: string | null;
  images: string[];
  canvaUrl?: string | null;
}) {
  const keys = useMemo(() => uniquePlatformKeys(platforms), [platforms]);
  const [activeKey, setActiveKey] = useState<PlatformKey>(keys[0] ?? "social");
  const platform = keys.includes(activeKey) ? activeKey : keys[0] ?? "social";
  const meta = PLATFORM_META[platform];
  const layout = layoutForPlatform(platform, images.length);
  const captionFirst = platform === "facebook" || platform === "linkedin" || platform === "x";
  const aspectClass =
    platform === "instagram"
      ? "aspect-square"
      : platform === "tiktok"
        ? "aspect-[9/16] max-h-[420px] mx-auto"
        : "aspect-[4/5] sm:aspect-[16/10]";
  const captionText = caption || stripHtml(captionHtml ?? "");

  const media =
    images.length > 0 ? (
      layout === "carousel" ? (
        <CarouselMedia key={`${platform}:${images.join("|")}`} images={images} aspectClass={aspectClass} />
      ) : (
        <CollageMedia images={images} aspectClass={aspectClass} />
      )
    ) : canvaUrl && isCanvaUrl(canvaUrl) ? (
      <div className={cn("overflow-hidden bg-slate-50", aspectClass)}>
        <CanvaPreviewTile url={canvaUrl} compact={false} className="h-full" />
      </div>
    ) : (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-sky-50 to-slate-100 text-sky-200",
          aspectClass
        )}
      >
        <ImageIcon className="h-10 w-10" />
      </div>
    );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {keys.length > 1 ? (
        <div className="flex gap-1 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
          {keys.map((key) => {
            const m = PLATFORM_META[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={platform === key}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                  platform === key
                    ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                )}
                onClick={() => setActiveKey(key)}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex items-center gap-2 px-3 py-2.5">
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
          style={{ backgroundColor: meta.bg, color: meta.fg }}
        >
          {meta.short}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-slate-900">
            Peters & May
          </p>
          <p className="text-[11px] text-slate-500">
            {meta.label}
            {images.length > 1
              ? layout === "carousel"
                ? " · Carousel"
                : " · Collage"
              : ""}
          </p>
        </div>
      </div>

      {captionFirst ? (
        <div className="px-3 pb-2">
          <Caption html={captionHtml} text={captionText} />
        </div>
      ) : null}

      {media}

      {!captionFirst ? (
        <div className="px-3 py-2.5">
          <Caption html={captionHtml} text={captionText} />
        </div>
      ) : null}
    </div>
  );
}
