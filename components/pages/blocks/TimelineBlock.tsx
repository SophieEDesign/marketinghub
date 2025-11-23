"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import TimelineView from "@/components/views/TimelineView";
import { usePageContext } from "../PageContext";

interface TimelineBlockProps {
  block: InterfacePageBlock;
}

export default function TimelineBlock({ block }: TimelineBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "content";
  const { getSharedFilters } = usePageContext();

  // Get shared filters from FilterBlock components
  const sharedFilters = getSharedFilters(tableName);

  // TimelineView manages its own state through useViewConfigs
  // The dateField is configured via the block's config.timeline_date_field
  // which should be set in the view config when the block is configured

  return (
    <div className="w-full h-full">
      <TimelineView tableId={tableName} />
    </div>
  );
}

