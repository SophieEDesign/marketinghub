"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";

interface KanbanBlockProps {
  block: InterfacePageBlock;
}

export default function KanbanBlock({ block }: KanbanBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "content";
  const groupField = config.groupField || null;
  const filters = config.filters || [];
  const sort = config.sort || [];

  return (
    <div className="w-full h-full p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Kanban Block: {tableName} (grouped by {groupField || "none"})
        {/* TODO: Integrate with KanbanView component */}
      </div>
    </div>
  );
}

