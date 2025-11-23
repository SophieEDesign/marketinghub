"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";

interface TextBlockProps {
  block: InterfacePageBlock;
}

export default function TextBlock({ block }: TextBlockProps) {
  const config = block.config || {};
  const textContent = config.textContent || "";

  return (
    <div className="w-full h-full p-4 prose dark:prose-invert max-w-none">
      <div dangerouslySetInnerHTML={{ __html: textContent }} />
    </div>
  );
}

