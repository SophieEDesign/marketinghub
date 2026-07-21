"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toCanvaEmbedUrl } from "@/lib/social/platforms";

type PreviewState =
  | { mode: "loading" }
  | { mode: "image"; src: string }
  | { mode: "embed"; src: string }
  | { mode: "fallback" };

/** Actual Canva design preview (thumbnail or embed) when no image export is attached. */
export function CanvaPreviewTile({
  url,
  className,
  compact = true,
}: {
  url: string;
  className?: string;
  compact?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<PreviewState>({ mode: "loading" });

  // Only fetch / mount heavy previews when the card is on-screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "120px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const embedFallback = toCanvaEmbedUrl(url);

    async function load() {
      try {
        const res = await fetch(
          `/api/canva/preview?url=${encodeURIComponent(url)}`
        );
        if (!res.ok) throw new Error("preview failed");
        const data = (await res.json()) as {
          thumbnailUrl?: string | null;
          embedUrl?: string | null;
        };
        if (cancelled) return;
        if (data.thumbnailUrl) {
          setState({ mode: "image", src: data.thumbnailUrl });
          return;
        }
        if (data.embedUrl || embedFallback) {
          setState({
            mode: "embed",
            src: data.embedUrl || embedFallback!,
          });
          return;
        }
        setState({ mode: "fallback" });
      } catch {
        if (cancelled) return;
        if (embedFallback) {
          setState({ mode: "embed", src: embedFallback });
        } else {
          setState({ mode: "fallback" });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [visible, url]);

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative w-full overflow-hidden rounded-md bg-slate-100",
        compact ? "aspect-[16/10]" : "aspect-video",
        className
      )}
      title="Canva design preview"
    >
      {state.mode === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={state.src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => {
            const embed = toCanvaEmbedUrl(url);
            setState(
              embed ? { mode: "embed", src: embed } : { mode: "fallback" }
            );
          }}
        />
      ) : null}

      {state.mode === "embed" ? (
        <>
          <iframe
            src={state.src}
            title="Canva design"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            className={cn(
              "absolute inset-0 h-full w-full border-0 bg-white",
              compact && "pointer-events-none"
            )}
            allow="fullscreen"
          />
          {/* Keep calendar card clicks selecting the event, not the iframe */}
          {compact ? <div className="absolute inset-0 z-[1]" aria-hidden /> : null}
        </>
      ) : null}

      {state.mode === "loading" || state.mode === "fallback" ? (
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-1 text-white",
            "bg-gradient-to-br from-[#00C4CC] via-[#7D2AE8] to-[#8B3DFF]",
            state.mode === "loading" && "opacity-90"
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
          {!compact && state.mode === "fallback" ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-white/90">
              <ExternalLink className="h-3 w-3" />
              Open design to preview
            </span>
          ) : null}
          {state.mode === "loading" ? (
            <span className="text-[10px] text-white/80">Loading preview…</span>
          ) : null}
        </div>
      ) : null}

      <span className="pointer-events-none absolute bottom-1 right-1 z-[2] rounded bg-black/55 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-white">
        Canva
      </span>
      <span className="sr-only">{url}</span>
    </div>
  );
}
