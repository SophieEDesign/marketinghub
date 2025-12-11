"use client";

import { useFields } from "@/lib/useFields";
import { Field } from "@/lib/fields";

interface FieldSelectorProps {
  tableId: string;
  value: string[];
  onChange: (fieldKeys: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  fieldTypes?: string[]; // Filter by field types
}

export default function FieldSelector({
  tableId,
  value,
  onChange,
  multiple = true,
  disabled,
  fieldTypes,
}: FieldSelectorProps) {
  const { fields, loading } = useFields(tableId);

  const filteredFields = fieldTypes
    ? fields.filter((f) => fieldTypes.includes(f.type))
    : fields;

  const handleChange = (fieldKey: string, checked: boolean) => {
    if (multiple) {
      if (checked) {
        onChange([...value, fieldKey]);
      } else {
        onChange(value.filter((f) => f !== fieldKey));
      }
    } else {
      onChange(checked ? [fieldKey] : []);
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Loading fields...
      </div>
    );
  }

  if (filteredFields.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No fields available. Select a table first.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {filteredFields.map((field) => (
        <label
          key={field.key}
          className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded"
        >
          <input
            type={multiple ? "checkbox" : "radio"}
            checked={value.includes(field.key)}
            onChange={(e) => handleChange(field.key, e.target.checked)}
            disabled={disabled}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          <span className="text-gray-700 dark:text-gray-300">
            {field.label || field.key}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-500">
            ({field.type})
          </span>
        </label>
      ))}
    </div>
  );
}
