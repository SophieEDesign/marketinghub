"use client";

import React from "react";
import { Settings, X, Copy, GripVertical } from "lucide-react";
import { BlockConfig } from "@/lib/pages/blockTypes";
import { getBlockType } from "@/lib/pages/blockTypes";
import { evaluateBlockVisibility } from "@/lib/pages/blockVisibility";

interface PageBlockRendererProps {
  block: BlockConfig;
  isEditing: boolean;
  onUpdate?: (id: string, updates: Partial<BlockConfig>) => void;
  onDelete?: (id: string) => void;
  onOpenSettings?: (block: BlockConfig) => void;
  onDuplicate?: (block: BlockConfig) => void;
  recordContext?: Record<string, any>; // For visibility evaluation
  userRole?: string; // For permission checks
}

export default function PageBlockRenderer({
  block,
  isEditing,
  onUpdate,
  onDelete,
  onOpenSettings,
  onDuplicate,
  recordContext,
  userRole,
}: PageBlockRendererProps) {
  const blockType = getBlockType(block.type);
  
  if (!blockType) {
    console.warn("PageBlockRenderer: Unknown block type", block.type);
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm text-gray-500">
        Unknown block type: {block.type}
      </div>
    );
  }

  // Check permissions
  if (block.allowed_roles && block.allowed_roles.length > 0) {
    if (!userRole || !block.allowed_roles.includes(userRole)) {
      if (!isEditing) {
        return null; // Hide block if user doesn't have permission
      }
      // In edit mode, show but indicate it's restricted
    }
  }

  // Evaluate visibility (only in view mode)
  const isVisible = isEditing || evaluateBlockVisibility(block, recordContext);
  
  if (!isVisible && !isEditing) {
    return null; // Hide block if visibility condition fails
  }

  const Component = blockType.component;
  const isHidden = !isVisible && isEditing;

  const commonProps = {
    block,
    isEditing,
    onUpdate: isEditing ? onUpdate : undefined,
    onDelete: isEditing ? onDelete : undefined,
    onOpenSettings: onOpenSettings ? () => onOpenSettings(block) : undefined,
  };

  return (
    <div className="h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col relative group">
      {/* Block Header (only in edit mode) */}
      {isEditing && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-2 py-1 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1">
            <div className="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <GripVertical className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {blockType.label}
            </span>
            {isHidden && (
              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                (Hidden by condition)
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onDuplicate && (
              <button
                onClick={() => onDuplicate(block)}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="Duplicate block"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
            {onOpenSettings && (
              <button
                onClick={() => onOpenSettings(block)}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="Configure block"
              >
                <Settings className="w-3 h-3" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(block.id)}
                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                title="Delete block"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Block Content */}
      <div className="flex-1 overflow-auto">
        <Component {...commonProps} />
      </div>
    </div>
  );
}
