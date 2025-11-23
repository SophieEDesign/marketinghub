"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";

interface FilterBlockProps {
  block: InterfacePageBlock;
}

export default function FilterBlock({ block }: FilterBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "content";
  const filters = config.filters || [];

  return (
    <div className="w-full h-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Filters
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {filters.length > 0 ? `${filters.length} filter(s)` : "No filters"}
        {/* TODO: Create Filter UI component */}
      </div>
    </div>
  );
}

