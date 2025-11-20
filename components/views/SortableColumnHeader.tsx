"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useMemo } from "react";

interface SortableColumnHeaderProps {
  id: string;
  label: string;
  isMobile?: boolean;
}

export default function SortableColumnHeader({
  id,
  label,
  isMobile = false,
}: SortableColumnHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }),
    [transform, transition, isDragging]
  );

  if (isMobile) {
    // On mobile, render without drag handle
    return (
      <th className="px-4 py-3 font-heading uppercase text-xs tracking-wide text-brand-grey font-semibold text-left">
        {label}
      </th>
    );
  }

  return (
    <th
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`px-4 py-3 font-heading uppercase text-xs tracking-wide text-brand-grey font-semibold text-left transition-all ${
        isDragging
          ? "opacity-50 ring-2 ring-blue-400 rounded-md bg-white dark:bg-gray-800 shadow-md z-50 scale-105"
          : "hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      <div
        {...listeners}
        className="flex items-center gap-2 cursor-grab active:cursor-grabbing select-none"
      >
        <GripVertical className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0" />
        <span>{label}</span>
      </div>
    </th>
  );
}

