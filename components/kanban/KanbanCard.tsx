"use client";

import { useDraggable } from "@dnd-kit/core";
import { useRecordDrawer } from "@/components/record-drawer/RecordDrawerProvider";
import { Field } from "@/lib/fields";
import FieldRenderer from "../fields/FieldRenderer";

interface KanbanCardProps {
  row: any;
  fields: Field[];
}

export default function KanbanCard({ row, fields }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: row.id,
  });
  const { openRecord } = useRecordDrawer();

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : {
        opacity: isDragging ? 0.5 : 1,
      };

  const handleClick = (e: React.MouseEvent) => {
    // Only open drawer if not dragging
    if (!isDragging) {
      e.stopPropagation();
      // Find tableId from fields
      const tableId = fields[0]?.table_id;
      if (tableId) {
      openRecord(tableId, row.id);
      }
    }
  };

  // Find fields dynamically
  const titleField = fields.find((f) => f.label.toLowerCase() === "title") || fields[0];
  const thumbnailField = fields.find((f) => f.type === "attachment");
  const statusField = fields.find(
    (f) => f.type === "single_select" && f.label.toLowerCase().includes("status")
  );
  const multiSelectFields = fields.filter((f) => f.type === "multi_select");

  const titleValue = titleField ? row[titleField.field_key] : "Untitled";
  const thumbnailValue = thumbnailField ? row[thumbnailField.field_key] : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`p-3 bg-white dark:bg-gray-900 rounded-lg shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing flex flex-col gap-2 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      {/* Thumbnail */}
      {thumbnailValue ? (
        <img
          src={Array.isArray(thumbnailValue) ? thumbnailValue[0] : thumbnailValue}
          alt={String(titleValue)}
          className="w-full h-24 object-cover rounded-md"
        />
      ) : (
        <div className="w-full h-24 bg-gray-300 dark:bg-gray-700 rounded-md" />
      )}

      {/* Title */}
      <h3 className="font-medium text-sm line-clamp-2">{String(titleValue)}</h3>

      {/* Status */}
      {statusField && (
        <div className="flex items-center gap-1">
          <FieldRenderer field={statusField} value={row[statusField.field_key]} record={row} />
        </div>
      )}

      {/* Multi-select fields (channels, etc.) */}
      {multiSelectFields.map((field) => {
        const value = row[field.field_key];
        if (!value || !Array.isArray(value) || value.length === 0) return null;
        return (
          <div key={field.id} className="flex flex-wrap gap-1">
            {value.slice(0, 3).map((item: string, idx: number) => (
              <FieldRenderer key={idx} field={field} value={[item]} record={row} />
            ))}
            {value.length > 3 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                +{value.length - 3}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

