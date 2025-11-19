"use client";

import { Field, FieldType } from "@/lib/fields";
import StatusChip from "../chips/StatusChip";
import ChannelChip from "../chips/ChannelChip";
import AttachmentUpload from "./AttachmentUpload";

interface FieldInputProps {
  field: Field;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  table?: string; // Table ID for attachment uploads
  recordId?: string | null; // Record ID for attachment uploads
}

export default function FieldInput({ field, value, onChange, error, table, recordId }: FieldInputProps) {
  const baseClasses =
    "w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500";

  switch (field.type) {
    case "text":
      return (
        <div>
          <input
            type="text"
            className={baseClasses}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.label}
            required={field.required}
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
      );

    case "long_text":
      return (
        <div>
          <textarea
            className={`${baseClasses} h-28 resize-none`}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.label}
            required={field.required}
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
      );

    case "date":
      return (
        <div>
          <input
            type="date"
            className={baseClasses}
            value={value ? new Date(value).toISOString().split("T")[0] : ""}
            onChange={(e) => onChange(e.target.value || null)}
            required={field.required}
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
      );

    case "single_select":
      // Options are stored as { values: [...] } in field.options
      const selectOptions = field.options?.values || (Array.isArray(field.options) ? field.options : []);
      return (
        <div>
          <select
            className={baseClasses}
            value={value || ""}
            onChange={(e) => onChange(e.target.value || null)}
            required={field.required}
          >
            <option value="">Select {field.label}...</option>
            {selectOptions.map((opt: any) => (
              <option key={opt.id || opt.label} value={opt.id || opt.label}>
                {opt.label || opt.id}
              </option>
            ))}
          </select>
          {field.field_key === "status" && value && (
            <div className="mt-2">
              <StatusChip value={value} />
            </div>
          )}
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
      );

    case "multi_select":
      // For multi-select, we'll use a text input with comma separation for now
      // In a full implementation, this could be a multi-select dropdown
      const currentValue = Array.isArray(value) ? value.join(", ") : value || "";
      return (
        <div>
          <input
            type="text"
            className={baseClasses}
            value={currentValue}
            onChange={(e) => {
              const parts = e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean);
              onChange(parts.length > 0 ? parts : null);
            }}
            placeholder="Comma-separated values"
            required={field.required}
          />
          {field.field_key === "channels" && Array.isArray(value) && value.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {value.map((c: string) => (
                <ChannelChip key={c} label={c} />
              ))}
            </div>
          )}
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
      );

    case "number":
      return (
        <div>
          <input
            type="number"
            className={baseClasses}
            value={value || ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            placeholder={field.label}
            required={field.required}
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
      );

    case "boolean":
      return (
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">{field.label}</span>
          </label>
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
      );

    case "attachment":
      // Use AttachmentUpload component
      return (
        <div>
          <AttachmentUpload
            table={table || field.table_id || "content"}
            recordId={recordId || null}
            fieldKey={field.field_key}
            value={Array.isArray(value) ? value[0] || null : value || null}
            onChange={(url) => onChange(url)}
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
      );

    case "linked_record":
      // Linked record picker - use LinkedRecordPicker component
      return (
        <div>
          <input
            type="text"
            className={baseClasses}
            value={value || ""}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder="Record ID (Linked Record Picker coming soon)"
            required={field.required}
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
      );

    default:
      return (
        <div>
          <input
            type="text"
            className={baseClasses}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.label}
            required={field.required}
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
      );
  }
}

