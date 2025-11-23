"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";

interface CalendarBlockProps {
  block: InterfacePageBlock;
}

export default function CalendarBlock({ block }: CalendarBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "content";
  const dateField = config.dateField || null;
  const filters = config.filters || [];
  const sort = config.sort || [];

  return (
    <div className="w-full h-full p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Calendar Block: {tableName} (date field: {dateField || "none"})
        {/* TODO: Integrate with CalendarView component */}
      </div>
    </div>
  );
}

