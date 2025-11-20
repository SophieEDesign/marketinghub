"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useMemo } from "react";
import { Field } from "@/lib/fields";
import FieldInput from "../fields/FieldInput";

interface SortableFieldProps {
  id: string;
  field: Field;
  editing: boolean;
  isMobile?: boolean;
  value: any;
  onChange: (value: any) => void;
  table?: string;
  recordId: string | null;
  saveState?: "saving" | "saved" | null;
}

export default function SortableField({
  id,
  field,
  editing,
  isMobile = false,
  value,
  onChange,
  table,
  recordId,
  saveState,
}: SortableFieldProps) {
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
      className={`relative transition-all ${
        editing && !isMobile
          ? "p-3 rounded-xl border bg-white dark:bg-gray-900 shadow-sm cursor-grab active:cursor-grabbing ring-1 ring-blue-300 mb-3"
          : "mb-4"
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
          className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400"
        >
          <GripVertical className="w-4 h-4" />
          <span>Drag to move field</span>
        </div>
      )}
      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 block mb-2">
        {field.label} {field.required && "*"}
      </label>
      <FieldInput
        field={field}
        value={value}
        onChange={onChange}
        table={table}
        recordId={recordId}
      />
      {saveState === "saved" && (
        <div className="absolute top-8 right-2">
          <svg
            className="w-4 h-4 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

