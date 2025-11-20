"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useMemo } from "react";

interface DashboardSortableModuleProps {
  id: string;
  editing: boolean;
  isMobile?: boolean;
  children: React.ReactNode;
}

export default function DashboardSortableModule({
  id,
  editing,
  isMobile = false,
  children,
}: DashboardSortableModuleProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editing || isMobile });

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
    }),
    [transform, transition]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border bg-white dark:bg-gray-800 p-4 shadow-sm mb-4 transition-all ${
        editing && !isMobile
          ? "cursor-grab active:cursor-grabbing ring-1 ring-blue-300 hover:ring-blue-400"
          : ""
      } ${
        isDragging
          ? "opacity-50 scale-105 ring-2 ring-blue-400 shadow-lg z-50"
          : ""
      }`}
    >
      {editing && !isMobile && (
        <div
          {...listeners}
          {...attributes}
          className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400"
        >
          <GripVertical className="w-4 h-4" />
          <span>Drag to reorder</span>
        </div>
      )}
      {children}
    </div>
  );
}

