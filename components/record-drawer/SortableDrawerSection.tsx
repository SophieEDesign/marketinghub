"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useMemo } from "react";

interface SortableDrawerSectionProps {
  id: string;
  editing: boolean;
  isMobile?: boolean;
  children: React.ReactNode;
}

export default function SortableDrawerSection({
  id,
  editing,
  isMobile = false,
  children,
}: SortableDrawerSectionProps) {
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
      scale: isDragging ? 1.02 : 1,
    }),
    [transform, transition, isDragging]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`mb-6 rounded-xl border bg-white dark:bg-gray-900 p-4 shadow-sm transition-all ${
        editing && !isMobile
          ? "cursor-grab active:cursor-grabbing ring-1 ring-blue-300 hover:ring-blue-400"
          : ""
      } ${
        isDragging
          ? "opacity-50 ring-2 ring-blue-400 shadow-md z-50"
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
          <span>Drag to reorder section</span>
        </div>
      )}
      {children}
    </div>
  );
}

