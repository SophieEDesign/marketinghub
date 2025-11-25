"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import CardsView from "@/components/views/CardsView";
import { usePageContext } from "@/components/pages/PageContext";

interface GalleryBlockProps {
  block: InterfacePageBlock;
}

export default function GalleryBlock({ block }: GalleryBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "content";
  const { getSharedFilters } = usePageContext();

  // Get shared filters from FilterBlock components
  const sharedFilters = getSharedFilters(tableName);

  if (!tableName) {
    return (
      <div className="w-full h-full p-4 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm border-2 border-dashed border-gray-300 dark:border-gray-700 rounded">
        <div className="text-center">
          <p className="font-medium mb-1">Gallery Block Not Configured</p>
          <p className="text-xs">Click the settings icon to select a table</p>
        </div>
      </div>
    );
  }

  // CardsView manages its own state through useViewConfigs
  // Shared filters from FilterBlock are available via PageContext
  // but CardsView currently manages its own filters through useViewConfigs.
  // This integration can be enhanced later to merge shared filters.

  return (
    <div className="w-full h-full">
      <CardsView tableId={tableName} />
    </div>
  );
}

