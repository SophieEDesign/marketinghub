"use client";

import { Download, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { MediaListItem } from "@/lib/supabase/media-list";
import { cn } from "@/lib/utils";

export type SelectedMediaFile = {
  itemId: string;
  url: string;
  fileName: string;
  itemName: string;
  publicTitle: string;
  notes: string;
};

export function MediaDetailPanel({
  selected,
  item,
  onClose,
  onSaved,
}: {
  selected: SelectedMediaFile;
  item: MediaListItem | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [fileName, setFileName] = useState(selected.fileName);
  const [itemName, setItemName] = useState(selected.itemName);
  const [publicTitle, setPublicTitle] = useState(selected.publicTitle);
  const [notes, setNotes] = useState(selected.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFileName(selected.fileName);
    setItemName(selected.itemName);
    setPublicTitle(selected.publicTitle);
    setNotes(selected.notes);
    setError(null);
  }, [selected]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      if (fileName.trim() && fileName.trim() !== selected.fileName) {
        const res = await fetch("/api/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rename_file",
            id: selected.itemId,
            fileUrl: selected.url,
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
          id: selected.itemId,
          name: itemName,
          public_title: publicTitle,
          notes,
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
    if (saving) return;
    if (!window.confirm("Delete this image from the gallery?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_file",
          id: selected.itemId,
          fileUrl: selected.url,
        }),
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

  async function deleteAsset() {
    if (saving) return;
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
        body: JSON.stringify({ action: "delete", id: selected.itemId }),
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

  const fileCount = item?.files.length ?? 0;

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
        aria-label="Media details"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-brand">
              Media details
            </p>
            <p className="truncate text-xs text-muted">{selected.fileName}</p>
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
          <div className="overflow-hidden rounded-2xl border border-border bg-[#f0f2f3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.url}
              alt={fileName}
              className="max-h-64 w-full object-contain"
            />
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="label">File name</label>
              <input
                className="field"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Asset name (internal)</label>
              <input
                className="field"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Public title</label>
              <input
                className="field"
                value={publicTitle}
                onChange={(e) => setPublicTitle(e.target.value)}
                placeholder="Shown externally (optional)"
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea
                className="field min-h-[80px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {fileCount > 1 ? (
              <p className="text-xs text-muted">
                This asset has {fileCount} files. Renaming the asset name
                updates the whole set; delete image removes only this file.
              </p>
            ) : null}
            {error ? (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 border-t border-border p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn("btn-primary", saving && "opacity-70")}
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <a
              href={selected.url}
              download={fileName}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
            <button
              type="button"
              className="btn-secondary"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost text-[var(--danger)]"
              disabled={saving}
              onClick={() => void deleteFile()}
            >
              <Trash2 className="h-4 w-4" />
              Delete image
            </button>
            <button
              type="button"
              className="btn-ghost text-[var(--danger)]"
              disabled={saving}
              onClick={() => void deleteAsset()}
            >
              Delete asset
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
