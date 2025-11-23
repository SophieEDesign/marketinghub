"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";

interface GalleryBlockProps {
  block: InterfacePageBlock;
}

export default function GalleryBlock({ block }: GalleryBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "content";
  const cardFields = config.cardFields || [];
  const filters = config.filters || [];
  const sort = config.sort || [];

  return (
    <div className="w-full h-full p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Gallery Block: {tableName}
        {/* TODO: Integrate with CardsView component */}
      </div>
    </div>
  );
}

