"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";

interface RecordPickerBlockProps {
  block: InterfacePageBlock;
}

export default function RecordPickerBlock({ block }: RecordPickerBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "content";

  return (
    <div className="w-full h-full p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Record Picker Block: {tableName}
        {/* TODO: Create RecordPicker component */}
      </div>
    </div>
  );
}

