"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import type { MediaListItem } from "@/lib/supabase/media-list";
import { cn } from "@/lib/utils";

type ShareResponse = {
  folderName?: string;
  canDownload?: boolean;
  items?: MediaListItem[];
  error?: string;
};

type Photo = {
  id: string;
  url: string;
  name: string;
  itemName: string;
};

function isImageFile(file: { type?: string; name?: string; url?: string }) {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  const name = (file.name || file.url || "").toLowerCase();
  return /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|$)/i.test(name);
}

export function ShareFolderClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("Shared gallery");
  const [items, setItems] = useState<MediaListItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/media/share/${encodeURIComponent(token)}`);
        const json = (await res.json()) as ShareResponse;
        if (!res.ok) {
          throw new Error(json.error || "This share link is unavailable.");
        }
        if (cancelled) return;
        setFolderName(json.folderName || "Shared gallery");
        setItems(json.items || []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load folder");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const photos = useMemo(() => {
    const next: Photo[] = [];
    for (const item of items) {
      for (const file of item.files) {
        if (!isImageFile(file) || !file.url) continue;
        next.push({
          id: `${item.id}__${file.url}`,
          url: file.url,
          name: file.name || "Image",
          itemName: item.display_name || item.public_title || item.name,
        });
      }
    }
    return next;
  }, [items]);

  const lightboxPhoto =
    lightboxIndex != null ? photos[lightboxIndex] ?? null : null;

  useEffect(() => {
    if (lightboxIndex == null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowLeft") {
        setLightboxIndex((current) =>
          current == null || current <= 0 ? current : current - 1
        );
      }
      if (event.key === "ArrowRight") {
        setLightboxIndex((current) => {
          if (current == null) return current;
          return current >= photos.length - 1 ? current : current + 1;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, photos.length]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-foreground">
      <header className="border-b border-border bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
              Peters &amp; May
            </p>
            <h1 className="mt-1 font-display text-3xl text-brand md:text-4xl">
              {folderName}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Shared folder · view and download without signing in
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        {loading ? (
          <p className="text-sm text-muted">Loading shared images…</p>
        ) : error ? (
          <div className="rounded-2xl border border-border bg-white p-8 text-center">
            <h2 className="font-display text-2xl text-brand">Link unavailable</h2>
            <p className="mt-2 text-sm text-muted">{error}</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white p-8 text-center">
            <h2 className="font-display text-2xl text-brand">No images yet</h2>
            <p className="mt-2 text-sm text-muted">
              This shared folder does not contain any downloadable images.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">
              {photos.length} image{photos.length === 1 ? "" : "s"} · click to
              view or download
            </p>
            <div className="columns-2 gap-2 sm:columns-3 lg:columns-4 lg:gap-3">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="group relative mb-2 break-inside-avoid overflow-hidden rounded-lg bg-[#f0f2f3] lg:mb-3"
                >
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => setLightboxIndex(index)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.itemName || photo.name}
                      className="w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                  </button>
                  <a
                    href={photo.url}
                    download={photo.name}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </a>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {lightboxPhoto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {lightboxIndex != null && lightboxIndex > 0 ? (
            <button
              type="button"
              className="absolute left-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:left-6"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex - 1);
              }}
              aria-label="Previous"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : null}
          {lightboxIndex != null && lightboxIndex < photos.length - 1 ? (
            <button
              type="button"
              className="absolute right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:right-6"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex + 1);
              }}
              aria-label="Next"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          ) : null}
          <div
            className={cn("relative max-h-[85vh] max-w-5xl")}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.itemName || lightboxPhoto.name}
              className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain"
            />
            <div className="mt-3 flex items-center justify-between gap-3 text-white">
              <p className="truncate text-sm">
                {lightboxPhoto.itemName || lightboxPhoto.name}
              </p>
              <a
                href={lightboxPhoto.url}
                download={lightboxPhoto.name}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-brand"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
