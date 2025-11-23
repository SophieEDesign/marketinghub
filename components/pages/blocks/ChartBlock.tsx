"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";

interface ChartBlockProps {
  block: InterfacePageBlock;
}

export default function ChartBlock({ block }: ChartBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "content";
  const chartType = config.chartType || "bar";
  const xField = config.xField || null;
  const yField = config.yField || null;

  return (
    <div className="w-full h-full p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Chart Block: {chartType} ({xField || "x"} vs {yField || "y"})
        {/* TODO: Create Chart component */}
      </div>
    </div>
  );
}

