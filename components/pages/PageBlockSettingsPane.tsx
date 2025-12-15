"use client";

import { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import { BlockConfig } from "@/lib/pages/blockTypes";
import { getBlockType } from "@/lib/pages/blockTypes";
import Button from "@/components/ui/Button";

interface PageBlockSettingsPaneProps {
  block: BlockConfig;
  onUpdate: (updates: Partial<BlockConfig>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function PageBlockSettingsPane({
  block,
  onUpdate,
  onDelete,
  onClose,
}: PageBlockSettingsPaneProps) {
  const blockType = getBlockType(block.type);
  const [title, setTitle] = useState(block.settings?.title || "");
  const [settings, setSettings] = useState(block.settings || {});

  useEffect(() => {
    setTitle(block.settings?.title || "");
    setSettings(block.settings || {});
  }, [block]);

  if (!blockType) {
    return (
      <div className="p-6">
        <p className="text-red-600">Unknown block type: {block.type}</p>
        <Button onClick={onClose} className="mt-4">Close</Button>
      </div>
    );
  }

  const handleSave = () => {
    onUpdate({
      settings: {
        ...settings,
        title,
      },
    });
    onClose();
  };

  const handleDelete = () => {
    if (confirm(`Delete ${blockType.label} block?`)) {
      onDelete();
      onClose();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Configure {blockType.label}
          </h2>
          {blockType.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {blockType.description}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Block Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
          placeholder="Optional block title"
        />
      </div>

      {/* Block-Specific Settings */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Settings
        </label>
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Block-specific settings editor will be implemented here based on block type.
            For now, settings are stored in the block configuration.
          </p>
          {/* TODO: Add block-type-specific settings editors */}
        </div>
      </div>

      {/* Visibility Conditions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Visibility Conditions (Optional)
        </label>
        <div className="space-y-2">
          <select
            value={block.visibility?.field || ""}
            onChange={(e) => {
              onUpdate({
                visibility: {
                  ...block.visibility,
                  field: e.target.value || undefined,
                },
              });
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            <option value="">No condition (always visible)</option>
            {/* TODO: Populate with available fields */}
          </select>
          {block.visibility?.field && (
            <>
              <select
                value={block.visibility?.operator || "equals"}
                onChange={(e) => {
                  onUpdate({
                    visibility: {
                      ...block.visibility,
                      operator: e.target.value as any,
                    },
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
                <option value="equals">Equals</option>
                <option value="not_equals">Not Equals</option>
                <option value="contains">Contains</option>
                <option value="empty">Is Empty</option>
                <option value="not_empty">Is Not Empty</option>
              </select>
              {block.visibility?.operator !== "empty" && block.visibility?.operator !== "not_empty" && (
                <input
                  type="text"
                  value={block.visibility?.value || ""}
                  onChange={(e) => {
                    onUpdate({
                      visibility: {
                        ...block.visibility,
                        value: e.target.value,
                      },
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                  placeholder="Value to compare"
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Permissions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Permissions (Optional)
        </label>
        <input
          type="text"
          value={block.allowed_roles?.join(", ") || ""}
          onChange={(e) => {
            const roles = e.target.value
              .split(",")
              .map((r) => r.trim())
              .filter(Boolean);
            onUpdate({
              allowed_roles: roles.length > 0 ? roles : undefined,
            });
          }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
          placeholder="Comma-separated roles (e.g., admin, editor)"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete Block
        </button>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
