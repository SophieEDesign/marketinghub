"use client";

import { useState } from "react";
import { useSettings } from "@/lib/useSettings";

export default function LogoUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { updateLogo, mutate } = useSettings();

  async function upload() {
    if (!file) return;

    setUploading(true);
    try {
      await updateLogo(file);
      // Trigger a refresh of the settings cache
      await mutate();
      alert("Logo uploaded successfully! The page will refresh to show the logo.");
      setFile(null);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      // Refresh after a short delay to show the logo
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      console.error("Upload error:", error);
      const errorMessage = error?.message || "Failed to upload logo";
      alert(`${errorMessage}\n\nTroubleshooting:\n1. Check browser console for details\n2. Verify 'branding' bucket exists in Supabase\n3. Ensure bucket is Public or has proper RLS policies\n4. Check file size (max 5MB)`);
    } finally {
      setUploading(false);
    }
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

