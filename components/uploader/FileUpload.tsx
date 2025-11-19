"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface FileUploadProps {
  recordId: string;
  onUploadComplete?: (url: string) => void;
}

export default function FileUpload({ recordId, onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load existing attachments when recordId changes
  useEffect(() => {
    if (!recordId) return;

    async function loadAttachments() {
      const { data } = await supabase
        .from("content")
        .select("attachments, thumbnail_url")
        .eq("id", recordId)
        .single();

      if (data) {
        const attachments = data.attachments || [];
        const thumbnail = data.thumbnail_url ? [data.thumbnail_url] : [];
        setUploadedFiles([...thumbnail, ...attachments]);
      }
    }

    loadAttachments();
  }, [recordId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !recordId) {
      setError("No file selected or record ID missing");
      return;
    }

    // Validate file size (10MB limit for attachments)
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      e.target.value = "";
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "bin";
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filePath = `content/${recordId}/${fileName}`;

      console.log("Uploading file:", { fileName, filePath, size: file.size, type: file.type });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(filePath, file, {
          contentType: file.type || "application/octet-stream",
        });

      if (uploadError) {
        const errorMsg = uploadError.message || "";
        console.error("Upload error details:", {
          message: errorMsg,
          error: uploadError,
        });

        let errorMessage = "Failed to upload file";
        if (errorMsg.includes("Bucket not found") || errorMsg.includes("The resource was not found")) {
          errorMessage = "Storage bucket 'attachments' not found. Please create it in Supabase Storage → Storage → New bucket (name: 'attachments', make it Public).";
        } else if (errorMsg.includes("new row violates row-level security") || errorMsg.includes("RLS")) {
          errorMessage = "Permission denied. Please check RLS policies for the 'attachments' bucket. Go to Storage → attachments → Policies and ensure INSERT is allowed.";
        } else if (errorMsg.includes("403") || errorMsg.includes("Forbidden")) {
          errorMessage = "Access forbidden. The 'attachments' bucket may not be public or RLS policies are blocking uploads.";
        } else if (errorMsg.includes("401") || errorMsg.includes("Unauthorized")) {
          errorMessage = "Authentication failed. Please check your Supabase credentials.";
        } else {
          errorMessage = `Upload failed: ${errorMsg || "Unknown error"}`;
        }

        setError(errorMessage);
        setUploading(false);
        e.target.value = "";
        return;
      }

      if (!uploadData) {
        setError("Upload succeeded but no data returned");
        setUploading(false);
        e.target.value = "";
        return;
      }

      console.log("Upload successful:", uploadData);

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("attachments").getPublicUrl(filePath);

      console.log("Public URL:", publicUrl);

      if (!publicUrl) {
        setError("Failed to get public URL for uploaded file");
        setUploading(false);
        e.target.value = "";
        return;
      }

      // Update content record with attachment URL
      // Try attachments column first, fallback to thumbnail_url if it's an image
      const { data: contentData, error: fetchError } = await supabase
        .from("content")
        .select("attachments, thumbnail_url")
        .eq("id", recordId)
        .single();

      if (fetchError) {
        console.error("Error fetching content:", fetchError);
        setError("Failed to load content record");
        setUploading(false);
        e.target.value = "";
        return;
      }

      const isImage = file.type?.startsWith("image/");
      const existingAttachments = contentData?.attachments || [];
      const updatedAttachments = [...existingAttachments, publicUrl];

      // Update both attachments array and thumbnail_url if it's an image and no thumbnail exists
      const updateData: any = { attachments: updatedAttachments };
      if (isImage && !contentData?.thumbnail_url) {
        updateData.thumbnail_url = publicUrl;
      }

      const { error: updateError } = await supabase
        .from("content")
        .update(updateData)
        .eq("id", recordId);

      if (updateError) {
        console.error("Error updating content:", updateError);
        setError(`File uploaded but failed to update record: ${updateError.message}`);
        setUploading(false);
        e.target.value = "";
        return;
      }

      // Success!
      setUploadedFiles((prev) => [...prev, publicUrl]);
      if (onUploadComplete) {
        onUploadComplete(publicUrl);
      }
      
      // Reload page to show new attachment
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      setError(error?.message || "An unexpected error occurred");
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm opacity-70 block mb-1">Attachments</label>
      <input
        type="file"
        onChange={handleFileUpload}
        disabled={uploading || !recordId}
        className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {uploading && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Uploading...
        </div>
      )}
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
          {error}
          <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">
            Check browser console (F12) for details
          </div>
        </div>
      )}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {uploadedFiles.length} attachment(s)
          </div>
          <div className="flex flex-wrap gap-2">
            {uploadedFiles.map((url, idx) => {
              const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
              return (
                <div key={idx} className="relative">
                  {isImage ? (
                    <img
                      src={url}
                      alt={`Attachment ${idx + 1}`}
                      className="h-20 w-20 object-cover rounded border border-gray-300 dark:border-gray-700"
                      onError={(e) => {
                        // Fallback to link if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline p-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 block"
                    >
                      📎 File {idx + 1}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

