"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import GridView from "@/components/views/GridView";

interface GridBlockProps {
  block: InterfacePageBlock;
}

export default function GridBlock({ block }: GridBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "content";

  // GridView manages its own filters, sort, and fields through useViewConfigs
  // For now, we just pass the tableId. In the future, we'll need to:
  // 1. Create a page context system to share filters from FilterBlock
  // 2. Create or use a view config for this block's specific settings
  // 3. Integrate with the page context to apply shared filters

  return (
    <div className="w-full h-full">
      <GridView tableId={tableName} />
    </div>
  );
}

