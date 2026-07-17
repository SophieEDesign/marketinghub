"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Lock,
  Upload,
  X,
} from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/PageHeader";
import {
  GALLERY_CATEGORY,
  MEDIA_HUB_CATEGORIES,
  normalizeGalleryVisibility,
  type GalleryFolderVisibility,
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

const UNSORTED_SUBFOLDER = "Unsorted";
const NEW_FOLDER_VALUE = "__new_folder__";
const NEW_SUBFOLDER_VALUE = "__new_subfolder__";
const MEDIA_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/quicktime,.jpg,.jpeg,.png,.webp,.gif,.pdf,.mp4,.mov";
/** Keep in sync with /api/content/upload MAX_BYTES */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function isAcceptedMediaFile(file: File) {
  if (
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    file.type === "video/mp4" ||
    file.type === "video/quicktime"
  ) {
    return true;
  }
  return /\.(png|jpe?g|gif|webp|svg|pdf|mp4|mov)$/i.test(file.name);
}

function filesFromList(list: FileList | File[] | null | undefined): File[] {
  if (!list) return [];
  return Array.from(list).filter(isAcceptedMediaFile);
}

function nameFromFile(file: File) {
  return file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

function formatMb(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

async function readErrorMessage(res: Response, fallback: string) {
  const text = await res.text();
  try {
    const json = JSON.parse(text) as { error?: string };
    if (json.error) return json.error;
  } catch {
    // Non-JSON (e.g. proxy "Request Entity Too Large")
  }
  if (/request entity too large/i.test(text) || res.status === 413) {
    return `File too large for the server (max about ${formatMb(MAX_UPLOAD_BYTES)} each). Try fewer or smaller images.`;
  }
  return text.trim().slice(0, 180) || fallback;
}

function itemDisplayName(item: MediaListItem) {
  return item.display_name || item.public_title || item.name;
}

function isImageFile(file: MediaFile) {
  return (
    file.type.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name)
  );
}

function isGalleryCategory(name: string | null | undefined) {
  return (name ?? "").trim().toLowerCase() === GALLERY_CATEGORY.toLowerCase();
}

function itemSubfolder(item: MediaListItem) {
  return item.subfolder?.trim() || UNSORTED_SUBFOLDER;
}

function itemFolderVisibility(item: MediaListItem): GalleryFolderVisibility {
  return normalizeGalleryVisibility(item.subfolder_visibility);
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
  category: GALLERY_CATEGORY,
  subfolder: "",
  subfolder_visibility: "internal" as GalleryFolderVisibility,
  document_link: "",
  notes: "",
};

export function MediaGallery({
  title = "Media",
  description = "Browse brand assets in a gallery-style collection view.",
  showStaffChrome = true,
  initialCanDownload = false,
  hideHeader = false,
  /** Public gallery: Logos, Presentations, Gallery. Staff library: all categories. */
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
  const [activeSubfolder, setActiveSubfolder] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [folderMode, setFolderMode] = useState<"existing" | "new">("existing");
  const [newFolderName, setNewFolderName] = useState("");
  const [subfolderMode, setSubfolderMode] = useState<"existing" | "new">(
    "existing"
  );
  const [newSubfolderName, setNewSubfolderName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const categories = useMemo(() => data?.categories ?? [], [data?.categories]);

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

  const galleryItems = useMemo(
    () => items.filter((i) => isGalleryCategory(i.category)),
    [items]
  );

  const gallerySubfolders = useMemo(() => {
    const names = Array.from(
      new Set(galleryItems.map((i) => itemSubfolder(i)))
    ).sort((a, b) => {
      if (a === UNSORTED_SUBFOLDER) return 1;
      if (b === UNSORTED_SUBFOLDER) return -1;
      return a.localeCompare(b);
    });
    return names.map((name) => {
      const inFolder = galleryItems.filter((i) => itemSubfolder(i) === name);
      const photos = photosFromItems(inFolder);
      const visibility: GalleryFolderVisibility = inFolder.every(
        (i) => itemFolderVisibility(i) === "public"
      )
        ? "public"
        : "internal";
      return {
        name,
        photos,
        cover: photos[0]?.url ?? null,
        photoCount: photos.length,
        assetCount: inFolder.length,
        visibility,
      };
    });
  }, [galleryItems]);

  const knownSubfolders = useMemo(() => {
    return Array.from(
      new Set(
        galleryItems
          .map((i) => i.subfolder?.trim())
          .filter((s): s is string => !!s)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [galleryItems]);

  const inGallery = isGalleryCategory(collection);
  const showingGallerySubfolders = inGallery && !activeSubfolder;

  const visibleItems = useMemo(() => {
    if (!collection) return [];
    const inCat = items.filter((i) => i.category === collection);
    if (!inGallery) return inCat;
    if (!activeSubfolder) return inCat;
    return inCat.filter((i) => itemSubfolder(i) === activeSubfolder);
  }, [items, collection, inGallery, activeSubfolder]);

  const photos = useMemo(
    () => photosFromItems(visibleItems),
    [visibleItems]
  );
  const docs = useMemo(
    () =>
      visibleItems.filter(
        (i) =>
          i.document_link ||
          i.document_url ||
          i.files.some((f) => !isImageFile(f))
      ),
    [visibleItems]
  );
  const lightboxPhoto =
    lightboxIndex != null ? photos[lightboxIndex] ?? null : null;

  const formIsGallery = isGalleryCategory(
    folderMode === "new" ? newFolderName : form.category
  );

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

  const folderOptions = useMemo(() => {
    return Array.from(
      new Set([
        ...MEDIA_HUB_CATEGORIES,
        ...categories,
      ])
    ).sort((a, b) => a.localeCompare(b));
  }, [categories]);

  function resetForm(preferredFolder?: string | null, preferredSubfolder?: string | null) {
    const subfolder =
      preferredSubfolder && preferredSubfolder !== UNSORTED_SUBFOLDER
        ? preferredSubfolder
        : "";
    const inherited =
      preferredSubfolder != null
        ? gallerySubfolders.find((sf) => sf.name === preferredSubfolder)
            ?.visibility
        : undefined;
    setForm({
      ...EMPTY_FORM,
      category: preferredFolder || EMPTY_FORM.category,
      subfolder,
      subfolder_visibility: inherited ?? "internal",
    });
    setFolderMode("existing");
    setNewFolderName("");
    setSubfolderMode("existing");
    setNewSubfolderName("");
    setFiles([]);
    setFormError(null);
  }

  function openAddForm() {
    resetForm(collection, activeSubfolder);
    setShowForm(true);
  }

  function addFiles(incoming: File[], openForm = false) {
    if (incoming.length === 0) return;
    if (openForm || showForm) {
      if (!showForm) {
        resetForm(collection, activeSubfolder);
        setShowForm(true);
      }
      setFiles((prev) => {
        const key = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;
        const seen = new Set(prev.map(key));
        const next = [...prev];
        for (const file of incoming) {
          if (seen.has(key(file))) continue;
          seen.add(key(file));
          next.push(file);
        }
        return next;
      });
      setForm((prev) =>
        prev.name.trim()
          ? prev
          : { ...prev, name: nameFromFile(incoming[0]) }
      );
      setFormError(null);
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!allowManage) return;
    setDragActive(true);
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function onDropFiles(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!allowManage) return;
    const dropped = filesFromList(e.dataTransfer.files);
    if (dropped.length === 0) {
      setFormError("Drop images, PDF, or short video files");
      if (!showForm) {
        resetForm(collection, activeSubfolder);
        setShowForm(true);
      }
      return;
    }
    addFiles(dropped, true);
  }

  function openCollection(name: string) {
    setCollection(name);
    setActiveSubfolder(null);
    setLightboxIndex(null);
  }

  async function createMedia() {
    if (!allowManage || saving) return;
    if (!form.name.trim()) {
      setFormError("Name is required");
      return;
    }
    const folderName =
      folderMode === "new" ? newFolderName.trim() : form.category.trim();
    if (!folderName) {
      setFormError(
        folderMode === "new"
          ? "Enter a folder name"
          : "Select a folder"
      );
      return;
    }
    const gallerySelected =
      folderName.toLowerCase() === GALLERY_CATEGORY.toLowerCase();
    const subfolderName = gallerySelected
      ? subfolderMode === "new"
        ? newSubfolderName.trim()
        : form.subfolder.trim()
      : "";
    if (gallerySelected && subfolderMode === "new" && !subfolderName) {
      setFormError("Enter a subfolder name");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const oversized = files.filter((f) => f.size > MAX_UPLOAD_BYTES);
      if (oversized.length > 0) {
        throw new Error(
          `These files are over ${formatMb(MAX_UPLOAD_BYTES)}: ${oversized
            .map((f) => f.name)
            .slice(0, 3)
            .join(", ")}${oversized.length > 3 ? ` +${oversized.length - 3} more` : ""}. Remove them or compress, then save again.`
        );
      }

      const uploaded: {
        url: string;
        name: string;
        type?: string;
        size?: number | null;
      }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const body = new FormData();
        body.append("file", file);
        const uploadRes = await fetch("/api/content/upload", {
          method: "POST",
          body,
        });
        if (!uploadRes.ok) {
          throw new Error(
            await readErrorMessage(
              uploadRes,
              `Upload failed for ${file.name} (${i + 1}/${files.length})`
            )
          );
        }
        const uploadJson = (await uploadRes.json()) as {
          url?: string;
          name?: string;
          error?: string;
        };
        if (!uploadJson.url) {
          throw new Error(
            uploadJson.error || `Upload failed for ${file.name}`
          );
        }
        uploaded.push({
          url: uploadJson.url,
          name: uploadJson.name || file.name,
          type: file.type,
          size: file.size,
        });
      }

      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          public_title: form.public_title,
          category: folderName,
          subfolder: subfolderName,
          subfolder_visibility: gallerySelected
            ? form.subfolder_visibility
            : undefined,
          document_link: form.document_link,
          notes: form.notes,
          files: uploaded.length > 0 ? uploaded : undefined,
        }),
      });
      if (!res.ok) {
        throw new Error(
          await readErrorMessage(res, "Could not save media")
        );
      }

      if (gallerySelected) {
        await fetch("/api/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "set_subfolder_visibility",
            subfolder: subfolderName,
            visibility: form.subfolder_visibility,
          }),
        });
      }

      setShowForm(false);
      resetForm();
      setCollection(folderName);
      setActiveSubfolder(
        gallerySelected ? subfolderName || UNSORTED_SUBFOLDER : null
      );
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

  async function setSubfolderVisibility(
    folderName: string,
    visibility: GalleryFolderVisibility
  ) {
    if (!allowManage || visibilitySaving) return;
    setVisibilitySaving(folderName);
    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_subfolder_visibility",
          subfolder:
            folderName === UNSORTED_SUBFOLDER ? "" : folderName,
          visibility,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not update visibility");
      await load();
    } catch (e) {
      window.alert(
        e instanceof Error ? e.message : "Could not update visibility"
      );
    } finally {
      setVisibilitySaving(null);
    }
  }

  const manageActions = allowManage ? (
    <button
      type="button"
      className="btn-primary"
      onClick={openAddForm}
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
    <div
      onDragEnter={allowManage ? onDragOver : undefined}
      onDragOver={allowManage ? onDragOver : undefined}
      onDragLeave={allowManage ? onDragLeave : undefined}
      onDrop={allowManage ? onDropFiles : undefined}
    >
      {header}

      {allowManage && dragActive ? (
        <div className="pointer-events-none mb-5 flex items-center justify-center rounded-2xl border-2 border-dashed border-brand bg-brand/5 px-4 py-10 text-center">
          <div>
            <Upload className="mx-auto h-8 w-8 text-brand" />
            <p className="mt-2 text-sm font-medium text-brand">
              Drop files to add media
            </p>
            <p className="mt-1 text-xs text-muted">
              Images, PDF, or short video
            </p>
          </div>
        </div>
      ) : null}

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
            <label className="label">Folder</label>
            <select
              className="field"
              value={folderMode === "new" ? NEW_FOLDER_VALUE : form.category}
              onChange={(e) => {
                const value = e.target.value;
                if (value === NEW_FOLDER_VALUE) {
                  setFolderMode("new");
                  return;
                }
                setFolderMode("existing");
                setForm({ ...form, category: value, subfolder: "" });
                setSubfolderMode("existing");
                setNewSubfolderName("");
              }}
            >
              {folderOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={NEW_FOLDER_VALUE}>+ Add new folder…</option>
            </select>
            {folderMode === "new" ? (
              <input
                className="field mt-2"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="New folder name"
                autoFocus
              />
            ) : null}
          </div>
          {formIsGallery ? (
            <div>
              <label className="label">Gallery subfolder</label>
              <select
                className="field"
                value={
                  subfolderMode === "new"
                    ? NEW_SUBFOLDER_VALUE
                    : form.subfolder || ""
                }
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === NEW_SUBFOLDER_VALUE) {
                    setSubfolderMode("new");
                    setForm({
                      ...form,
                      subfolder: "",
                      subfolder_visibility: "internal",
                    });
                    return;
                  }
                  setSubfolderMode("existing");
                  const folderKey = value || UNSORTED_SUBFOLDER;
                  const inherited = gallerySubfolders.find(
                    (sf) => sf.name === folderKey
                  )?.visibility;
                  setForm({
                    ...form,
                    subfolder: value,
                    subfolder_visibility: inherited ?? "internal",
                  });
                }}
              >
                <option value="">Unsorted</option>
                {knownSubfolders.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value={NEW_SUBFOLDER_VALUE}>+ Add new subfolder…</option>
              </select>
              {subfolderMode === "new" ? (
                <input
                  className="field mt-2"
                  value={newSubfolderName}
                  onChange={(e) => setNewSubfolderName(e.target.value)}
                  placeholder="e.g. Yacht loads, Events"
                  autoFocus
                />
              ) : (
                <p className="mt-1 text-xs text-muted">
                  Sort images into a subfolder under Gallery
                </p>
              )}
            </div>
          ) : (
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
          )}
          {formIsGallery ? (
            <div>
              <label className="label">Folder visibility</label>
              <div
                className="inline-flex w-full rounded-xl border border-border bg-sand/60 p-1"
                role="group"
                aria-label="Folder visibility"
              >
                {(
                  [
                    { id: "public", label: "Public", icon: Globe },
                    { id: "internal", label: "Internal", icon: Lock },
                  ] as const
                ).map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition",
                        form.subfolder_visibility === option.id
                          ? "bg-white text-brand shadow-sm"
                          : "text-muted hover:text-foreground"
                      )}
                      onClick={() =>
                        setForm({
                          ...form,
                          subfolder_visibility: option.id,
                        })
                      }
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted">
                Public folders appear on the external media gallery. Internal
                stay staff-only.
              </p>
            </div>
          ) : null}
          {formIsGallery ? (
            <div className="md:col-span-2">
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
          ) : null}
          <div className="md:col-span-2">
            <label className="label">Upload images</label>
            <div
              role="button"
              tabIndex={0}
              className={cn(
                "cursor-pointer rounded-2xl border-2 border-dashed px-4 py-8 text-center transition",
                dragActive
                  ? "border-brand bg-brand/5"
                  : "border-border bg-sand/30 hover:border-brand/40 hover:bg-sand/50"
              )}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragEnter={onDragOver}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDropFiles}
            >
              <Upload
                className={cn(
                  "mx-auto h-7 w-7",
                  dragActive ? "text-brand" : "text-muted"
                )}
              />
              <p className="mt-2 text-sm font-medium text-brand">
                Drag &amp; drop files here
              </p>
              <p className="mt-1 text-xs text-muted">
                Drop a folder of images or pick multiple files · max{" "}
                {formatMb(MAX_UPLOAD_BYTES)} each
              </p>
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                multiple
                accept={MEDIA_ACCEPT}
                onChange={(e) => {
                  addFiles(filesFromList(e.target.files));
                  e.target.value = "";
                }}
              />
            </div>
            {files.length > 0 ? (
              <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-white">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">{file.name}</span>
                    <button
                      type="button"
                      className="btn-ghost shrink-0 px-2 py-1 text-xs text-[var(--danger)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFiles((prev) => prev.filter((_, i) => i !== index));
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
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
              {saving
                ? files.length > 1
                  ? `Uploading ${files.length} files…`
                  : "Saving…"
                : "Save"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={saving}
              onClick={() => {
                setShowForm(false);
                resetForm();
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
            Folders
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((col) => (
              <button
                key={col.name}
                type="button"
                onClick={() => openCollection(col.name)}
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
              title="No folders yet"
              description={
                allowManage
                  ? "Add media to create your first folder."
                  : "Add rows to Media Links Resources in Supabase."
              }
            />
          ) : null}
        </div>
      ) : showingGallerySubfolders ? (
        <div>
          <div className="mb-6">
            <button
              type="button"
              className="mb-2 text-sm text-muted transition hover:text-brand"
              onClick={() => {
                setCollection(null);
                setActiveSubfolder(null);
                setLightboxIndex(null);
              }}
            >
              ← All folders
            </button>
            <h2 className="font-display text-3xl text-brand md:text-4xl">
              Gallery
            </h2>
            <p className="mt-1 text-sm text-muted">
              Choose a subfolder to browse images
              {allowManage
                ? " — set each folder Public (external) or Internal (staff)"
                : ""}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {gallerySubfolders.map((sf) => (
              <div
                key={sf.name}
                className="group overflow-hidden rounded-2xl border border-border bg-white text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubfolder(sf.name);
                    setLightboxIndex(null);
                  }}
                  className="block w-full text-left"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#f0f2f3]">
                    {sf.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sf.cover}
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
                        {sf.name}
                      </p>
                      <p className="mt-0.5 text-xs text-white/80">
                        {sf.photoCount > 0
                          ? `${sf.photoCount} photo${sf.photoCount === 1 ? "" : "s"}`
                          : `${sf.assetCount} asset${sf.assetCount === 1 ? "" : "s"}`}
                        {" · "}
                        {sf.visibility === "public" ? "Public" : "Internal"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        sf.visibility === "public"
                          ? "bg-white/90 text-brand"
                          : "bg-black/50 text-white"
                      )}
                    >
                      {sf.visibility === "public" ? (
                        <Globe className="h-3 w-3" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                      {sf.visibility}
                    </span>
                  </div>
                </button>
                {allowManage ? (
                  <div className="flex border-t border-border p-1">
                    {(
                      [
                        { id: "public", label: "Public" },
                        { id: "internal", label: "Internal" },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={visibilitySaving === sf.name}
                        className={cn(
                          "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition",
                          sf.visibility === option.id
                            ? "bg-accent-soft text-brand"
                            : "text-muted hover:text-foreground"
                        )}
                        onClick={() =>
                          setSubfolderVisibility(sf.name, option.id)
                        }
                      >
                        {visibilitySaving === sf.name &&
                        sf.visibility !== option.id
                          ? "…"
                          : option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {gallerySubfolders.length === 0 ? (
            <EmptyState
              title="No Gallery subfolders yet"
              description={
                allowManage
                  ? "Add media with Folder = Gallery and create a subfolder to sort images."
                  : "Gallery images will appear here once sorted into subfolders."
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
                  if (inGallery && activeSubfolder) {
                    setActiveSubfolder(null);
                    setLightboxIndex(null);
                    return;
                  }
                  setCollection(null);
                  setActiveSubfolder(null);
                  setLightboxIndex(null);
                }}
              >
                {inGallery && activeSubfolder
                  ? "← Gallery subfolders"
                  : "← All folders"}
              </button>
              <h2 className="font-display text-3xl text-brand md:text-4xl">
                {inGallery && activeSubfolder
                  ? activeSubfolder
                  : collection}
              </h2>
              {inGallery && activeSubfolder ? (
                <p className="mt-0.5 text-xs text-muted">Gallery / {activeSubfolder}</p>
              ) : null}
              <p className="mt-1 text-sm text-muted">
                {photos.length > 0
                  ? `${photos.length} photo${photos.length === 1 ? "" : "s"}`
                  : "Documents & links"}
                {canDownload ? " · Click a photo to preview & download" : ""}
              </p>
              {allowManage && inGallery && activeSubfolder ? (
                <div
                  className="mt-3 inline-flex rounded-xl border border-border bg-sand/60 p-1"
                  role="group"
                  aria-label="Folder visibility"
                >
                  {(
                    [
                      { id: "public", label: "Public" },
                      { id: "internal", label: "Internal" },
                    ] as const
                  ).map((option) => {
                    const current =
                      gallerySubfolders.find((sf) => sf.name === activeSubfolder)
                        ?.visibility ?? "internal";
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={visibilitySaving === activeSubfolder}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                          current === option.id
                            ? "bg-white text-brand shadow-sm"
                            : "text-muted hover:text-foreground"
                        )}
                        onClick={() =>
                          setSubfolderVisibility(activeSubfolder, option.id)
                        }
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
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

          {docs.length > 0 ? (
            <div className={cn(photos.length > 0 && "mt-10")}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Files &amp; links
              </h3>
              <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
                {docs.map((item) => (
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

          {photos.length === 0 && docs.length === 0 ? (
            <EmptyState
              title="Empty folder"
              description="No photos or files in this folder yet."
            />
          ) : null}

          {allowManage && visibleItems.length > 0 ? (
            <div className="mt-10">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Manage assets
              </h3>
              <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
                {visibleItems.map((item) => (
                    <li
                      key={`manage-${item.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted">
                          {item.subfolder
                            ? `Subfolder: ${item.subfolder}`
                            : item.public_title && item.public_title !== item.name
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
