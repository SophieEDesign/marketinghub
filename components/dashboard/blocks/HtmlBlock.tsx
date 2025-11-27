"use client";

import { FileCode } from "lucide-react";
import BlockHeader from "./BlockHeader";
import { getDefaultContent } from "@/lib/utils/dashboardBlockContent";

interface HtmlBlockProps {
  id: string;
  content: any;
  onUpdate?: (id: string, content: any) => void;
  onDelete?: (id: string) => void;
  onOpenSettings?: () => void;
  isDragging?: boolean;
  editing?: boolean;
}

export default function HtmlBlock({
  id,
  content,
  onUpdate,
  onDelete,
  onOpenSettings,
  isDragging = false,
  editing = false,
}: HtmlBlockProps) {
  // Normalize content with defaults for backwards compatibility
  const defaults = getDefaultContent("html");
  const normalizedContent = { ...defaults, ...content };
  
  const html = normalizedContent.html || "";
  const height = normalizedContent.height || 400;
  const title = normalizedContent.title || "HTML Block";

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
        {!html ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <FileCode className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No HTML content</p>
            <p className="text-xs mt-1">Configure in settings</p>
          </div>
        ) : (
          <div
            dangerouslySetInnerHTML={{ __html: html }}
            className="prose prose-sm max-w-none dark:prose-invert"
          />
        )}
      </div>
    </>
  );
}
