"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import KanbanView from "@/components/views/KanbanView";
import { usePageContext } from "../PageContext";

interface KanbanBlockProps {
  block: InterfacePageBlock;
}

export default function KanbanBlock({ block }: KanbanBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "content";
  const { getSharedFilters } = usePageContext();

  // Get shared filters from FilterBlock components
  const sharedFilters = getSharedFilters(tableName);

  if (!tableName) {
    return (
      <div className="w-full h-full p-4 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm border-2 border-dashed border-gray-300 dark:border-gray-700 rounded">
        <div className="text-center">
          <p className="font-medium mb-1">Kanban Block Not Configured</p>
          <p className="text-xs">Click the settings icon to select a table</p>
        </div>
      </div>
    );
  }

  // KanbanView manages its own state through useViewConfigs
  // The groupField is configured via the block's config.kanban_group_field
  // which should be set in the view config when the block is configured

  return (
    <div className="w-full h-full">
      <KanbanView tableId={tableName} />
    </div>
  );
}

