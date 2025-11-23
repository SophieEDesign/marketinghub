"use client";

import { X, LayoutGrid, Columns3, Calendar, Timer, Images, LayoutList, BarChart3, TrendingUp, Type, Image as ImageIcon, MousePointer2, Filter, Minus } from "lucide-react";
import Button from "@/components/ui/Button";

interface BlockMenuProps {
  onClose: () => void;
  onSelect: (type: string) => void;
}

const BLOCK_TYPES = [
  { type: "grid", label: "Grid", icon: LayoutGrid, description: "Spreadsheet view" },
  { type: "kanban", label: "Kanban", icon: Columns3, description: "Board view" },
  { type: "calendar", label: "Calendar", icon: Calendar, description: "Calendar view" },
  { type: "timeline", label: "Timeline", icon: Timer, description: "Timeline view" },
  { type: "gallery", label: "Gallery", icon: Images, description: "Card gallery" },
  { type: "list", label: "List", icon: LayoutList, description: "List view" },
  { type: "chart", label: "Chart", icon: BarChart3, description: "Data visualization" },
  { type: "kpi", label: "KPI", icon: TrendingUp, description: "Key metric" },
  { type: "text", label: "Text", icon: Type, description: "Rich text" },
  { type: "image", label: "Image", icon: ImageIcon, description: "Image display" },
  { type: "button", label: "Button", icon: MousePointer2, description: "Action button" },
  { type: "filter", label: "Filter", icon: Filter, description: "Filter controls" },
  { type: "divider", label: "Divider", icon: Minus, description: "Visual separator" },
];

export default function BlockMenu({ onClose, onSelect }: BlockMenuProps) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add Block</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {BLOCK_TYPES.map((block) => {
              const Icon = block.icon;
              return (
                <button
                  key={block.type}
                  onClick={() => {
                    onSelect(block.type);
                    onClose();
                  }}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left"
                >
                  <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-2" />
                  <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    {block.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {block.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

