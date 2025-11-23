"use client";

import { useState } from "react";
import { X, GripVertical, ExternalLink } from "lucide-react";

interface EmbedBlockProps {
  id: string;
  content: any;
  onUpdate: (id: string, content: any) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
}

export default function EmbedBlock({
  id,
  content,
  onUpdate,
  onDelete,
  isDragging = false,
}: EmbedBlockProps) {
  const [url, setUrl] = useState(content?.url || "");
  const [isEditing, setIsEditing] = useState(!url);

  const handleUrlSubmit = (newUrl: string) => {
    if (newUrl.trim()) {
      setUrl(newUrl.trim());
      setIsEditing(false);
      onUpdate(id, { url: newUrl.trim() });
    }
  };

  const getEmbedHtml = (embedUrl: string) => {
    // Simple iframe embed - in production, you might want to use oEmbed or similar
    try {
      const urlObj = new URL(embedUrl);
      // For YouTube
      if (urlObj.hostname.includes("youtube.com") || urlObj.hostname.includes("youtu.be")) {
        const videoId = urlObj.searchParams.get("v") || urlObj.pathname.split("/").pop();
        return `<iframe width="100%" height="400" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      }
      // For Vimeo
      if (urlObj.hostname.includes("vimeo.com")) {
        const videoId = urlObj.pathname.split("/").pop();
        return `<iframe width="100%" height="400" src="https://player.vimeo.com/video/${videoId}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
      }
      // Default iframe
      return `<iframe width="100%" height="400" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;
    } catch {
      return null;
    }
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
      <button
        onClick={() => onDelete(id)}
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-600 z-10"
        title="Delete block"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Embed Content */}
      <div className="p-4">
        {isEditing || !url ? (
          <div>
            <input
              type="url"
              placeholder="Enter embed URL (YouTube, Vimeo, etc.)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleUrlSubmit(url);
                } else if (e.key === "Escape") {
                  setIsEditing(false);
                }
              }}
              onBlur={() => {
                if (url) handleUrlSubmit(url);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Press Enter to embed
            </p>
          </div>
        ) : (
          <div>
            <div
              className="w-full rounded-lg overflow-hidden"
              dangerouslySetInnerHTML={{ __html: getEmbedHtml(url) || "" }}
            />
            <div className="mt-2 flex items-center justify-between">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Open in new tab
              </a>
              <button
                onClick={() => {
                  setIsEditing(true);
                  setUrl("");
                }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                Change URL
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

