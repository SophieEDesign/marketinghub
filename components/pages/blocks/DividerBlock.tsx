"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";

interface DividerBlockProps {
  block: InterfacePageBlock;
}

export default function DividerBlock({ block }: DividerBlockProps) {
  return (
    <div className="w-full h-full flex items-center justify-center py-4">
      <div className="w-full border-t border-gray-200 dark:border-gray-700" />
    </div>
  );
}

