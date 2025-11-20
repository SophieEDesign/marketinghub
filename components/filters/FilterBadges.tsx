"use client";

import { X } from "lucide-react";
import { Filter } from "@/lib/types/filters";
import { Field } from "@/lib/fields";
import { getOperatorLabel } from "@/lib/types/filters";

interface FilterBadgesProps {
  filters: Filter[];
  fields: Field[];
  onRemoveFilter: (filterId: string) => void;
}

export default function FilterBadges({
  filters,
  fields,
  onRemoveFilter,
}: FilterBadgesProps) {
  if (filters.length === 0) return null;

  const getFieldLabel = (fieldKey: string) => {
    const field = fields.find((f) => f.field_key === fieldKey);
    return field?.label || fieldKey;
  };

  const formatFilterValue = (filter: Filter) => {
    const field = fields.find((f) => f.field_key === filter.field);
    if (!field) return String(filter.value);

    if (["is_empty", "is_not_empty"].includes(filter.operator)) {
      return "";
    }

    if (field.type === "date" && filter.operator === "in_range" && Array.isArray(filter.value)) {
      return `${filter.value[0]} - ${filter.value[1]}`;
    }

    if (field.type === "single_select" && field.options?.values) {
      const option = field.options.values.find((opt: any) => opt.id === filter.value || opt.label === filter.value);
      return option?.label || String(filter.value);
    }

    if (field.type === "boolean") {
      return filter.value === true ? "True" : filter.value === false ? "False" : String(filter.value);
    }

    return String(filter.value);
  };

  return (
    <div className="flex flex-wrap gap-1.5 md:gap-2 mb-3 md:mb-4">
      {filters.map((filter) => {
        const fieldLabel = getFieldLabel(filter.field);
        const operatorLabel = getOperatorLabel(filter.operator);
        const valueLabel = formatFilterValue(filter);

        return (
          <div
            key={filter.id}
            className="inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs md:text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 max-w-full"
          >
            <span className="font-medium truncate">{fieldLabel}</span>
            <span className="text-gray-500 dark:text-gray-400 hidden sm:inline">{operatorLabel}</span>
            {valueLabel && <span className="font-medium truncate max-w-[100px] md:max-w-none">{valueLabel}</span>}
            <button
              onClick={() => onRemoveFilter(filter.id)}
              className="ml-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-1 touch-manipulation flex-shrink-0"
              title="Remove filter"
              aria-label="Remove filter"
            >
              <X className="w-3 h-3 md:w-3.5 md:h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

