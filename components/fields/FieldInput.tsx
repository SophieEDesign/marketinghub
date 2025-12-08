"use client";

import { Field, FieldType } from "@/lib/fields";
import StatusChip from "../chips/StatusChip";
import ChannelChip from "../chips/ChannelChip";
import AttachmentUpload from "./AttachmentUpload";
import MultiSelectDropdown from "./MultiSelectDropdown";
import LinkedRecordField from "../linked/LinkedRecordField";

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
    "w-full h-10 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500";

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
      return (
        <div>
          <MultiSelectDropdown
            field={field}
            value={Array.isArray(value) ? value : null}
            onChange={onChange}
          />
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
            table={table || field.table_id || ""}
            recordId={recordId || null}
            fieldKey={field.field_key}
            value={Array.isArray(value) ? value[0] || null : value || null}
            onChange={(url) => onChange(url)}
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
      );

    case "linked_record":
      // Use LinkedRecordField component
      return (
        <div>
          <LinkedRecordField
            field={field}
            value={value || null}
            onChange={onChange}
            editable={true}
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

