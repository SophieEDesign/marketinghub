"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";

interface KPIBlockProps {
  block: InterfacePageBlock;
}

export default function KPIBlock({ block }: KPIBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "content";
  const label = config.label || "Total";
  const aggregate = config.aggregate || "count";

  return (
    <div className="w-full h-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">
        {/* TODO: Calculate and display KPI value */}
        {aggregate === "count" ? "0" : "N/A"}
      </div>
    </div>
  );
}

