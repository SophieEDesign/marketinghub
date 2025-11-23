"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Field } from "@/lib/fields";

interface SortableGroupProps {
  group: { name: string; fields: string[] };
  fields: Field[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  children: React.ReactNode;
}

export default function SortableGroup({
  group,
  fields,
  isCollapsed,
  onToggleCollapse,
  children,
}: SortableGroupProps) {
  const visibleFields = fields.filter((f) => group.fields.includes(f.id));

  return (
    <>
      {/* Group Header */}
      <tr className="bg-gray-100 dark:bg-gray-800 border-b-2 border-gray-300 dark:border-gray-600">
        <td colSpan={1000} className="px-4 py-2">
          <button
            onClick={onToggleCollapse}
            className="flex items-center gap-2 w-full text-left hover:bg-gray-200 dark:hover:bg-gray-700 rounded px-2 py-1 transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
            <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">
              {group.name}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
              ({visibleFields.length} field{visibleFields.length !== 1 ? "s" : ""})
            </span>
          </button>
        </td>
      </tr>
      {/* Group Fields */}
      {!isCollapsed && children}
    </>
  );
}

