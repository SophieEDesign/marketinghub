"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { isImageUrl } from "@/lib/social/platforms";
import { uploadAssetDirect } from "@/lib/upload/client-upload";
import { cn } from "@/lib/utils";

export function AssetUploadField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const data = await uploadAssetDirect(file);
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <label className="label">Asset</label>
      {value && isImageUrl(value) ? (
        <div className="overflow-hidden rounded-xl border border-border bg-sand/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="max-h-40 w-full object-contain"
          />
        </div>
      ) : value ? (
        <p className="truncate rounded-xl border border-border bg-sand/40 px-3 py-2 text-xs text-muted">
          {value}
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
          {uploading ? "Uploading…" : value ? "Replace asset" : "Upload asset"}
        </button>
        {value ? (
          <button
            type="button"
            className="btn-ghost text-[var(--danger)]"
            disabled={uploading}
            onClick={() => onChange("")}
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
        onChange={(e) => onChange(e.target.value)}
        placeholder="Or paste an asset URL…"
      />
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      <p className="text-[11px] text-muted">
        Images, PDF or short video · max 25MB. Shows on the calendar card.
      </p>
    </div>
  );
}
