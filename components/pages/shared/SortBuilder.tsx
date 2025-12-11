"use client";

import { useState } from "react";
import { useFields } from "@/lib/useFields";
import { Plus, X } from "lucide-react";
import Button from "@/components/ui/Button";

interface Sort {
  field: string;
  direction: "asc" | "desc";
}

interface SortBuilderProps {
  tableId: string;
  sorts: Sort[];
  onChange: (sorts: Sort[]) => void;
}

export default function SortBuilder({ tableId, sorts, onChange }: SortBuilderProps) {
  const { fields, loading } = useFields(tableId);

  const addSort = () => {
    onChange([
      ...sorts,
      { field: fields[0]?.key || "", direction: "asc" },
    ]);
  };

  const updateSort = (index: number, updates: Partial<Sort>) => {
    const newSorts = [...sorts];
    newSorts[index] = { ...newSorts[index], ...updates };
    onChange(newSorts);
  };

  const removeSort = (index: number) => {
    onChange(sorts.filter((_, i) => i !== index));
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
          Sort Order
        </label>
        <Button
          variant="outline"
          size="sm"
          onClick={addSort}
          className="text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Sort
        </Button>
      </div>

      {sorts.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 border border-gray-200 dark:border-gray-700 rounded">
          No sorts. Click "Add Sort" to add one.
        </div>
      ) : (
        <div className="space-y-2">
          {sorts.map((sort, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded"
            >
              <select
                value={sort.field}
                onChange={(e) => updateSort(index, { field: e.target.value })}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
              >
                {fields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label || field.key}
                  </option>
                ))}
              </select>

              <select
                value={sort.direction}
                onChange={(e) => updateSort(index, { direction: e.target.value as "asc" | "desc" })}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>

              <button
                onClick={() => removeSort(index)}
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
