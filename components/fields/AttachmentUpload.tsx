"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface AttachmentUploadProps {
  table: string;
  recordId: string | null;
  fieldKey: string;
  value?: string | null; // existing URL
  onChange: (newUrl: string | null) => void;
}

export default function AttachmentUpload({
  table,
  recordId,
  fieldKey,
  value,
  onChange,
}: AttachmentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Update preview when value changes externally
  useEffect(() => {
    if (value !== previewUrl) {
      setPreviewUrl(value || null);
    }
  }, [value, previewUrl]);

  const getStoragePath = (fileName: string, isTemp: boolean = false): string => {
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uuid = crypto.randomUUID();
    const timestamp = Date.now();
    const finalFileName = `${timestamp}-${uuid}-${sanitizedFileName}`;

    if (isTemp || !recordId) {
      // Temp path for new records
      return `temp/${uuid}/${finalFileName}`;
    } else {
      // Final path: attachments/{table}/{recordId}/{filename}
      return `${table}/${recordId}/${finalFileName}`;
    }
  };

  const handleFileSelect = async (file: File) => {
    // Validate file type (images for thumbnails)
    const validImageTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validImageTypes.includes(file.type)) {
      setError("Please upload an image file (PNG, JPG, or WebP)");
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const isTemp = !recordId;
      const filePath = getStoragePath(file.name, isTemp);

      console.log("Uploading file:", { fileName: file.name, filePath, size: file.size, type: file.type, isTemp });

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(filePath, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        let errorMessage = "Failed to upload file";
        
        const errorMsg = uploadError.message || "";
        
        if (errorMsg.includes("Bucket not found")) {
          errorMessage = "Storage bucket 'attachments' not found. Please create it in Supabase Storage.";
        } else if (errorMsg.includes("RLS") || errorMsg.includes("row-level security")) {
          errorMessage = "Permission denied. Please check RLS policies for the 'attachments' bucket.";
        } else if (errorMsg.includes("403") || errorMsg.includes("Forbidden")) {
          errorMessage = "Access forbidden. Check bucket permissions.";
        } else {
          errorMessage = `Upload failed: ${errorMsg || "Unknown error"}`;
        }

        setError(errorMessage);
        setUploading(false);
        return;
      }

      if (!uploadData) {
        setError("Upload succeeded but no data returned");
        setUploading(false);
        return;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("attachments").getPublicUrl(filePath);

      if (!publicUrl) {
        setError("Failed to get public URL for uploaded file");
        setUploading(false);
        return;
      }

      console.log("Upload successful, public URL:", publicUrl);

      // Update preview and call onChange
      setPreviewUrl(publicUrl);
      onChange(publicUrl);
      setUploadProgress(100);
      
      // Small delay to show completion
      setTimeout(() => {
        setUploadProgress(0);
      }, 500);
    } catch (err: any) {
      console.error("Error uploading file:", err);
      setError(err?.message || "An unexpected error occurred");
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemove = async () => {
    if (!previewUrl) return;

    try {
      // Extract path from URL
      const urlParts = previewUrl.split("/attachments/");
      if (urlParts.length < 2) {
        // If we can't extract path, just clear the value
        setPreviewUrl(null);
        onChange(null);
        return;
      }

      const filePath = urlParts[1].split("?")[0]; // Remove query params

      console.log("Deleting file:", filePath);

      const { error: deleteError } = await supabase.storage
        .from("attachments")
        .remove([filePath]);

      if (deleteError) {
        console.error("Error deleting file:", deleteError);
        // Still clear the value even if delete fails
      }

      setPreviewUrl(null);
      onChange(null);
    } catch (err: any) {
      console.error("Error removing file:", err);
      // Still clear the value
      setPreviewUrl(null);
      onChange(null);
    }
  };

  const handleReplace = () => {
    fileInputRef.current?.click();
  };

  const fileName = previewUrl ? previewUrl.split("/").pop()?.split("?")[0] : null;
  const isImage = previewUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(previewUrl);

  return (
    <div className="flex flex-col gap-2">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-4 transition ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="text-sm text-gray-600 dark:text-gray-400">Uploading...</div>
            {uploadProgress > 0 && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        ) : previewUrl ? (
          <div className="flex flex-col gap-3">
            {/* Preview */}
            {isImage ? (
              <div className="flex justify-center">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-32 max-w-full object-contain rounded border border-gray-300 dark:border-gray-700"
                />
              </div>
            ) : (
              <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                📎 {fileName || "File"}
              </div>
            )}

            {/* File name */}
            {fileName && (
              <div className="text-xs text-center text-gray-600 dark:text-gray-400 truncate">
                {fileName}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={handleReplace}
                className="px-3 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 transition"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Drag & drop an image here, or
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Upload file
            </button>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              PNG, JPG, or WebP (max 10MB)
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
          {error}
        </div>
      )}

      {/* Info for temp uploads */}
      {!recordId && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          File will be moved to final location after record is created.
        </div>
      )}
    </div>
  );
}

