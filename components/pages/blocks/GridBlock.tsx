"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import GridView from "@/components/views/GridView";

interface GridBlockProps {
  block: InterfacePageBlock;
}

export default function GridBlock({ block }: GridBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "content";
  const filters = config.filters || [];
  const sort = config.sort || [];
  const fields = config.fields || [];

  // Create or get viewConfig for this block
  // For now, we'll pass the config directly to GridView
  // In the future, we can create a viewConfig entry if needed

  return (
    <div className="w-full h-full">
      <GridView
        tableId={tableName}
        filters={filters}
        sort={sort}
        fields={fields}
        viewConfigId={null} // Blocks manage their own config
      />
    </div>
  );
}

