"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";

interface ImageBlockProps {
  block: InterfacePageBlock;
}

export default function ImageBlock({ block }: ImageBlockProps) {
  const config = block.config || {};
  const imageUrl = config.imageUrl || "";

  if (!imageUrl) {
    return (
      <div className="w-full h-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          No image URL configured
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <img
        src={imageUrl}
        alt="Block image"
        className="w-full h-full object-cover rounded-lg"
      />
    </div>
  );
}

