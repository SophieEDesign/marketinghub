"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import Button from "@/components/ui/Button";

interface BlockSettingsPanelProps {
  block: InterfacePageBlock | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<InterfacePageBlock>) => void;
}

export default function BlockSettingsPanel({
  block,
  isOpen,
  onClose,
  onUpdate,
}: BlockSettingsPanelProps) {
  const [config, setConfig] = useState<any>({});

  useEffect(() => {
    if (block) {
      setConfig(block.config || {});
    }
  }, [block]);

  if (!isOpen || !block) return null;

  const handleSave = () => {
    onUpdate(block.id, { config });
    onClose();
  };

  const updateConfig = (key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Block Settings
        </h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Block Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Block Type
          </label>
          <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
            {block.type}
          </div>
        </div>

        {/* Common Settings */}
        {["grid", "kanban", "calendar", "timeline", "gallery", "list"].includes(block.type) && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Table
              </label>
              <input
                type="text"
                value={config.table || ""}
                onChange={(e) => updateConfig("table", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                placeholder="Table name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fields (comma-separated)
              </label>
              <input
                type="text"
                value={Array.isArray(config.fields) ? config.fields.join(", ") : config.fields || ""}
                onChange={(e) => {
                  const fields = e.target.value.split(",").map((f) => f.trim()).filter(Boolean);
                  updateConfig("fields", fields);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                placeholder="title, status, created_at"
              />
            </div>
          </>
        )}

        {/* Kanban-specific */}
        {block.type === "kanban" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Group Field
            </label>
            <input
              type="text"
              value={config.kanban_group_field || config.groupField || ""}
              onChange={(e) => {
                updateConfig("kanban_group_field", e.target.value);
                updateConfig("groupField", e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              placeholder="status"
            />
          </div>
        )}

        {/* Calendar-specific */}
        {block.type === "calendar" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date Field
            </label>
            <input
              type="text"
              value={config.calendar_date_field || config.dateField || ""}
              onChange={(e) => {
                updateConfig("calendar_date_field", e.target.value);
                updateConfig("dateField", e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              placeholder="publish_date"
            />
          </div>
        )}

        {/* Timeline-specific */}
        {block.type === "timeline" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date Field
            </label>
            <input
              type="text"
              value={config.timeline_date_field || config.dateField || ""}
              onChange={(e) => {
                updateConfig("timeline_date_field", e.target.value);
                updateConfig("dateField", e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              placeholder="publish_date"
            />
          </div>
        )}

        {/* Text Block */}
        {block.type === "text" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Content
            </label>
            <textarea
              value={config.textContent || config.content || ""}
              onChange={(e) => {
                updateConfig("textContent", e.target.value);
                updateConfig("content", e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              rows={6}
              placeholder="Enter text content"
            />
          </div>
        )}

        {/* Image Block */}
        {block.type === "image" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Image URL
            </label>
            <input
              type="text"
              value={config.imageUrl || config.url || ""}
              onChange={(e) => {
                updateConfig("imageUrl", e.target.value);
                updateConfig("url", e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              placeholder="https://..."
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleSave} className="flex-1">
          Save
        </Button>
      </div>
    </div>
  );
}

