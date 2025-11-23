"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";

interface ListBlockProps {
  block: InterfacePageBlock;
}

export default function ListBlock({ block }: ListBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "content";
  const fields = config.fields || [];
  const filters = config.filters || [];
  const sort = config.sort || [];

  return (
    <div className="w-full h-full p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        List Block: {tableName}
        {/* TODO: Create ListView component */}
      </div>
    </div>
  );
}

