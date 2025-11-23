"use client";

import { useState } from "react";
import { X, GripVertical, Settings, FileCode } from "lucide-react";
import { usePermissions } from "@/lib/hooks/usePermissions";

interface HtmlBlockProps {
  id: string;
  content: any;
  onUpdate?: (id: string, content: any) => void;
  onDelete?: (id: string) => void;
  isDragging?: boolean;
}

export default function HtmlBlock({
  id,
  content,
  onUpdate,
  onDelete,
  isDragging = false,
}: HtmlBlockProps) {
  const permissions = usePermissions();
  const [html, setHtml] = useState(content?.html || "");
  const [isEditing, setIsEditing] = useState(!html);

  // Only allow admins to edit HTML blocks
  const canEdit = permissions.role === "admin" && onUpdate;

  const handleHtmlChange = (newHtml: string) => {
    setHtml(newHtml);
    onUpdate?.(id, { html: newHtml });
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
      {onDelete && canEdit && (
        <button
          onClick={() => onDelete(id)}
          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-600 z-10"
          title="Delete block"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Settings Button */}
      {canEdit && (
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="absolute right-10 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-600 z-10"
          title="Edit HTML"
        >
          <Settings className="w-4 h-4" />
        </button>
      )}

      {/* Content */}
      <div className="p-4">
        {isEditing && canEdit ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <FileCode className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Custom HTML
              </h3>
            </div>
            <textarea
              value={html}
              onChange={(e) => handleHtmlChange(e.target.value)}
              className="w-full h-48 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm font-mono"
              placeholder="Enter HTML code..."
            />
            <button
              onClick={() => setIsEditing(false)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Save
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ⚠️ Only admins can edit HTML blocks. Use with caution.
            </p>
          </div>
        ) : (
          <div>
            {html ? (
              <div
                dangerouslySetInnerHTML={{ __html: html }}
                className="prose prose-sm max-w-none dark:prose-invert"
              />
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FileCode className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No HTML content</p>
                {canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Add HTML
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

