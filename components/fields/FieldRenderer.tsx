"use client";

import { Field, FieldType } from "@/lib/fields";
import StatusChip from "../chips/StatusChip";
import ChannelChip from "../chips/ChannelChip";
import LinkedRecordChip from "../linked/LinkedRecordChip";

interface FieldRendererProps {
  field: Field;
  value: any;
  record?: any;
}

export default function FieldRenderer({ field, value, record }: FieldRendererProps) {
  if (value === null || value === undefined) {
    return <span className="text-gray-400">—</span>;
  }

  switch (field.type) {
    case "text":
      return <span>{String(value)}</span>;

    case "long_text":
      return (
        <div className="max-w-md">
          <p className="line-clamp-2 text-sm">{String(value)}</p>
        </div>
      );

    case "date":
      return (
        <span className="text-sm">
          {value ? new Date(value).toLocaleDateString() : "—"}
        </span>
      );

    case "single_select":
      // Get option from field.options.values
      const options = field.options?.values || [];
      const option = options.find((opt: any) => opt.id === value || opt.label === value);
      
      // Use StatusChip for status fields, or if option has a color
      if (field.field_key === "status" || field.label?.toLowerCase().includes("status")) {
        return <StatusChip value={String(value)} />;
      }
      
      // For other single selects, show as chip with color if available
      if (option?.color) {
        return (
          <span
            className="px-2 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${option.color}20`,
              color: option.color,
            }}
          >
            {option?.label || String(value)}
          </span>
        );
      }
      
      // Fallback: plain text chip
      return (
        <span className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          {option?.label || String(value)}
        </span>
      );

    case "multi_select":
      if (field.field_key === "channels") {
        return (
          <div className="flex flex-wrap gap-1">
            {Array.isArray(value) && value.length > 0 ? (
              value.map((item: string, idx: number) => (
                <ChannelChip key={idx} label={item} />
              ))
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </div>
        );
      }
      return (
        <div className="flex flex-wrap gap-1">
          {Array.isArray(value) && value.length > 0 ? (
            value.map((item: string, idx: number) => (
              <span
                key={idx}
                className="px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700"
              >
                {String(item)}
              </span>
            ))
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
      );

    case "number":
      return <span>{Number(value).toLocaleString()}</span>;

    case "boolean":
      return (
        <span className={value ? "text-green-600" : "text-gray-400"}>
          {value ? "✓" : "✗"}
        </span>
      );

    case "attachment":
      if (Array.isArray(value) && value.length > 0) {
        return (
          <div className="flex gap-2">
            {value.slice(0, 3).map((url: string, idx: number) => (
              <img
                key={idx}
                src={url}
                alt={`Attachment ${idx + 1}`}
                className="h-12 w-12 object-cover rounded"
              />
            ))}
            {value.length > 3 && (
              <span className="text-xs text-gray-500">+{value.length - 3}</span>
            )}
          </div>
        );
      }
      if (typeof value === "string" && value) {
        return (
          <img
            src={value}
            alt="Attachment"
            className="h-12 w-12 object-cover rounded"
          />
        );
      }
      return <span className="text-gray-400">—</span>;

    case "linked_record":
      // Use LinkedRecordChip for display
      const linkedRecordId = value;
      const toTable = field.options?.to_table;
      const displayField = field.options?.display_field || "name";
      
      if (!linkedRecordId || !toTable) {
        return <span className="text-gray-400">—</span>;
      }

      // Try to get display value from record if available (from joined query)
      if (record && record[`${field.field_key}_${displayField}`]) {
        return (
          <LinkedRecordChip
            displayValue={String(record[`${field.field_key}_${displayField}`])}
            size="sm"
          />
        );
      }

      // Fallback: show ID (will be replaced by useLinkedRecord hook in views)
      return <LinkedRecordChip displayValue={String(linkedRecordId)} size="sm" />;

    default:
      return <span>{String(value)}</span>;
  }
}

