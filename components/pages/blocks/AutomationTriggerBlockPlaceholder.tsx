"use client";

import { BlockConfig } from "@/lib/pages/blockTypes";
import { Zap } from "lucide-react";

interface AutomationTriggerBlockPlaceholderProps {
  block: BlockConfig;
  isEditing: boolean;
  onUpdate?: (id: string, updates: Partial<BlockConfig>) => void;
  onDelete?: (id: string) => void;
  onOpenSettings?: () => void;
}

export default function AutomationTriggerBlockPlaceholder({
  block,
  isEditing,
  onOpenSettings,
}: AutomationTriggerBlockPlaceholderProps) {
  const buttonText = block.settings?.buttonText || "Run Automation";
  const automationId = block.settings?.automationId;

  if (!automationId) {
    return (
      <div className="p-4 text-center">
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          Automation Trigger
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          Configure automation to trigger
        </div>
        {isEditing && onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Configure
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      <button
        onClick={() => {
          // TODO: Trigger automation
          console.log("Trigger automation:", automationId);
        }}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-2"
      >
        <Zap className="w-4 h-4" />
        {buttonText}
      </button>
    </div>
  );
}
