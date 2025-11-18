"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface FileUploadProps {
  recordId: string;
  onUploadComplete?: (url: string) => void;
}

export default function FileUpload({ recordId, onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !recordId) return;

    setUploading(true);

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `content/${recordId}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        setUploading(false);
        return;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("attachments").getPublicUrl(filePath);

      // Update content record with attachment URL
      const { data: contentData } = await supabase
        .from("content")
        .select("attachments")
        .eq("id", recordId)
        .single();

      const existingAttachments = contentData?.attachments || [];
      const updatedAttachments = [...existingAttachments, publicUrl];

      const { error: updateError } = await supabase
        .from("content")
        .update({ attachments: updatedAttachments })
        .eq("id", recordId);

      if (!updateError) {
        setUploadedFiles((prev) => [...prev, publicUrl]);
        if (onUploadComplete) {
          onUploadComplete(publicUrl);
        }
      }
    } catch (error) {
      console.error("Error uploading file:", error);
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
      {uploadedFiles.length > 0 && (
        <div className="flex flex-col gap-1 mt-2">
          {uploadedFiles.map((url, idx) => (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
            >
              Attachment {idx + 1}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

