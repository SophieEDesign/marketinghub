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
    <div
      className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <BlockHeader
        title={title}
        editing={editing}
        onOpenSettings={onOpenSettings || (() => {})}
        onDelete={onDelete ? () => onDelete(id) : undefined}
        isDragging={isDragging}
      />

      <div className="p-4 flex-1 overflow-auto" style={{ maxHeight: `${height}px` }}>
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
    </div>
  );
}
