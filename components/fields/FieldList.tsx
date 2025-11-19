"use client";

import { useSortable } from "@dnd-kit/sortable";
import { Field, FieldType } from "@/lib/fields";

// Helper function to convert transform to CSS string (replaces @dnd-kit/utilities)
const toTransformString = (transform: any) => {
  if (!transform) return "";
  const { x = 0, y = 0, scaleX = 1, scaleY = 1 } = transform;
  return `translate3d(${x}px, ${y}px, 0) scaleX(${scaleX}) scaleY(${scaleY})`;
};

interface FieldListProps {
  field: Field;
  onEdit: (field: Field) => void;
  onDelete: (fieldId: string) => void;
}

export default function FieldList({ field, onEdit, onDelete }: FieldListProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: toTransformString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getTypeColor = (type: FieldType): string => {
    const colors: Record<FieldType, string> = {
      text: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      long_text: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      date: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      single_select: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
      multi_select: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
      number: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
      boolean: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
      attachment: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
      linked_record: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
    };
    return colors[type] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-3 ${
        isDragging ? "shadow-lg" : "hover:shadow-md"
      } transition`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M10 13a1 1 0 100-2 1 1 0 000 2zM6 13a1 1 0 100-2 1 1 0 000 2zM10 9a1 1 0 100-2 1 1 0 000 2zM6 9a1 1 0 100-2 1 1 0 000 2zM10 5a1 1 0 100-2 1 1 0 000 2zM6 5a1 1 0 100-2 1 1 0 000 2z" />
        </svg>
      </div>

      {/* Field Info */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium">{field.label}</span>
          {field.required && (
            <span className="text-xs text-red-600 dark:text-red-400">*</span>
          )}
          {field.visible === false && (
            <span className="text-xs text-gray-500 dark:text-gray-400">(Hidden)</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(field.type)}`}>
            {field.type.replace("_", " ")}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {field.field_key}
          </span>
          {(field.type === "single_select" || field.type === "multi_select") &&
            field.options?.values && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {field.options.values.length} option(s)
              </span>
            )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onEdit(field)}
          className="btn-secondary text-xs"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(field.id)}
          className="px-3 py-1 rounded bg-brand-red text-white hover:bg-brand-redDark transition text-xs"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

