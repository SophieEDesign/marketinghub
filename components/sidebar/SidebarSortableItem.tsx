"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useMemo } from "react";
import Link from "next/link";

interface SidebarSortableItemProps {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  editing: boolean;
  active: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}

export default function SidebarSortableItem({
  id,
  label,
  href,
  icon: Icon,
  editing,
  active,
  collapsed = false,
  onClick,
}: SidebarSortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editing });

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }),
    [transform, transition, isDragging]
  );

  if (collapsed && !editing) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={`flex items-center justify-center p-2 rounded-md text-sm transition-all duration-200 ease-in-out ${
          active
            ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
        title={label}
      >
        <Icon className="w-4 h-4" />
      </Link>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-all duration-200 ease-in-out ${
        active
          ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium border-l-4 border-blue-500"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      } ${editing ? "cursor-grab active:cursor-grabbing" : ""} ${
        isDragging ? "ring-2 ring-blue-400 shadow-md z-50" : ""
      }`}
    >
      {editing && (
        <div {...listeners} {...attributes} className="flex-shrink-0">
          <GripVertical className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
        </div>
      )}
      {href === "#" && onClick ? (
        <button
          onClick={(e) => {
            e.preventDefault();
            onClick();
          }}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="truncate">{label}</span>}
        </button>
      ) : (
        <Link
          href={href}
          onClick={onClick}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="truncate">{label}</span>}
        </Link>
      )}
    </div>
  );
}

