"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LogoUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload() {
    if (!file) return;

    setUploading(true);
    const filePath = `logo/${file.name}`;

    const { data, error } = await supabase.storage
      .from("branding")
      .upload(filePath, file, { upsert: true });

    if (!error) {
      const url =
        supabase.storage.from("branding").getPublicUrl(filePath).data.publicUrl;

      await supabase
        .from("settings")
        .update({ value: { logo_url: url } })
        .eq("key", "branding");

      alert("Logo uploaded successfully!");
      setFile(null);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } else {
      console.error("Upload error:", error);
      alert("Failed to upload logo");
    }

    setUploading(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium">Upload Logo</label>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="w-full text-sm file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
      />

      <button
        className="rounded bg-blue-600 text-white px-3 py-1 w-max disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={upload}
        disabled={!file || uploading}
      >
        {uploading ? "Uploading..." : "Upload Logo"}
      </button>
    </div>
  );
}

