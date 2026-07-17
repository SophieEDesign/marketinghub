"use client";

import { Download, ExternalLink, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  GALLERY_CATEGORY,
  MEDIA_HUB_CATEGORIES,
  type GalleryFolderVisibility,
  type MediaListItem,
} from "@/lib/supabase/media-list";
import { cn } from "@/lib/utils";

const NEW_SUBFOLDER_VALUE = "__new_subfolder__";

function isImageFile(file: { url: string; name: string; type: string }) {
  if (file.type.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name || file.url);
}

function formatFileSize(bytes: number | null | undefined) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function formatFileType(file: { name: string; type: string }) {
  const mime = (file.type || "").trim().toLowerCase();
  if (mime.startsWith("image/")) {
    const sub = mime.slice(6);
    if (sub === "jpeg") return "JPEG";
    if (sub === "svg+xml") return "SVG";
    return sub.toUpperCase() || "Image";
  }
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("video/")) {
    const sub = mime.slice(6);
    if (sub === "quicktime") return "MOV";
    return sub.toUpperCase() || "Video";
  }
  const ext = file.name.match(/\.([^.]+)$/)?.[1];
  return ext ? ext.toUpperCase() : mime || "File";
}

function formatFileDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function MediaDetailPanel({
  item,
  focusedFileUrl,
  categories,
  knownSubfolders,
  canEdit = true,
  canDownload = true,
  onClose,
  onSaved,
  onFocusFile,
}: {
  item: MediaListItem;
  focusedFileUrl?: string | null;
  categories: string[];
  knownSubfolders: string[];
  /** Admin: edit + delete. Member: view + download only. */
  canEdit?: boolean;
  canDownload?: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onFocusFile?: (url: string | null) => void;
}) {
  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set([...MEDIA_HUB_CATEGORIES, ...categories, item.category].filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [categories, item.category]);

  const subfolderOptions = useMemo(() => {
    return Array.from(
      new Set(
        [...knownSubfolders, item.subfolder]
          .map((s) => s?.trim())
          .filter((s): s is string => !!s)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [knownSubfolders, item.subfolder]);

  const focusedFile = useMemo(() => {
    if (!item.files.length) return null;
    if (focusedFileUrl) {
      return item.files.find((f) => f.url === focusedFileUrl) ?? item.files[0];
    }
    return item.files.find(isImageFile) ?? item.files[0];
  }, [item.files, focusedFileUrl]);

  const [itemName, setItemName] = useState(item.name);
  const [publicTitle, setPublicTitle] = useState(item.public_title);
  const [notes, setNotes] = useState(item.notes);
  const [documentLink, setDocumentLink] = useState(item.document_link);
  const [category, setCategory] = useState(item.category || GALLERY_CATEGORY);
  const [categoryMode, setCategoryMode] = useState<"existing" | "new">(
    "existing"
  );
  const [newCategory, setNewCategory] = useState("");
  const [subfolder, setSubfolder] = useState(item.subfolder || "");
  const [subfolderMode, setSubfolderMode] = useState<"existing" | "new">(
    "existing"
  );
  const [newSubfolder, setNewSubfolder] = useState("");
  const [visibility, setVisibility] = useState<GalleryFolderVisibility>(
    item.visibility || "internal"
  );
  const [fileName, setFileName] = useState(focusedFile?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItemName(item.name);
    setPublicTitle(item.public_title);
    setNotes(item.notes);
    setDocumentLink(item.document_link);
    setCategory(item.category || GALLERY_CATEGORY);
    setCategoryMode("existing");
    setNewCategory("");
    setSubfolder(item.subfolder || "");
    setSubfolderMode("existing");
    setNewSubfolder("");
    setVisibility(item.visibility || "internal");
    setError(null);
    // Only reset when switching assets — not on every item object refresh.
  }, [item.id]);

  useEffect(() => {
    // Keep fields in sync after save/reload for the same asset.
    setItemName(item.name);
    setPublicTitle(item.public_title);
    setNotes(item.notes);
    setDocumentLink(item.document_link);
    setVisibility(item.visibility || "internal");
    if (categoryMode !== "new") {
      setCategory(item.category || GALLERY_CATEGORY);
    }
    if (subfolderMode !== "new") {
      setSubfolder(item.subfolder || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid wiping in-progress "add category"
  }, [
    item.name,
    item.public_title,
    item.notes,
    item.document_link,
    item.visibility,
    item.category,
    item.subfolder,
  ]);

  useEffect(() => {
    setFileName(focusedFile?.name ?? "");
  }, [focusedFile?.url, focusedFile?.name]);

  const isGallery =
    (categoryMode === "new" ? newCategory : category)
      .trim()
      .toLowerCase() === GALLERY_CATEGORY.toLowerCase();

  async function save() {
    if (!canEdit || saving) return;
    setSaving(true);
    setError(null);
    try {
      const resolvedCategory =
        categoryMode === "new" ? newCategory.trim() : category.trim();
      if (!resolvedCategory) throw new Error("Category is required");
      if (!itemName.trim()) throw new Error("Asset name is required");

      const resolvedSubfolder = isGallery
        ? subfolderMode === "new"
          ? newSubfolder.trim()
          : subfolder.trim()
        : "";

      if (
        focusedFile &&
        fileName.trim() &&
        fileName.trim() !== focusedFile.name
      ) {
        const res = await fetch("/api/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rename_file",
            id: item.id,
            fileUrl: focusedFile.url,
            newName: fileName.trim(),
          }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(json.error || "Could not rename file");
      }

      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: item.id,
          name: itemName,
          public_title: publicTitle,
          notes,
          category: resolvedCategory,
          subfolder: resolvedSubfolder,
          document_link: documentLink,
          visibility,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not save");
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function deleteFile() {
    if (!canEdit || saving || !focusedFile) return;
    if (!window.confirm("Delete this file from the asset?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_file",
          id: item.id,
          fileUrl: focusedFile.url,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        deletedItem?: boolean;
      };
      if (!res.ok) throw new Error(json.error || "Could not delete");
      await onSaved();
      if (json.deletedItem) onClose();
      else onFocusFile?.(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAsset() {
    if (!canEdit || saving) return;
    if (
      !window.confirm(
        "Delete this whole media asset (all files in this set)?"
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: item.id }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not delete");
      await onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = useMemo(() => {
    if (focusedFile && isImageFile(focusedFile)) return focusedFile.url;
    const cover = item.files.find(isImageFile);
    return cover?.url ?? null;
  }, [focusedFile, item.files]);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/20 md:left-sidebar"
        aria-label="Close media details"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={canEdit ? "Edit media" : "Media details"}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-brand">
              {canEdit ? "Edit media" : "Media details"}
            </p>
            <p className="truncate text-xs text-muted">
              {item.name || "Untitled asset"}
            </p>
          </div>
          <button
            type="button"
            className="rounded-xl p-2 text-muted hover:bg-sand/60 hover:text-brand"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {previewUrl ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-[#f0f2f3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={fileName || itemName}
                className="max-h-56 w-full object-contain"
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-sand/40 px-4 py-8 text-center text-sm text-muted">
              {focusedFile?.name ||
                item.document_link ||
                "No image preview for this asset"}
            </div>
          )}

          {focusedFile ? (
            <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-border bg-sand/40 px-3 py-2.5 text-xs">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Date
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {formatFileDate(item.created_at) ||
                    formatFileDate(item.updated_at) ||
                    "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Type
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {formatFileType(focusedFile)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Size
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {formatFileSize(focusedFile.size) || "—"}
                </dd>
              </div>
            </dl>
          ) : item.created_at || item.updated_at ? (
            <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-border bg-sand/40 px-3 py-2.5 text-xs">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Date
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {formatFileDate(item.created_at) ||
                    formatFileDate(item.updated_at) ||
                    "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Type
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">Link</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Size
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">—</dd>
              </div>
            </dl>
          ) : null}

          {item.files.length > 1 ? (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Files in this asset
              </p>
              <ul className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-border bg-sand/30 p-1.5">
                {item.files.map((file) => (
                  <li key={file.url}>
                    <button
                      type="button"
                      className={cn(
                        "w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs transition",
                        focusedFile?.url === file.url
                          ? "bg-white font-medium text-brand shadow-sm"
                          : "text-muted hover:bg-white/70 hover:text-foreground"
                      )}
                      onClick={() => onFocusFile?.(file.url)}
                    >
                      {file.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {focusedFile ? (
              <div>
                <label className="label">File name</label>
                <input
                  className="field"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  readOnly={!canEdit}
                  disabled={!canEdit}
                />
              </div>
            ) : null}
            <div>
              <label className="label">Asset name (internal)</label>
              <input
                className="field"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                readOnly={!canEdit}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="label">Public title</label>
              <input
                className="field"
                value={publicTitle}
                onChange={(e) => setPublicTitle(e.target.value)}
                placeholder="Shown externally (optional)"
                readOnly={!canEdit}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="label">Category</label>
              {canEdit ? (
                <div className="space-y-2">
                  {categoryMode === "new" ? (
                    <>
                      <input
                        className="field"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="New category name"
                        autoFocus
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-ghost px-2.5 py-1.5 text-xs"
                          onClick={() => {
                            setCategoryMode("existing");
                            setNewCategory("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                      <p className="text-xs text-muted">
                        Saves as a new category when you click Save
                      </p>
                    </>
                  ) : (
                    <>
                      <select
                        className="field"
                        value={
                          categoryOptions.includes(category)
                            ? category
                            : category || GALLERY_CATEGORY
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          setCategory(value);
                          if (
                            value.toLowerCase() !==
                            GALLERY_CATEGORY.toLowerCase()
                          ) {
                            setSubfolder("");
                            setSubfolderMode("existing");
                            setNewSubfolder("");
                          }
                        }}
                      >
                        {!categoryOptions.includes(category) && category ? (
                          <option value={category}>{category}</option>
                        ) : null}
                        {categoryOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-secondary w-full px-2.5 py-1.5 text-xs"
                        onClick={() => {
                          setCategoryMode("new");
                          setNewCategory("");
                          setSubfolder("");
                          setSubfolderMode("existing");
                          setNewSubfolder("");
                        }}
                      >
                        + Add new category
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <p className="field bg-sand/40 text-sm">{category || "—"}</p>
              )}
            </div>
            {isGallery ? (
              <div>
                <label className="label">Gallery subfolder</label>
                {canEdit ? (
                  <>
                    <select
                      className="field"
                      value={
                        subfolderMode === "new"
                          ? NEW_SUBFOLDER_VALUE
                          : subfolder || ""
                      }
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === NEW_SUBFOLDER_VALUE) {
                          setSubfolderMode("new");
                          return;
                        }
                        setSubfolderMode("existing");
                        setSubfolder(value);
                      }}
                    >
                      <option value="">Unsorted</option>
                      {subfolderOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value={NEW_SUBFOLDER_VALUE}>
                        + Add new subfolder…
                      </option>
                    </select>
                    {subfolderMode === "new" ? (
                      <input
                        className="field mt-2"
                        value={newSubfolder}
                        onChange={(e) => setNewSubfolder(e.target.value)}
                        placeholder="e.g. Catamaran"
                        autoFocus
                      />
                    ) : null}
                  </>
                ) : (
                  <p className="field bg-sand/40 text-sm">
                    {subfolder || "Unsorted"}
                  </p>
                )}
              </div>
            ) : null}
            <div>
              <label className="label">Visibility</label>
              {canEdit ? (
                <>
                  <div
                    className="inline-flex rounded-xl border border-border bg-sand/60 p-1"
                    role="group"
                    aria-label="Item visibility"
                  >
                    {(
                      [
                        { id: "public", label: "Public" },
                        { id: "internal", label: "Internal" },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                          visibility === option.id
                            ? "bg-white text-brand shadow-sm"
                            : "text-muted hover:text-foreground"
                        )}
                        onClick={() => setVisibility(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {isGallery && item.subfolder_visibility === "public" ? (
                    <p className="mt-1 text-xs text-muted">
                      Overrides the folder when set to Internal. If the folder
                      is set to Internal, all files become Internal.
                    </p>
                  ) : isGallery && item.subfolder_visibility === "internal" ? (
                    <p className="mt-1 text-xs text-muted">
                      Folder is Internal — this file stays hidden externally
                      until the folder is Public.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted">
                      Public appears on the external media gallery
                    </p>
                  )}
                </>
              ) : (
                <p className="field bg-sand/40 text-sm capitalize">
                  {visibility}
                  {isGallery &&
                  item.subfolder_visibility === "public" &&
                  visibility === "internal"
                    ? " (overrides public folder)"
                    : ""}
                </p>
              )}
            </div>
            <div>
              <label className="label">Document / link</label>
              <input
                className="field"
                value={documentLink}
                onChange={(e) => setDocumentLink(e.target.value)}
                placeholder="https://…"
                readOnly={!canEdit}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea
                className="field min-h-[80px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                readOnly={!canEdit}
                disabled={!canEdit}
              />
            </div>
            {error ? (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 border-t border-border p-4">
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <button
                type="button"
                className={cn("btn-primary", saving && "opacity-70")}
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            ) : null}
            {focusedFile && canDownload ? (
              <a
                href={focusedFile.url}
                download={fileName || focusedFile.name}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            ) : documentLink && canDownload ? (
              <a
                href={documentLink}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
              >
                Open link
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
            <button
              type="button"
              className="btn-secondary"
              disabled={saving}
              onClick={onClose}
            >
              Close
            </button>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              {focusedFile ? (
                <button
                  type="button"
                  className="btn-ghost text-[var(--danger)]"
                  disabled={saving}
                  onClick={() => void deleteFile()}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete file
                </button>
              ) : null}
              <button
                type="button"
                className="btn-ghost text-[var(--danger)]"
                disabled={saving}
                onClick={() => void deleteAsset()}
              >
                Delete asset
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
