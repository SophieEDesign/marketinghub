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

  // CalendarView manages its own state through useViewConfigs
  // The dateField is configured via the block's config.calendar_date_field
  // which should be set in the view config when the block is configured

  return (
    <div className="w-full h-full">
      <CalendarView tableId={tableName} />
    </div>
  );
}

