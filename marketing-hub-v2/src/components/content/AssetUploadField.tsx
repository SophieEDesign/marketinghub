"use client";

import { useRef, useState } from "react";
import { ExternalLink, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import {
  joinAssetUrls,
  parseAssetUrls,
} from "@/lib/data/normalize";
import { isImageUrl } from "@/lib/social/platforms";
import { uploadAssetDirect } from "@/lib/upload/client-upload";
import { cn } from "@/lib/utils";

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
  hint = "Images, PDF or short video · max 25MB. Shows on the calendar card.",
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
      <div className="space-y-2">
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
          accept="image/*,.pdf,video/mp4,video/quicktime"
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
        {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="label">{fieldLabel}</label>

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
            : urls.length
              ? "Add asset"
              : "Upload asset"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,video/mp4,video/quicktime"
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
      {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}
