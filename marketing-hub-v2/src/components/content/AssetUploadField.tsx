"use client";

import { useRef, useState } from "react";
import { ExternalLink, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import {
  joinAssetUrls,
  parseAssetUrls,
  primaryCanvaUrl,
  primaryImageUrl,
} from "@/lib/data/normalize";
import { isCanvaUrl, isImageUrl } from "@/lib/social/platforms";
import { uploadAssetDirect } from "@/lib/upload/client-upload";
import { UPLOAD_ACCEPT } from "@/lib/upload/allowed-types";
import { cn } from "@/lib/utils";
import { CanvaPreviewTile } from "@/components/content/CanvaPreviewTile";

type SingleProps = {
  multiple?: false;
  value: string;
  onChange: (url: string) => void;
};

type MultiProps = {
  multiple: true;
  value: string;
  onChange: (urlsJoined: string) => void;
};

export function AssetUploadField({
  value,
  onChange,
  multiple = false,
  label,
  hint,
}: {
  label?: string;
  hint?: string;
} & (SingleProps | MultiProps)) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteUrl, setPasteUrl] = useState("");

  const fieldLabel = label ?? (multiple ? "Assets" : "Asset");
  const urls = multiple ? parseAssetUrls(value) : value ? [value] : [];
  const hasCanva = Boolean(primaryCanvaUrl(value));
  const hasImage = Boolean(primaryImageUrl(value));
  const needsPreviewImage = hasCanva && !hasImage;
  const resolvedHint =
    hint ??
    (needsPreviewImage
      ? "Canva link saved — also upload/paste a PNG or JPG so the calendar can show the real design."
      : "Images, PDF, Word, Excel, PowerPoint, CSV or short video · max 25MB. Shows on the calendar card. Paste a Canva link and a preview image together.");

  function commit(next: string[]) {
    const cleaned = parseAssetUrls(next);
    if (multiple) {
      (onChange as MultiProps["onChange"])(joinAssetUrls(cleaned));
    } else {
      (onChange as SingleProps["onChange"])(cleaned[0] ?? "");
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const data = await uploadAssetDirect(file);
      commit(multiple ? [...urls, data.url] : [data.url]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onPasteImage(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      e.preventDefault();
      await onFile(file);
      return;
    }
  }

  function addPastedUrl() {
    const next = pasteUrl.trim();
    if (!next) return;
    commit(multiple ? [...urls, next] : [next]);
    if (multiple) setPasteUrl("");
  }

  function removeAt(index: number) {
    commit(urls.filter((_, i) => i !== index));
  }

  if (!multiple) {
    const single = urls[0] ?? "";
    return (
      <div className="space-y-2" onPaste={(e) => void onPasteImage(e)}>
        <label className="label">{fieldLabel}</label>
        {single && isImageUrl(single) ? (
          <a
            href={single}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-xl border border-border bg-sand/40 transition hover:border-brand/40"
            title="Open asset"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={single}
              alt=""
              className="max-h-40 w-full object-contain"
            />
          </a>
        ) : single && isCanvaUrl(single) ? (
          <a
            href={single}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-xl border border-border transition hover:border-brand/40"
            title="Open in Canva"
          >
            <CanvaPreviewTile url={single} compact={false} />
          </a>
        ) : single ? (
          <a
            href={single}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate rounded-xl border border-border bg-sand/40 px-3 py-2 text-xs text-brand underline-offset-2 hover:underline"
            title="Open asset"
          >
            {single}
          </a>
        ) : null}

        {needsPreviewImage ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
            Private Canva links can’t be previewed automatically. Upload or paste
            (Ctrl+V) a PNG/JPG export for the calendar thumbnail.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn("btn-secondary", uploading && "opacity-70")}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {uploading
              ? "Uploading…"
              : needsPreviewImage
                ? "Upload preview image"
                : single
                  ? "Replace asset"
                  : "Upload asset"}
          </button>
          {single ? (
            <button
              type="button"
              className="btn-ghost text-[var(--danger)]"
              disabled={uploading}
              onClick={() => commit([])}
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          ) : null}
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={UPLOAD_ACCEPT}
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />

        <input
          className="field text-xs"
          value={value}
          onChange={(e) =>
            (onChange as SingleProps["onChange"])(e.target.value)
          }
          placeholder="Or paste an asset URL…"
        />
        {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
        {resolvedHint ? (
          <p className="text-[11px] text-muted">{resolvedHint}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2" onPaste={(e) => void onPasteImage(e)}>
      <label className="label">{fieldLabel}</label>

      {needsPreviewImage ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
          Private Canva links can’t be previewed automatically. Keep the Canva
          link and also upload or paste (Ctrl+V) a PNG/JPG — the calendar uses
          the image.
        </p>
      ) : null}

      {urls.length > 0 ? (
        <ul className="space-y-2">
          {urls.map((url, index) => (
            <li
              key={`${url}-${index}`}
              className="flex items-start gap-2 rounded-xl border border-border bg-sand/40 p-2"
            >
              {isImageUrl(url) ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-white"
                  title="Open asset"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </a>
              ) : isCanvaUrl(url) ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border"
                  title="Open in Canva"
                >
                  <CanvaPreviewTile
                    url={url}
                    compact
                    className="aspect-auto h-full rounded-lg"
                  />
                </a>
              ) : (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-brand"
                  title="Open asset"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate pt-1 text-xs text-brand underline-offset-2 hover:underline"
                title={url}
              >
                {url}
              </a>
              <button
                type="button"
                className="btn-ghost shrink-0 text-[var(--danger)]"
                disabled={uploading}
                onClick={() => removeAt(index)}
                title="Remove asset"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn("btn-secondary", uploading && "opacity-70")}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : urls.length > 0 ? (
            <Plus className="h-4 w-4" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
          {uploading
            ? "Uploading…"
            : needsPreviewImage
              ? "Add preview image"
              : urls.length
                ? "Add asset"
                : "Upload asset"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={UPLOAD_ACCEPT}
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />

      <div className="flex gap-2">
        <input
          className="field flex-1 text-xs"
          value={pasteUrl}
          onChange={(e) => setPasteUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addPastedUrl();
            }
          }}
          placeholder="Or paste an asset URL and press Enter…"
        />
        <button
          type="button"
          className="btn-secondary shrink-0"
          disabled={!pasteUrl.trim() || uploading}
          onClick={addPastedUrl}
        >
          Add
        </button>
      </div>

      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      {resolvedHint ? (
        <p className="text-[11px] text-muted">{resolvedHint}</p>
      ) : null}
    </div>
  );
}
