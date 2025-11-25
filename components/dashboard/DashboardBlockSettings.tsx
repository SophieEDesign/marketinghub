"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { DashboardBlock } from "@/lib/hooks/useDashboardBlocks";
import { useTables } from "@/lib/hooks/useTables";
import Button from "@/components/ui/Button";

interface DashboardBlockSettingsProps {
  block: DashboardBlock | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, content: any) => void;
}

export default function DashboardBlockSettings({
  block,
  isOpen,
  onClose,
  onUpdate,
}: DashboardBlockSettingsProps) {
  const { tables } = useTables();
  const [config, setConfig] = useState<any>({});

  useEffect(() => {
    if (block) {
      setConfig(block.content || {});
    }
  }, [block]);

  if (!isOpen || !block) return null;

  const handleSave = () => {
    onUpdate(block.id, config);
    onClose();
  };

  const updateConfig = (key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl z-[9999] flex flex-col">
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
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Block Type
          </label>
          <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
            {block.type}
          </div>
        </div>

        {/* Text Block Settings */}
        {block.type === "text" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              HTML Content
            </label>
            <textarea
              value={config.html || ""}
              onChange={(e) => updateConfig("html", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 font-mono text-sm"
              rows={10}
              placeholder="Enter HTML content..."
            />
          </div>
        )}

        {/* Image Block Settings */}
        {block.type === "image" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Image URL
              </label>
              <input
                type="url"
                value={config.url || ""}
                onChange={(e) => updateConfig("url", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Caption
              </label>
              <input
                type="text"
                value={config.caption || ""}
                onChange={(e) => updateConfig("caption", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                placeholder="Image caption"
              />
            </div>
          </>
        )}

        {/* Embed Block Settings */}
        {block.type === "embed" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Embed URL
            </label>
            <input
              type="url"
              value={config.url || ""}
              onChange={(e) => updateConfig("url", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              placeholder="https://example.com/embed"
            />
          </div>
        )}

        {/* KPI Block Settings */}
        {block.type === "kpi" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Table
              </label>
              <select
                value={config.table || ""}
                onChange={(e) => updateConfig("table", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              >
                <option value="">Select a table...</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.name}>
                    {table.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Label
              </label>
              <input
                type="text"
                value={config.label || ""}
                onChange={(e) => updateConfig("label", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                placeholder="KPI Label"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Aggregate
              </label>
              <select
                value={config.aggregate || "count"}
                onChange={(e) => updateConfig("aggregate", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              >
                <option value="count">Count</option>
                <option value="sum">Sum</option>
              </select>
            </div>
          </>
        )}

        {/* Table Block Settings */}
        {block.type === "table" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Table
              </label>
              <select
                value={config.table || ""}
                onChange={(e) => updateConfig("table", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              >
                <option value="">Select a table...</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.name}>
                    {table.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Row Limit (default: 3)
              </label>
              <input
                type="number"
                value={config.limit || 3}
                onChange={(e) => updateConfig("limit", parseInt(e.target.value) || 3)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                min="1"
                max="50"
                placeholder="3"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Number of rows to display. Default is 3, extend as needed.
              </p>
            </div>
          </>
        )}

        {/* Calendar Block Settings */}
        {block.type === "calendar" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Table
              </label>
              <select
                value={config.table || ""}
                onChange={(e) => updateConfig("table", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              >
                <option value="">Select a table...</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.name}>
                    {table.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date Field
              </label>
              <input
                type="text"
                value={config.dateField || ""}
                onChange={(e) => updateConfig("dateField", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                placeholder="publish_date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Limit
              </label>
              <input
                type="number"
                value={config.limit || 10}
                onChange={(e) => updateConfig("limit", parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                min="1"
                max="50"
              />
            </div>
          </>
        )}

        {/* HTML Block Settings */}
        {block.type === "html" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              HTML Content
            </label>
            <textarea
              value={config.html || ""}
              onChange={(e) => updateConfig("html", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 font-mono text-sm"
              rows={10}
              placeholder="Enter HTML content..."
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <Button onClick={handleSave} className="w-full">
          Save Changes
        </Button>
      </div>
    </div>
  );
}

