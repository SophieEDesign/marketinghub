"use client";

import { ExternalLink } from "lucide-react";
import BlockHeader from "./BlockHeader";
import { getDefaultContent } from "@/lib/utils/dashboardBlockContent";

interface EmbedBlockProps {
  id: string;
  content: any;
  onUpdate?: (id: string, content: any) => void;
  onDelete?: (id: string) => void;
  onOpenSettings?: () => void;
  isDragging?: boolean;
  editing?: boolean;
}

export default function EmbedBlock({
  id,
  content,
  onUpdate,
  onDelete,
  onOpenSettings,
  isDragging = false,
  editing = false,
}: EmbedBlockProps) {
  // Normalize content with defaults for backwards compatibility
  const defaults = getDefaultContent("embed");
  const normalizedContent = { ...defaults, ...content };
  
  const url = normalizedContent.url || "";
  const height = normalizedContent.height || 400;
  const title = normalizedContent.title || "Embed Block";

  const getEmbedHtml = (embedUrl: string) => {
    try {
      const urlObj = new URL(embedUrl);
      // For YouTube
      if (urlObj.hostname.includes("youtube.com") || urlObj.hostname.includes("youtu.be")) {
        const videoId = urlObj.searchParams.get("v") || urlObj.pathname.split("/").pop();
        return `<iframe width="100%" height="${height}" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      }
      // For Vimeo
      if (urlObj.hostname.includes("vimeo.com")) {
        const videoId = urlObj.pathname.split("/").pop();
        return `<iframe width="100%" height="${height}" src="https://player.vimeo.com/video/${videoId}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
      }
      // Default iframe
      return `<iframe width="100%" height="${height}" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;
    } catch {
      return null;
    }
  };

  return (
    <>
      <BlockHeader
        title={title}
        editing={editing}
        onOpenSettings={onOpenSettings || (() => {})}
        onDelete={onDelete ? () => onDelete(id) : undefined}
        isDragging={isDragging}
      />
      <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: `${height}px` }}>
        {!url ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <p>No embed URL</p>
            <p className="text-xs mt-1">Configure in settings</p>
          </div>
        ) : (
          <div>
            <div
              className="w-full rounded-lg overflow-hidden"
              dangerouslySetInnerHTML={{ __html: getEmbedHtml(url) || "" }}
            />
            <div className="mt-2 flex items-center justify-center">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Open in new tab
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
