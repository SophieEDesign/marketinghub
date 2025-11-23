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

  // KanbanView manages its own state through useViewConfigs
  // The groupField is configured via the block's config.kanban_group_field
  // which should be set in the view config when the block is configured

  return (
    <div className="w-full h-full">
      <KanbanView tableId={tableName} />
    </div>
  );
}

