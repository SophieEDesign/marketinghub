"use client";

import { useState } from "react";
import { X, Plus, Filter as FilterIcon } from "lucide-react";
import { Field } from "@/lib/fields";
import { Filter, FilterOperator, getOperatorsForFieldType, getOperatorLabel } from "@/lib/types/filters";
import FilterPanel from "../filters/FilterPanel";

interface ViewFilterPanelProps {
  open: boolean;
  onClose: () => void;
  fields: Field[];
  filters: Filter[];
  onFiltersChange: (filters: Filter[]) => void;
}

export default function ViewFilterPanel({
  open,
  onClose,
  fields,
  filters,
  onFiltersChange,
}: ViewFilterPanelProps) {
  const [showAddPanel, setShowAddPanel] = useState(false);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 flex justify-end z-40 pointer-events-none">
        <div className="absolute inset-0 bg-black/20" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white dark:bg-gray-950 shadow-xl h-full overflow-y-auto border-l border-gray-200 dark:border-gray-700 pointer-events-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <FilterIcon className="w-5 h-5 text-brand-blue" />
                <h2 className="text-lg font-heading text-brand-blue">Filters</h2>
                {filters.length > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-brand-red/10 text-brand-red">
                    {filters.length}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 -mr-2"
                aria-label="Close filters"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Active Filters */}
            <div className="space-y-2 mb-4">
              {filters.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  No filters applied
                </div>
              ) : (
                filters.map((filter) => {
                  const field = fields.find((f) => f.field_key === filter.field);
                  return (
                    <div
                      key={filter.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {field?.label || filter.field}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {getOperatorLabel(filter.operator)} {filter.value !== undefined && filter.value !== "" ? String(filter.value) : ""}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const newFilters = filters.filter((f) => f.id !== filter.id);
                          onFiltersChange(newFilters);
                        }}
                        className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        title="Remove filter"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Filter Button */}
            <button
              onClick={() => setShowAddPanel(true)}
              className="w-full btn-secondary flex items-center justify-center gap-2 py-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Filter</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Panel for adding new filters */}
      {showAddPanel && (
        <FilterPanel
          open={showAddPanel}
          onClose={() => setShowAddPanel(false)}
          fields={fields}
          filters={filters}
          onFiltersChange={(newFilters) => {
            onFiltersChange(newFilters);
            setShowAddPanel(false);
          }}
        />
      )}
    </>
  );
}

