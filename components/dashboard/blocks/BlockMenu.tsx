"use client";

import { FileText, Image, Code, BarChart3, Table, Calendar, FileCode, Plus } from "lucide-react";

export type BlockType = "text" | "image" | "embed" | "kpi" | "table" | "calendar" | "html";

interface BlockMenuProps {
  onSelectBlockType: (type: BlockType) => void;
  position?: { x: number; y: number };
}

export default function BlockMenu({
  onSelectBlockType,
  position,
}: BlockMenuProps) {
  const menuItems = [
    {
      type: "text" as const,
      icon: FileText,
      label: "Text",
      description: "Rich text block",
    },
    {
      type: "image" as const,
      icon: Image,
      label: "Image",
      description: "Upload or embed an image",
    },
    {
      type: "embed" as const,
      icon: Code,
      label: "Embed",
      description: "Embed external content",
    },
    {
      type: "kpi" as const,
      icon: BarChart3,
      label: "KPI",
      description: "Key performance indicator",
    },
    {
      type: "table" as const,
      icon: Table,
      label: "Table Summary",
      description: "Mini table preview",
    },
    {
      type: "calendar" as const,
      icon: Calendar,
      label: "Calendar / Upcoming",
      description: "Upcoming events",
    },
    {
      type: "html" as const,
      icon: FileCode,
      label: "Custom HTML",
      description: "Custom HTML block",
    },
  ];

  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-2 min-w-[280px] ${
        position ? "absolute z-50" : ""
      }`}
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
            }
          : undefined
      }
    >
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 py-1 mb-1">
        Add Block
      </div>
      {menuItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.type}
            onClick={() => onSelectBlockType(item.type)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
          >
            <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {item.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {item.description}
              </div>
            </div>
            <Plus className="w-4 h-4 text-gray-400" />
          </button>
        );
      })}
    </div>
  );
}

