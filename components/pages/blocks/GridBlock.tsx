"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import GridView from "@/components/views/GridView";
import { usePageContext } from "../PageContext";

interface GridBlockProps {
  block: InterfacePageBlock;
}

export default function GridBlock({ block }: GridBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "content";
  const { getSharedFilters } = usePageContext();

  // Get shared filters from FilterBlock components
  const sharedFilters = getSharedFilters(tableName);

  // GridView manages its own state, but we can pass filters via context
  // For now, GridView will use its own view config system
  // In the future, we can enhance GridView to accept initial filters as props

  return (
    <div className="w-full h-full">
      <GridView tableId={tableName} />
      {/* Note: Shared filters from FilterBlock are available via PageContext
          but GridView currently manages its own filters through useViewConfigs.
          This integration can be enhanced later to merge shared filters. */}
    </div>
  );
}

