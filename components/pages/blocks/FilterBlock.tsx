"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import { usePageContext } from "../PageContext";
import ViewFilterPanel from "@/components/views/ViewFilterPanel";
import { useState } from "react";
import { Filter } from "@/lib/types/filters";
import { useFields } from "@/lib/useFields";

interface FilterBlockProps {
  block: InterfacePageBlock;
}

export default function FilterBlock({ block }: FilterBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "content";
  const { setSharedFilters, getSharedFilters } = usePageContext();
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const { fields } = useFields(tableName);
  
  const currentFilters = getSharedFilters(tableName);

  const handleFiltersChange = (filters: Filter[]) => {
    setSharedFilters(tableName, filters);
    setShowFilterPanel(false);
  };

  return (
    <div className="w-full h-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Filters for {tableName}
        </div>
        <button
          onClick={() => setShowFilterPanel(true)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {currentFilters.length > 0 ? "Edit" : "Add"} Filters
        </button>
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {currentFilters.length > 0 ? (
          <div className="space-y-1">
            {currentFilters.map((filter, idx) => (
              <div key={idx}>
                {filter.field} {filter.operator} {String(filter.value)}
              </div>
            ))}
          </div>
        ) : (
          "No filters applied"
        )}
      </div>
      {showFilterPanel && (
        <ViewFilterPanel
          open={showFilterPanel}
          onClose={() => setShowFilterPanel(false)}
          fields={fields}
          filters={currentFilters}
          onFiltersChange={handleFiltersChange}
        />
      )}
    </div>
  );
}

