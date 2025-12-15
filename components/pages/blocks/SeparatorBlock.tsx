"use client";

import { BlockConfig } from "@/lib/pages/blockTypes";

interface SeparatorBlockProps {
  block: BlockConfig;
  isEditing: boolean;
  onUpdate?: (id: string, updates: Partial<BlockConfig>) => void;
  onDelete?: (id: string) => void;
  onOpenSettings?: () => void;
}

export default function SeparatorBlock({
  block,
  isEditing,
  onUpdate,
  onDelete,
  onOpenSettings,
}: SeparatorBlockProps) {
  return (
    <div className="py-2">
      <div className="border-t border-gray-200 dark:border-gray-700" />
    </div>
  );
}
