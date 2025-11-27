"use client";

import { Image as ImageIcon } from "lucide-react";
import BlockHeader from "./BlockHeader";
import { getDefaultContent } from "@/lib/utils/dashboardBlockContent";

interface ImageBlockProps {
  id: string;
  content: any;
  onUpdate?: (id: string, content: any) => void;
  onDelete?: (id: string) => void;
  onOpenSettings?: () => void;
  isDragging?: boolean;
  editing?: boolean;
}

export default function ImageBlock({
  id,
  content,
  onUpdate,
  onDelete,
  onOpenSettings,
  isDragging = false,
  editing = false,
}: ImageBlockProps) {
  // Normalize content with defaults for backwards compatibility
  const defaults = getDefaultContent("image");
  const normalizedContent = { ...defaults, ...content };
  
  const imageUrl = normalizedContent.url || "";
  const caption = normalizedContent.caption || "";
  const style = normalizedContent.style || "contain";
  
  const title = normalizedContent.title || "Image Block";
  
  const imageStyle = style === "cover" 
    ? "object-cover w-full h-full" 
    : style === "full-width"
    ? "w-full"
    : "object-contain w-full";

  return (
    <>
      <BlockHeader
        title={title}
        editing={editing}
        onOpenSettings={onOpenSettings || (() => {})}
        onDelete={onDelete ? () => onDelete(id) : undefined}
        isDragging={isDragging}
      />
      <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
        {!imageUrl ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <ImageIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No image</p>
            <p className="text-xs mt-1">Configure in settings</p>
          </div>
        ) : (
          <div className="w-full">
            <img
              src={imageUrl}
              alt={caption || "Dashboard image"}
              className={`${imageStyle} rounded-lg`}
            />
            {caption && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-center">
                {caption}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
