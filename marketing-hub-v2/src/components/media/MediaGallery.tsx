"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Lock,
  X,
} from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/PageHeader";
import {
  MEDIA_HUB_CATEGORIES,
  type MediaFile,
  type MediaListItem,
} from "@/lib/supabase/media-list";
import { cn } from "@/lib/utils";

type ListResponse = {
  configured: boolean;
  canDownload?: boolean;
  items?: MediaListItem[];
  categories?: string[];
  error?: string;
};

type GalleryPhoto = {
  id: string;
  url: string;
  name: string;
  itemName: string;
  category: string;
};

function itemDisplayName(item: MediaListItem) {
  return item.display_name || item.public_title || item.name;
}

function isImageFile(file: MediaFile) {
  return (
    file.type.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name)
  );
}

function photosFromItems(items: MediaListItem[]): GalleryPhoto[] {
  const photos: GalleryPhoto[] = [];
  for (const item of items) {
    for (const file of item.files) {
      if (!isImageFile(file)) continue;
      photos.push({
        id: `${item.id}__${file.url}`,
        url: file.url,
        name: file.name,
        itemName: itemDisplayName(item),
        category: item.category,
      });
    }
  }
  return photos;
}

const EMPTY_FORM = {
  name: "",
  public_title: "",
  category: "Logos",
  document_link: "",
  notes: "",
};

export function MediaGallery({
  title = "Media",
  description = "Browse brand assets in a gallery-style collection view.",
  showStaffChrome = true,
  initialCanDownload = false,
  hideHeader = false,
  /** Public gallery: Logos + Presentations only. Staff library: all categories. */
  scope = "public",
  /** Admin view: show Add media / delete. Member & public: browse only. */
  allowManage = false,
}: {
  title?: string;
  description?: string;
  showStaffChrome?: boolean;
  initialCanDownload?: boolean;
  hideHeader?: boolean;
  scope?: "public" | "all";
  allowManage?: boolean;
}) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [canDownload, setCanDownload] = useState(initialCanDownload);
  const [collection, setCollection] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/media/list?scope=${scope}`);
    const json = (await res.json()) as ListResponse;
    setData(json);
    if (typeof json.canDownload === "boolean") {
      setCanDownload(json.canDownload);
    }
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = data?.items ?? [];
  const categories = data?.categories ?? [];

  const collections = useMemo(() => {
    return categories.map((name) => {
      const inCat = items.filter((i) => i.category === name);
      const photos = photosFromItems(inCat);
      const docs = inCat.filter(
        (i) =>
          i.document_link ||
          i.document_url ||
          i.files.some((f) => !isImageFile(f))
      );
      return {
        name,
        photos,
        docs,
        cover: photos[0]?.url ?? null,
        photoCount: photos.length,
        assetCount: inCat.length,
      };
    });
  }, [categories, items]);

  const activeCollection = collections.find((c) => c.name === collection);
  const photos = activeCollection?.photos ?? [];
  const lightboxPhoto =
    lightboxIndex != null ? photos[lightboxIndex] ?? null : null;

  useEffect(() => {
    if (lightboxIndex == null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight") {
        setLightboxIndex((i) =>
          i == null ? null : Math.min(photos.length - 1, i + 1)
        );
      }
      if (e.key === "ArrowLeft") {
        setLightboxIndex((i) => (i == null ? null : Math.max(0, i - 1)));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, photos.length]);

  const loginHref = `/login?intent=media&next=${encodeURIComponent("/media")}`;

  async function createMedia() {
    if (!allowManage || saving) return;
    if (!form.name.trim()) {
      setFormError("Name is required");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      let uploaded:
        | { url: string; name: string; type?: string; size?: number | null }
        | undefined;
      if (file) {
        const body = new FormData();
        body.append("file", file);
        const uploadRes = await fetch("/api/content/upload", {
          method: "POST",
          body,
        });
        const uploadJson = (await uploadRes.json()) as {
          url?: string;
          name?: string;
          error?: string;
        };
        if (!uploadRes.ok || !uploadJson.url) {
          throw new Error(uploadJson.error || "File upload failed");
        }
        uploaded = {
          url: uploadJson.url,
          name: uploadJson.name || file.name,
          type: file.type,
          size: file.size,
        };
      }

      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          public_title: form.public_title,
          category: form.category,
          document_link: form.document_link,
          notes: form.notes,
          file: uploaded,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not save media");

      setShowForm(false);
      setForm(EMPTY_FORM);
      setFile(null);
      if (form.category) setCollection(form.category);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save media");
    } finally {
      setSaving(false);
    }
  }

  async function removeMedia(id: string) {
    if (!allowManage) return;
    if (!window.confirm("Remove this media item?")) return;
    await fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await load();
  }

  const manageActions = allowManage ? (
    <button
      type="button"
      className="btn-primary"
      onClick={() => {
        setShowForm(true);
        setFormError(null);
      }}
    >
      Add media
    </button>
  ) : undefined;

  const header = hideHeader ? null : showStaffChrome ? (
    <PageHeader
      title={title}
      description={description}
      actions={manageActions}
    />
  ) : (
    <div className="mb-8 text-center">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted">
        Peters &amp; May
      </p>
      <h1 className="font-display text-4xl text-brand md:text-5xl">{title}</h1>
      <p className="mx-auto mt-3 max-w-xl text-muted">{description}</p>
      {!canDownload ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
          <Lock className="h-4 w-4" />
          Browse freely ·{" "}
          <Link
            href={loginHref}
            className="font-medium text-brand underline-offset-2 hover:underline"
          >
            Sign in to download
          </Link>
        </p>
      ) : (
        <p className="mt-4 text-sm text-[var(--success)]">
          Downloads enabled
        </p>
      )}
    </div>
  );

  return (
    <div>
      {header}

      {hideHeader ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-brand">Media</h2>
            {!allowManage ? (
              <p className="mt-0.5 text-xs text-muted">
                Browse and download brand assets
              </p>
            ) : null}
          </div>
          {manageActions}
        </div>
      ) : null}

      {allowManage && showForm ? (
        <div className="surface-card mb-6 grid gap-3 p-5 md:grid-cols-2">
          <div>
            <label className="label">Name (internal)</label>
            <input
              className="field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Primary logo pack"
            />
          </div>
          <div>
            <label className="label">Public title</label>
            <input
              className="field"
              value={form.public_title}
              onChange={(e) =>
                setForm({ ...form, public_title: e.target.value })
              }
              placeholder="Shown on public gallery (optional)"
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select
              className="field"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {MEDIA_HUB_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              {categories
                .filter(
                  (c) =>
                    !(MEDIA_HUB_CATEGORIES as readonly string[]).includes(c)
                )
                .map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">Document / link URL</label>
            <input
              className="field"
              value={form.document_link}
              onChange={(e) =>
                setForm({ ...form, document_link: e.target.value })
              }
              placeholder="https://…"
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Upload file (optional)</label>
            <input
              className="field"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <p className="mt-1 text-xs text-muted">{file.name}</p>
            ) : null}
          </div>
          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <textarea
              className="field min-h-[70px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          {formError ? (
            <p className="md:col-span-2 text-sm text-[var(--danger)]">
              {formError}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              className={cn("btn-primary", saving && "opacity-70")}
              disabled={saving}
              onClick={() => void createMedia()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={saving}
              onClick={() => {
                setShowForm(false);
                setFormError(null);
                setFile(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading gallery…</p>
      ) : !data?.configured ? (
        <EmptyState
          title="Media list not connected"
          description={
            data?.error || "Connect Supabase to load Media Links Resources."
          }
        />
      ) : data.error && items.length === 0 ? (
        <EmptyState title="Couldn’t load media" description={data.error} />
      ) : !collection ? (
        <div>
          <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Collections
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((col) => (
              <button
                key={col.name}
                type="button"
                onClick={() => setCollection(col.name)}
                className="group overflow-hidden rounded-2xl border border-border bg-white text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#f0f2f3]">
                  {col.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={col.cover}
                      alt=""
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted">
                      <FileText className="h-10 w-10 opacity-40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <p className="text-lg font-medium tracking-tight">
                      {col.name}
                    </p>
                    <p className="mt-0.5 text-xs text-white/80">
                      {col.photoCount > 0
                        ? `${col.photoCount} photo${col.photoCount === 1 ? "" : "s"}`
                        : `${col.assetCount} asset${col.assetCount === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {collections.length === 0 ? (
            <EmptyState
              title="No collections yet"
              description={
                allowManage
                  ? "Add media to create your first collection."
                  : "Add rows to Media Links Resources in Supabase."
              }
            />
          ) : null}
        </div>
      ) : (
        <div>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <button
                type="button"
                className="mb-2 text-sm text-muted transition hover:text-brand"
                onClick={() => {
                  setCollection(null);
                  setLightboxIndex(null);
                }}
              >
                ← All collections
              </button>
              <h2 className="font-display text-3xl text-brand md:text-4xl">
                {collection}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {photos.length > 0
                  ? `${photos.length} photo${photos.length === 1 ? "" : "s"}`
                  : "Documents & links"}
                {canDownload ? " · Click a photo to preview & download" : ""}
              </p>
            </div>
            {canDownload && photos.length > 0 ? (
              <p className="text-xs text-[var(--success)]">
                Downloads enabled for your account
              </p>
            ) : null}
          </div>

          {photos.length > 0 ? (
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
                      alt={photo.name}
                      className="w-full object-cover transition duration-300 group-hover:brightness-95"
                      loading="lazy"
                    />
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <span className="min-w-0 truncate text-left text-[11px] text-white">
                      {photo.itemName}
                    </span>
                    {canDownload ? (
                      <a
                        href={photo.url}
                        download={photo.name}
                        target="_blank"
                        rel="noreferrer"
                        className="pointer-events-auto inline-flex shrink-0 items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[10px] font-semibold text-brand shadow-sm hover:bg-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {activeCollection && activeCollection.docs.length > 0 ? (
            <div className={cn(photos.length > 0 && "mt-10")}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Files &amp; links
              </h3>
              <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
                {activeCollection.docs.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {itemDisplayName(item)}
                      </p>
                      <p className="text-xs text-muted">
                        {scope === "all" &&
                        item.public_title &&
                        item.public_title !== item.name
                          ? `Public: ${item.public_title}`
                          : item.status || item.owned_by || "Asset"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.files
                        .filter((f) => !isImageFile(f))
                        .map((fileItem) =>
                          canDownload ? (
                            <a
                              key={fileItem.url}
                              href={fileItem.url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-secondary px-2.5 py-1.5 text-xs"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {fileItem.name.slice(0, 18)}
                            </a>
                          ) : (
                            <Link
                              key={fileItem.url}
                              href={loginHref}
                              className="btn-ghost px-2.5 py-1.5 text-xs"
                            >
                              <Lock className="h-3.5 w-3.5" />
                              Sign in
                            </Link>
                          )
                        )}
                      {(item.document_link || item.document_url) &&
                        (canDownload ? (
                          <a
                            href={item.document_link || item.document_url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary px-2.5 py-1.5 text-xs"
                          >
                            Open
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <Link
                            href={loginHref}
                            className="btn-ghost px-2.5 py-1.5 text-xs"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            Sign in
                          </Link>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {photos.length === 0 &&
          (!activeCollection || activeCollection.docs.length === 0) ? (
            <EmptyState
              title="Empty collection"
              description="No photos or files in this category yet."
            />
          ) : null}

          {allowManage && activeCollection ? (
            <div className="mt-10">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Manage assets
              </h3>
              <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
                {items
                  .filter((i) => i.category === collection)
                  .map((item) => (
                    <li
                      key={`manage-${item.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted">
                          {item.public_title && item.public_title !== item.name
                            ? `Public: ${item.public_title}`
                            : `${item.files.length} file${item.files.length === 1 ? "" : "s"}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-ghost px-2.5 py-1.5 text-xs text-[var(--danger)]"
                        onClick={() => void removeMedia(item.id)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {lightboxPhoto && lightboxIndex != null ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/92 md:left-sidebar"
          role="dialog"
          aria-modal="true"
          aria-label={lightboxPhoto.name}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-white/90">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {lightboxPhoto.itemName}
              </p>
              <p className="truncate text-xs text-white/60">
                {lightboxPhoto.name} · {lightboxIndex + 1} / {photos.length}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canDownload ? (
                <a
                  href={lightboxPhoto.url}
                  download={lightboxPhoto.name}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              ) : (
                <Link
                  href={loginHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                >
                  <Lock className="h-4 w-4" />
                  Sign in
                </Link>
              )}
              <button
                type="button"
                className="rounded-xl bg-white/10 p-2 hover:bg-white/15"
                onClick={() => setLightboxIndex(null)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
            {lightboxIndex > 0 ? (
              <button
                type="button"
                className="absolute left-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:left-6"
                onClick={() => setLightboxIndex(lightboxIndex - 1)}
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.name}
              className="max-h-full max-w-full object-contain"
            />
            {lightboxIndex < photos.length - 1 ? (
              <button
                type="button"
                className="absolute right-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:right-6"
                onClick={() => setLightboxIndex(lightboxIndex + 1)}
                aria-label="Next photo"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
