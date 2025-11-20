"use client";

import { useState, useEffect } from "react";
import { X, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { Field } from "@/lib/fields";
import { Sort } from "@/lib/types/filters";

interface SortPanelProps {
  open: boolean;
  onClose: () => void;
  fields: Field[];
  sort: Sort[];
  onSortChange: (sort: Sort[]) => void;
}

export default function SortPanel({
  open,
  onClose,
  fields,
  sort,
  onSortChange,
}: SortPanelProps) {
  const [localSort, setLocalSort] = useState<Sort[]>(sort);

  useEffect(() => {
    setLocalSort(sort);
  }, [sort]);

  if (!open) return null;

  const addSort = () => {
    const firstField = fields[0];
    if (!firstField) return;

    const newSort: Sort = {
      id: `sort_${Date.now()}`,
      field: firstField.field_key,
      direction: "asc",
    };
    setLocalSort([...localSort, newSort]);
  };

  const updateSort = (id: string, updates: Partial<Sort>) => {
    setLocalSort(localSort.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const removeSort = (id: string) => {
    setLocalSort(localSort.filter((s) => s.id !== id));
  };

  const handleSave = () => {
    onSortChange(localSort);
  };

  const handleClear = () => {
    setLocalSort([]);
    onSortChange([]);
  };

  return (
    <div className="fixed inset-0 flex justify-end z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-full md:w-96 md:max-w-md bg-white dark:bg-gray-950 shadow-xl h-full overflow-y-auto border-l border-gray-200 dark:border-gray-700">
        <div className="p-4 md:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-lg md:text-xl font-heading text-brand-blue">Sort</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 -mr-2 touch-manipulation"
              aria-label="Close sort"
            >
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>

          {/* Add Sort Button */}
          <button
            onClick={addSort}
            className="w-full btn-secondary mb-4 flex items-center justify-center gap-2 py-3 md:py-2 touch-manipulation"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5" />
            <span className="text-sm md:text-base">Add Sort</span>
          </button>

          {/* Active Sorts */}
          <div className="space-y-3">
            {localSort.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                No sorts applied
              </div>
            ) : (
              localSort.map((sortItem, index) => {
                const field = fields.find((f) => f.field_key === sortItem.field);

                return (
                  <div
                    key={sortItem.id}
                    className="border border-gray-300 dark:border-gray-700 rounded-md p-3 md:p-4 bg-gray-50 dark:bg-gray-900"
                  >
                    <div className="flex items-center gap-2 md:gap-3">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-6 md:w-8 flex-shrink-0">
                        {index + 1}.
                      </span>

                      {/* Field Select */}
                      <select
                        value={sortItem.field}
                        onChange={(e) => updateSort(sortItem.id, { field: e.target.value })}
                        className="flex-1 px-3 py-2.5 md:py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm md:text-base touch-manipulation"
                      >
                        {fields.map((f) => (
                          <option key={f.id} value={f.field_key}>
                            {f.label}
                          </option>
                        ))}
                      </select>

                      {/* Direction Select */}
                      <button
                        onClick={() =>
                          updateSort(sortItem.id, {
                            direction: sortItem.direction === "asc" ? "desc" : "asc",
                          })
                        }
                        className="px-3 py-2.5 md:py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition touch-manipulation flex-shrink-0"
                        title={sortItem.direction === "asc" ? "Ascending" : "Descending"}
                        aria-label={sortItem.direction === "asc" ? "Change to descending" : "Change to ascending"}
                      >
                        {sortItem.direction === "asc" ? (
                          <ArrowUp className="w-4 h-4 md:w-5 md:h-5" />
                        ) : (
                          <ArrowDown className="w-4 h-4 md:w-5 md:h-5" />
                        )}
                      </button>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeSort(sortItem.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2 touch-manipulation flex-shrink-0"
                        title="Remove sort"
                        aria-label="Remove sort"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-2 md:gap-3">
            <button onClick={handleClear} className="btn-secondary flex-1 py-3 md:py-2 touch-manipulation">
              <span className="text-sm md:text-base">Clear All</span>
            </button>
            <button onClick={handleSave} className="btn-primary flex-1 py-3 md:py-2 touch-manipulation">
              <span className="text-sm md:text-base">Apply Sort</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

