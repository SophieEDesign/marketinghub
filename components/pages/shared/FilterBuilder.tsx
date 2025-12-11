"use client";

import { useState } from "react";
import { useFields } from "@/lib/useFields";
import { Plus, X } from "lucide-react";
import Button from "@/components/ui/Button";

interface Filter {
  field: string;
  operator: string;
  value: any;
}

interface FilterBuilderProps {
  tableId: string;
  filters: Filter[];
  onChange: (filters: Filter[]) => void;
}

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not equals" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

export default function FilterBuilder({ tableId, filters, onChange }: FilterBuilderProps) {
  const { fields, loading } = useFields(tableId);

  const addFilter = () => {
    onChange([
      ...filters,
      { field: fields[0]?.key || "", operator: "equals", value: "" },
    ]);
  };

  const updateFilter = (index: number, updates: Partial<Filter>) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    onChange(newFilters);
  };

  const removeFilter = (index: number) => {
    onChange(filters.filter((_, i) => i !== index));
  };

  if (loading || !tableId) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {loading ? "Loading fields..." : "Select a table first"}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Filters
        </label>
        <Button
          variant="outline"
          size="sm"
          onClick={addFilter}
          className="text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Filter
        </Button>
      </div>

      {filters.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 border border-gray-200 dark:border-gray-700 rounded">
          No filters. Click "Add Filter" to add one.
        </div>
      ) : (
        <div className="space-y-2">
          {filters.map((filter, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded"
            >
              <select
                value={filter.field}
                onChange={(e) => updateFilter(index, { field: e.target.value })}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
              >
                {fields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label || field.key}
                  </option>
                ))}
              </select>

              <select
                value={filter.operator}
                onChange={(e) => updateFilter(index, { operator: e.target.value })}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>

              {!["is_empty", "is_not_empty"].includes(filter.operator) && (
                <input
                  type="text"
                  value={filter.value || ""}
                  onChange={(e) => updateFilter(index, { value: e.target.value })}
                  placeholder="Value"
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                />
              )}

              <button
                onClick={() => removeFilter(index)}
                className="p-1 text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
