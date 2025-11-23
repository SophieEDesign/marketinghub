"use client";

import { useState } from "react";
import { X, Plus, ArrowUpDown } from "lucide-react";
import { Field } from "@/lib/fields";
import { Sort } from "@/lib/types/filters";
import SortPanel from "../sorting/SortPanel";

interface ViewSortPanelProps {
  open: boolean;
  onClose: () => void;
  fields: Field[];
  sort: Sort[];
  onSortChange: (sort: Sort[]) => void;
}

export default function ViewSortPanel({
  open,
  onClose,
  fields,
  sort,
  onSortChange,
}: ViewSortPanelProps) {
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
                <ArrowUpDown className="w-5 h-5 text-brand-blue" />
                <h2 className="text-lg font-heading text-brand-blue">Sort</h2>
                {sort.length > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-brand-red/10 text-brand-red">
                    {sort.length}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 -mr-2"
                aria-label="Close sort"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Active Sorts */}
            <div className="space-y-2 mb-4">
              {sort.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  No sorting applied
                </div>
              ) : (
                sort.map((sortItem) => {
                  const field = fields.find((f) => f.field_key === sortItem.field);
                  return (
                    <div
                      key={sortItem.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {field?.label || sortItem.field}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {sortItem.direction}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const newSort = sort.filter((s) => s.id !== sortItem.id);
                          onSortChange(newSort);
                        }}
                        className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        title="Remove sort"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Sort Button */}
            <button
              onClick={() => setShowAddPanel(true)}
              className="w-full btn-secondary flex items-center justify-center gap-2 py-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Sort</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sort Panel for adding new sorts */}
      {showAddPanel && (
        <SortPanel
          open={showAddPanel}
          onClose={() => setShowAddPanel(false)}
          fields={fields}
          sort={sort}
          onSortChange={(newSort) => {
            onSortChange(newSort);
            setShowAddPanel(false);
          }}
        />
      )}
    </>
  );
}

