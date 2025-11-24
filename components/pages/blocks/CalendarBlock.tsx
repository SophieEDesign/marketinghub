"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import CalendarView from "@/components/views/CalendarView";
import { usePageContext } from "../PageContext";

interface CalendarBlockProps {
  block: InterfacePageBlock;
}

export default function CalendarBlock({ block }: CalendarBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "content";
  const { getSharedFilters } = usePageContext();

  // Get shared filters from FilterBlock components
  const sharedFilters = getSharedFilters(tableName);

  if (!tableName) {
    return (
      <div className="w-full h-full p-4 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm border-2 border-dashed border-gray-300 dark:border-gray-700 rounded">
        <div className="text-center">
          <p className="font-medium mb-1">Calendar Block Not Configured</p>
          <p className="text-xs">Click the settings icon to select a table</p>
        </div>
      </div>
    );
  }

  // CalendarView manages its own state through useViewConfigs
  // The dateField is configured via the block's config.calendar_date_field
  // which should be set in the view config when the block is configured

  return (
    <div className="w-full h-full">
      <CalendarView tableId={tableName} />
    </div>
  );
}

