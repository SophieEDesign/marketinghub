"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";

interface TextBlockProps {
  block: InterfacePageBlock;
}

export default function TextBlock({ block }: TextBlockProps) {
  const config = block.config || {};
  const textContent = config.textContent || config.content || "";

  if (!textContent) {
    return (
      <div className="w-full h-full p-4 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm border-2 border-dashed border-gray-300 dark:border-gray-700 rounded">
        <div className="text-center">
          <p className="font-medium mb-1">Empty Text Block</p>
          <p className="text-xs">Click the settings icon to add content</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-4 prose dark:prose-invert max-w-none">
      <div dangerouslySetInnerHTML={{ __html: textContent }} />
    </div>
  );
}

