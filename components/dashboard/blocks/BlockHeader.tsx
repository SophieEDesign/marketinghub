"use client";

import { GripVertical, Settings, X } from "lucide-react";

interface BlockHeaderProps {
  title: string;
  editing: boolean;
  onOpenSettings: () => void;
  onDelete?: () => void;
  isDragging?: boolean;
}

export default function BlockHeader({
  title,
  editing,
  onOpenSettings,
  onDelete,
  isDragging = false,
}: BlockHeaderProps) {
  // Only show header in edit mode
  if (!editing) {
    return null;
  }

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 react-grid-drag-handle ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0 cursor-grab active:cursor-grabbing">
        <div className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 pointer-events-none">
          <GripVertical className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate pointer-events-none">
          {title || "Untitled Block"}
        </h3>
      </div>
      
      <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onOpenSettings();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          title="Settings"
          type="button"
        >
          <Settings className="w-4 h-4" />
        </button>
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDelete();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
            title="Delete block"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

