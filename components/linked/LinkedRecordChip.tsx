"use client";

import { X, Link as LinkIcon } from "lucide-react";

interface LinkedRecordChipProps {
  displayValue: string;
  onRemove?: () => void;
  onClick?: () => void;
  size?: "sm" | "md";
}

export default function LinkedRecordChip({
  displayValue,
  onRemove,
  onClick,
  size = "md",
}: LinkedRecordChipProps) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 ${sizeClasses} ${
        onClick ? "cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50" : ""
      } transition`}
      onClick={onClick}
    >
      <LinkIcon className="w-3 h-3" />
      <span className="font-medium">{displayValue}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition"
          title="Remove link"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

