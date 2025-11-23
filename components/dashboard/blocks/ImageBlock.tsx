"use client";

import { useState, useRef } from "react";
import { X, GripVertical, Upload, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface ImageBlockProps {
  id: string;
  content: any;
  onUpdate?: (id: string, content: any) => void;
  onDelete?: (id: string) => void;
  isDragging?: boolean;
}

export default function ImageBlock({
  id,
  content,
  onUpdate,
  onDelete,
  isDragging = false,
}: ImageBlockProps) {
  const [imageUrl, setImageUrl] = useState(content?.url || content?.src || "");
  const [isUploading, setIsUploading] = useState(false);
  const [caption, setCaption] = useState(content?.caption || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    try {
      // Upload to Supabase Storage (optional - you may need to create a bucket)
      const fileExt = file.name.split(".").pop();
      const fileName = `${id}_${Date.now()}.${fileExt}`;
      const filePath = `dashboard-images/${fileName}`;

      // For now, use a data URL or external URL
      // In production, upload to Supabase Storage
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setImageUrl(dataUrl);
        onUpdate?.(id, { url: dataUrl, caption });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading image:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlChange = (url: string) => {
    setImageUrl(url);
    onUpdate?.(id, { url, caption });
  };

  const handleCaptionChange = (newCaption: string) => {
    setCaption(newCaption);
    onUpdate?.(id, { url: imageUrl, caption: newCaption });
  };

  return (
    <div
      className={`group relative bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      {/* Drag Handle */}
      <div className="absolute left-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing" />
      </div>

      {/* Delete Button */}
      {onDelete && (
        <button
          onClick={() => onDelete(id)}
          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-600 z-10"
          title="Delete block"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Image Content */}
      <div className="p-4">
        {!imageUrl ? (
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
            <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="btn-secondary flex items-center gap-2 mx-auto"
            >
              <Upload className="w-4 h-4" />
              {isUploading ? "Uploading..." : "Upload Image"}
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              or paste an image URL
            </p>
            <input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={imageUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="mt-4 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
            />
          </div>
        ) : (
          <div>
            <img
              src={imageUrl}
              alt={caption || "Dashboard image"}
              className="w-full rounded-lg"
            />
            <input
              type="text"
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => handleCaptionChange(e.target.value)}
              className="mt-2 w-full px-2 py-1 text-sm text-gray-500 dark:text-gray-400 border-none bg-transparent focus:outline-none focus:ring-0"
            />
            <button
              onClick={() => {
                setImageUrl("");
                setCaption("");
                onUpdate?.(id, { url: "", caption: "" });
              }}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Change image
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

