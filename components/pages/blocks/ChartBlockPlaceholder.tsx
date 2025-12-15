"use client";

import { BlockConfig } from "@/lib/pages/blockTypes";

interface ChartBlockPlaceholderProps {
  block: BlockConfig;
  isEditing: boolean;
  onUpdate?: (id: string, updates: Partial<BlockConfig>) => void;
  onDelete?: (id: string) => void;
  onOpenSettings?: () => void;
}

export default function ChartBlockPlaceholder({
  block,
  isEditing,
  onOpenSettings,
}: ChartBlockPlaceholderProps) {
  const title = block.settings?.title || "Chart";
  const hasConfig = block.settings?.table && block.settings?.chartType;

  if (!hasConfig) {
    return (
      <div className="p-6 text-center">
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          {title}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          Select table and fields to begin
        </div>
        {isEditing && onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="mt-3 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Configure Chart
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {title}
      </div>
      <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Chart visualization will be rendered here
        </div>
      </div>
    </div>
  );
}
